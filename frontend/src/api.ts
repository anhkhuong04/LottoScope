export type Game = {
  id: string
  label: string
  main_count: number
  main_min: number
  main_max: number
  special_min: number | null
  special_max: number | null
}
export type Draw = {
  draw_id: string
  draw_date: string
  draw_time: string | null
  main_numbers: number[]
  special_number: number | null
  source_url: string
  source_retrieved_at: string
}
export type Page<T> = { items: T[]; page: number; page_size: number; total: number }
export type AnalysisWindow =
  | { kind: 'last_draws'; count: number }
  | { kind: 'date_range'; from_date: string; to_date: string }
  | { kind: 'all_time' }
export type Context = {
  game: string
  analysis_window: AnalysisWindow
  as_of_draw_id: string | null
  actual_draw_count: number
  data_version: number
}
export type NumberMetric = {
  number: number
  frequency: number
  frequency_percent: number | null
  frequency_rank: number
  current_gap: number | null
  average_gap: number | null
  max_gap: number | null
  last_seen_draw_id: string | null
}
export type PairMetric = {
  numbers: [number, number]
  frequency: number
  percent_of_draws: number | null
  current_gap: number | null
  average_gap: number | null
  max_gap: number | null
  last_seen_draw_id: string | null
}
export type NumbersResponse = { context: Context; items: NumberMetric[] }
export type PairsResponse = Page<PairMetric> & { context: Context }
export type NumberDetail = {
  context: Context
  metrics: NumberMetric
  appearance_draws: Page<Draw>
  timeline_draw_ids: string[]
  pair_partners: PairMetric[]
}
export type PairDetail = {
  context: Context
  metrics: PairMetric
  appearance_draws: Page<Draw>
  timeline_draw_ids: string[]
}
export type Status = {
  latest_draw_id: string | null
  latest_draw_date: string | null
  last_successful_ingestion_at: string | null
  last_failed_ingestion_at: string | null
  data_version: number
}
export type CheckResponse = {
  context: Context
  main_numbers: number[]
  history_draw_count: number
  exact_match_count: number
  last_exact_match: Draw | null
  overlap_histogram: Record<string, number>
  similar_draws: Page<{ draw: Draw; overlap_count: number }>
  number_analysis: NumberMetric[]
  pair_analysis: PairMetric[]
}
export type RuleResult = { rule_id: string; threshold: unknown; observed: unknown; passed: boolean }
export type GeneratedItem = {
  main_numbers: number[]
  explanation: {
    number_frequency: { number: number; frequency: number; current_gap: number | null }[]
    current_gaps: { number: number; frequency: number; current_gap: number | null }[]
    historical_pairs: { numbers: [number, number]; frequency: number }[]
    exact_match_within_days: number | null
    maximum_recent_overlap: number | null
    rule_results: RuleResult[]
  }
}
export type GenerateResponse = {
  context: Context
  reference_date: string
  algorithm_version: string
  seed: number
  requested_count: number
  generated_count: number
  attempted_count: number
  status: 'complete' | 'partial'
  reason: string | null
  items: GeneratedItem[]
}

export class ApiError extends Error {
  kind: 'network' | 'server' | 'invalid' | 'missing'
  status?: number
  constructor(
    kind: 'network' | 'server' | 'invalid' | 'missing',
    message: string,
    status?: number,
  ) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

export async function api<T>(path: string, signal?: AbortSignal, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, {
      signal,
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError('network', 'Không kết nối được API. Kiểm tra mạng hoặc backend.')
  }
  if (!response.ok) {
    let payload: { error?: { message?: string } } = {}
    try {
      payload = await response.json()
    } catch {
      /* Server may not return JSON. */
    }
    const kind =
      response.status === 422 ? 'invalid' : response.status === 404 ? 'missing' : 'server'
    throw new ApiError(
      kind,
      payload.error?.message ?? `API trả về HTTP ${response.status}.`,
      response.status,
    )
  }
  return response.json() as Promise<T>
}

export function params(values: Record<string, string | number | null | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values))
    if (value !== null && value !== undefined && value !== '') query.set(key, String(value))
  return query.toString()
}

export function windowQuery(window: AnalysisWindow): Record<string, string | number> {
  if (window.kind === 'last_draws') return { window: 'last_draws', count: window.count }
  if (window.kind === 'date_range')
    return { window: 'date_range', from_date: window.from_date, to_date: window.to_date }
  return { window: 'all_time' }
}

export function globalSearch(game: string, window: AnalysisWindow): string {
  return `?${params({ game, ...windowQuery(window) })}`
}
