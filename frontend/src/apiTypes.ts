export type Game = {
  id: string
  label: string
  main_count: number
  main_min: number
  main_max: number
  special_min: number | null
  special_max: number | null
}
export type SyncResult = {
  game: string
  run_id: number
  status: 'success' | 'partial' | 'failed'
  created: number
  enriched: number
  unchanged: number
  remaining_unresolved: number
  source?: 'official' | 'community'
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
export type PrizeMatch = { main_count: number; special: boolean }
export type PrizeTier = {
  name: string
  matches: PrizeMatch[]
  winner_count: number
  amount_vnd: string
}
export type PrizeDetails = {
  draw_id: string
  items: PrizeTier[]
  currency: 'VND'
  source_url: string
  source_retrieved_at: string | null
}
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
  frequency_rank: number
}
export type NumbersResponse = {
  context: Context
  items: NumberMetric[]
  number_kind: 'main' | 'special'
}
export type PairsResponse = Page<PairMetric> & { context: Context }
export type NumberDetail = {
  context: Context
  metrics: NumberMetric
  appearance_draws: Page<Draw>
  timeline_draw_ids: string[]
  pair_partners: PairMetric[]
  number_kind: 'main' | 'special'
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
