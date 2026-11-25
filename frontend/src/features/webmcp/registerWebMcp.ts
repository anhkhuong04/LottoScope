import { api, params, windowQuery, type AnalysisWindow } from '../../api'
import { analysisDrawCounts, supportedGameIds } from '../../analysisOptions'

type JsonSchema = Record<string, unknown>

export type WebMcpTool = {
  name: string
  description: string
  inputSchema: JsonSchema
  annotations?: { readOnlyHint?: boolean }
  execute: (
    input: Record<string, unknown>,
  ) => Promise<{ content: [{ type: 'text'; text: string }] }>
}

export type ModelContextLike = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => void | Promise<void>
}

function requireGame(input: Record<string, unknown>): string {
  const game = String(input.game ?? '')
  if (!supportedGameIds.has(game)) {
    throw new Error('game must be one of: lotto_535, mega_645, power_655')
  }
  return game
}

function buildWindow(input: Record<string, unknown>): AnalysisWindow {
  const kind = input.window === undefined ? 'last_draws' : String(input.window)
  if (kind === 'all_time') return { kind: 'all_time' }
  if (kind === 'date_range') {
    const from_date = String(input.from_date ?? '')
    const to_date = String(input.to_date ?? '')
    if (!from_date || !to_date) {
      throw new Error('from_date and to_date (YYYY-MM-DD) are required for date_range window')
    }
    return { kind: 'date_range', from_date, to_date }
  }
  const rawCount = input.count === undefined ? 30 : Number(input.count)
  if (!analysisDrawCounts.has(rawCount)) {
    throw new Error('count must be one of: 10, 20, 30, 50, 100')
  }
  return { kind: 'last_draws', count: rawCount }
}

function asTextResult(data: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] }
}

const GAME_SCHEMA: JsonSchema = {
  type: 'string',
  enum: [...supportedGameIds],
  description: 'Game identifier: lotto_535, mega_645, or power_655.',
}

const WINDOW_PROPERTIES: Record<string, JsonSchema> = {
  window: {
    type: 'string',
    enum: ['last_draws', 'date_range', 'all_time'],
    description: 'Analysis window type (default: last_draws).',
  },
  count: {
    type: 'integer',
    enum: [...analysisDrawCounts],
    description: 'Draw count when window is last_draws (default: 30).',
  },
  from_date: {
    type: 'string',
    description: 'Start date YYYY-MM-DD when window is date_range.',
  },
  to_date: {
    type: 'string',
    description: 'End date YYYY-MM-DD when window is date_range.',
  },
}

export function createWebMcpTools(): WebMcpTool[] {
  return [
    {
      name: 'get_games',
      description:
        'List all supported Vietlott games (lotto_535, mega_645, power_655) with main and special number bounds.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
      execute: async () => asTextResult(await api('/games')),
    },
    {
      name: 'get_game_status',
      description: 'Get latest stored draw ID, draw date, and data version for a game.',
      inputSchema: {
        type: 'object',
        properties: { game: GAME_SCHEMA },
        required: ['game'],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => asTextResult(await api(`/games/${requireGame(input)}/status`)),
    },
    {
      name: 'get_latest_draw',
      description: 'Get the latest stored historical draw result for a game.',
      inputSchema: {
        type: 'object',
        properties: { game: GAME_SCHEMA },
        required: ['game'],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) =>
        asTextResult(await api(`/games/${requireGame(input)}/draws/latest`)),
    },
    {
      name: 'get_draws',
      description: 'Query paginated historical draw results for a game.',
      inputSchema: {
        type: 'object',
        properties: {
          game: GAME_SCHEMA,
          page: { type: 'integer', minimum: 1, description: 'Page number (default: 1).' },
          page_size: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            description: 'Rows per page, max 100 (default: 25).',
          },
          sort: {
            type: 'string',
            enum: ['desc', 'asc'],
            description: 'Sort order (default: desc).',
          },
          from_date: { type: 'string', description: 'Optional start date YYYY-MM-DD.' },
          to_date: { type: 'string', description: 'Optional end date YYYY-MM-DD.' },
          draw_id: { type: 'string', description: 'Optional specific draw ID filter.' },
        },
        required: ['game'],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const game = requireGame(input)
        const query = params({
          page: typeof input.page === 'number' ? input.page : 1,
          page_size: typeof input.page_size === 'number' ? input.page_size : 25,
          sort: typeof input.sort === 'string' ? input.sort : 'desc',
          from_date: typeof input.from_date === 'string' ? input.from_date : undefined,
          to_date: typeof input.to_date === 'string' ? input.to_date : undefined,
          draw_id: typeof input.draw_id === 'string' ? input.draw_id : undefined,
        })
        return asTextResult(await api(`/games/${game}/draws?${query}`))
      },
    },
    {
      name: 'get_number_frequencies',
      description:
        'Get historical number frequency, percentage, rank, and gap metrics for a game within an analysis window.',
      inputSchema: {
        type: 'object',
        properties: {
          game: GAME_SCHEMA,
          ...WINDOW_PROPERTIES,
          number_kind: {
            type: 'string',
            enum: ['main', 'special'],
            description: 'Number pool: main (all games) or special (lotto_535 only, 01-12).',
          },
          sort: {
            type: 'string',
            enum: ['number', 'frequency_desc', 'frequency_asc', 'gap_desc'],
            description: 'Sort order (default: frequency_desc).',
          },
        },
        required: ['game'],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const game = requireGame(input)
        const win = buildWindow(input)
        const numberKind = input.number_kind === 'special' ? 'special' : 'main'
        if (numberKind === 'special' && game !== 'lotto_535') {
          throw new Error('special number analytics are only supported for lotto_535')
        }
        const query = params({
          ...windowQuery(win),
          number_kind: numberKind,
          sort: typeof input.sort === 'string' ? input.sort : 'frequency_desc',
        })
        return asTextResult(await api(`/games/${game}/analytics/numbers?${query}`))
      },
    },
    {
      name: 'get_number_detail',
      description: 'Get historical metrics, appearance draws, and top pair partners for a number.',
      inputSchema: {
        type: 'object',
        properties: {
          game: GAME_SCHEMA,
          number: { type: 'integer', minimum: 1, maximum: 55 },
          ...WINDOW_PROPERTIES,
          number_kind: {
            type: 'string',
            enum: ['main', 'special'],
            description: 'Number pool: main or special (lotto_535 only).',
          },
          page: { type: 'integer', minimum: 1 },
          page_size: { type: 'integer', minimum: 1, maximum: 100 },
        },
        required: ['game', 'number'],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const game = requireGame(input)
        const num = Number(input.number)
        if (!Number.isInteger(num) || num < 1) throw new Error('number must be a positive integer')
        const win = buildWindow(input)
        const numberKind = input.number_kind === 'special' ? 'special' : 'main'
        const query = params({
          ...windowQuery(win),
          number_kind: numberKind,
          page: typeof input.page === 'number' ? input.page : 1,
          page_size: typeof input.page_size === 'number' ? input.page_size : 25,
        })
        return asTextResult(await api(`/games/${game}/analytics/numbers/${num}?${query}`))
      },
    },
    {
      name: 'get_pair_frequencies',
      description: 'Get historical co-occurring main-number pair frequencies and gaps.',
      inputSchema: {
        type: 'object',
        properties: {
          game: GAME_SCHEMA,
          ...WINDOW_PROPERTIES,
          min_frequency: { type: 'integer', minimum: 0 },
          sort: { type: 'string', enum: ['frequency_desc', 'frequency_asc', 'pair'] },
          page: { type: 'integer', minimum: 1 },
          page_size: { type: 'integer', minimum: 1, maximum: 100 },
        },
        required: ['game'],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const game = requireGame(input)
        const win = buildWindow(input)
        const query = params({
          ...windowQuery(win),
          min_frequency: typeof input.min_frequency === 'number' ? input.min_frequency : undefined,
          sort: typeof input.sort === 'string' ? input.sort : 'frequency_desc',
          page: typeof input.page === 'number' ? input.page : 1,
          page_size: typeof input.page_size === 'number' ? input.page_size : 25,
        })
        return asTextResult(await api(`/games/${game}/analytics/pairs?${query}`))
      },
    },
    {
      name: 'check_combination',
      description:
        'Check a combination of main numbers against historical draws for exact matches and overlap summary.',
      inputSchema: {
        type: 'object',
        properties: {
          game: GAME_SCHEMA,
          main_numbers: {
            type: 'array',
            items: { type: 'integer', minimum: 1, maximum: 55 },
            description: 'Main numbers array matching game count (5 for lotto_535, 6 otherwise).',
          },
          ...WINDOW_PROPERTIES,
        },
        required: ['game', 'main_numbers'],
      },
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const game = requireGame(input)
        if (!Array.isArray(input.main_numbers) || input.main_numbers.length === 0) {
          throw new Error('main_numbers must be a non-empty array of integers')
        }
        const win = buildWindow(input)
        return asTextResult(
          await api(`/games/${game}/combinations/check`, undefined, {
            main_numbers: input.main_numbers,
            analysis_window: win,
            similar_page: 1,
            similar_page_size: 10,
          }),
        )
      },
    },
  ]
}

function getModelContext(): ModelContextLike | null {
  const doc = document as unknown as { modelContext?: ModelContextLike }
  const nav = navigator as unknown as { modelContext?: ModelContextLike }
  const ctx = doc.modelContext ?? nav.modelContext
  return ctx && typeof ctx.registerTool === 'function' ? ctx : null
}

export function registerWebMcpTools(customContext?: ModelContextLike | null): () => void {
  const modelContext = customContext === undefined ? getModelContext() : customContext
  if (!modelContext) return () => undefined

  const controller = new AbortController()
  for (const tool of createWebMcpTools()) {
    try {
      const maybePromise = modelContext.registerTool(tool, { signal: controller.signal })
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => undefined)
      }
    } catch {
      /* Ignore browser rejections during progressive feature detection. */
    }
  }
  return () => controller.abort()
}
