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

export async function loadSnapshot(
  origin: URL,
  token: string,
  game: Game,
  opts: DataQueryOptions,
  fetchOrigin: Fetch,
  signal: AbortSignal,
): Promise<GameSnapshot> {
  const windowQuery = buildAnalyticsQuery(opts)
  const drawsQuery = buildDrawsQuery(opts)

  const [drawsRes, numbersRes, pairsRes, specialRes] = await Promise.allSettled([
    fetchOriginJson<Page<DrawItem>>(
      origin,
      token,
      `/games/${game.id}/draws?${drawsQuery}`,
      fetchOrigin,
      signal,
    ),
    fetchOriginJson<{ context: Context; items: NumberMetric[] }>(
      origin,
      token,
      `/games/${game.id}/analytics/numbers?${windowQuery}&number_kind=main&sort=frequency_desc`,
      fetchOrigin,
      signal,
    ),
    fetchOriginJson<{ context: Context } & Page<PairMetricItem>>(
      origin,
      token,
      `/games/${game.id}/analytics/pairs?${windowQuery}&page=${opts.pairPage}&page_size=${opts.pairLimit}&sort=frequency_desc`,
      fetchOrigin,
      signal,
    ),
    game.special_min !== null
      ? fetchOriginJson<{ context: Context; items: NumberMetric[] }>(
          origin,
          token,
          `/games/${game.id}/analytics/numbers?${windowQuery}&number_kind=special&sort=frequency_desc`,
          fetchOrigin,
          signal,
        )
      : Promise.resolve(null),
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
