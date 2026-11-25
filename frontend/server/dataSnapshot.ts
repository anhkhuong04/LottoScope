import type { Context, Draw, Game, NumberMetric, Page, PairMetric } from '../src/apiTypes.js'
import { buildAnalyticsQuery, buildDrawsQuery, type DataQueryOptions } from './dataQuery.js'
import { buildOriginHeaders } from './originConfig.js'

type Fetch = typeof fetch
type DrawItem = Pick<
  Draw,
  'draw_id' | 'draw_date' | 'draw_time' | 'main_numbers' | 'special_number'
>
type PairMetricItem = Omit<PairMetric, 'average_gap' | 'max_gap'>

export type GameSnapshot = {
  game: Game
  draws: Page<DrawItem>
  numbers: { context: Context; items: NumberMetric[] } | null
  specialNumbers: { context: Context; items: NumberMetric[] } | null
  pairs: ({ context: Context } & Page<PairMetricItem>) | null
}

export type CsvSnapshot = Pick<GameSnapshot, 'game'> & Partial<Omit<GameSnapshot, 'game'>>

async function fetchOriginJson<T>(
  origin: URL,
  token: string,
  path: string,
  fetchOrigin: Fetch,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetchOrigin(new URL(`/api/v1${path}`, origin), {
    method: 'GET',
    headers: buildOriginHeaders(token),
    redirect: 'manual',
    cache: 'no-store',
    signal,
  })
  const contentType = response.headers.get('Content-Type')?.toLowerCase() ?? ''
  if (!contentType.includes('application/json')) {
    await response.body?.cancel()
    throw new Error('upstream_unavailable')
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`upstream_http_${response.status}`)
  }
  return (await response.json()) as T
}

export function loadGames(origin: URL, token: string, fetchOrigin: Fetch, signal: AbortSignal) {
  return fetchOriginJson<{ items: Game[] }>(origin, token, '/games', fetchOrigin, signal)
}

function gameDataSource(
  origin: URL,
  token: string,
  game: Game,
  opts: DataQueryOptions,
  fetchOrigin: Fetch,
  signal: AbortSignal,
) {
  const windowQuery = buildAnalyticsQuery(opts)
  const drawsQuery = buildDrawsQuery(opts)
  const read = <T>(path: string) =>
    fetchOriginJson<T>(origin, token, `/games/${game.id}${path}`, fetchOrigin, signal)

  return {
    draws: () => read<Page<DrawItem>>(`/draws?${drawsQuery}`),
    numbers: (kind: 'main' | 'special') =>
      read<NonNullable<GameSnapshot['numbers']>>(
        `/analytics/numbers?${windowQuery}&number_kind=${kind}&sort=frequency_desc`,
      ),
    pairs: () =>
      read<NonNullable<GameSnapshot['pairs']>>(
        `/analytics/pairs?${windowQuery}&page=${opts.pairPage}&page_size=${opts.pairLimit}&sort=frequency_desc`,
      ),
  }
}

export async function loadSnapshot(
  origin: URL,
  token: string,
  game: Game,
  opts: DataQueryOptions,
  fetchOrigin: Fetch,
  signal: AbortSignal,
): Promise<GameSnapshot> {
  const source = gameDataSource(origin, token, game, opts, fetchOrigin, signal)
  const [drawsRes, numbersRes, pairsRes, specialRes] = await Promise.allSettled([
    source.draws(),
    source.numbers('main'),
    source.pairs(),
    game.id === 'lotto_535' ? source.numbers('special') : Promise.resolve(null),
  ])

  if (drawsRes.status === 'rejected') {
    throw drawsRes.reason
  }

  return {
    game,
    draws: drawsRes.value,
    numbers: numbersRes.status === 'fulfilled' ? numbersRes.value : null,
    pairs: pairsRes.status === 'fulfilled' ? pairsRes.value : null,
    specialNumbers: specialRes.status === 'fulfilled' ? specialRes.value : null,
  }
}

async function requireItems<T extends { items: unknown[] }>(request: Promise<T>): Promise<T> {
  const data = await request
  if (!Array.isArray(data?.items)) throw new Error('upstream_missing_items')
  return data
}

export async function loadCsvSnapshot(
  origin: URL,
  token: string,
  game: Game,
  opts: DataQueryOptions,
  fetchOrigin: Fetch,
  signal: AbortSignal,
): Promise<CsvSnapshot> {
  const source = gameDataSource(origin, token, game, opts, fetchOrigin, signal)
  switch (opts.section) {
    case 'draws':
      return { game, draws: await requireItems(source.draws()) }
    case 'numbers':
      return { game, numbers: await requireItems(source.numbers('main')) }
    case 'special':
      return game.id === 'lotto_535'
        ? { game, specialNumbers: await requireItems(source.numbers('special')) }
        : { game }
    case 'pairs':
      return { game, pairs: await requireItems(source.pairs()) }
  }
}
