import { parseOptions } from './dataQuery.js'
import { renderCsv, renderHtml, renderMarkdown } from './dataRender.js'
import { textError } from './dataResponse.js'
import { loadCsvSnapshot, loadGames, loadSnapshot } from './dataSnapshot.js'
import { validateOriginConfig, type OriginConfig } from './originConfig.js'

type Fetch = typeof fetch
const EDGE_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'

export function createDataHandler(
  config: OriginConfig,
  fetchOrigin: Fetch = fetch,
  timeoutMs = 60_000,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return textError(405, 'Method not allowed')
    }

    let origin: URL
    let token: string
    try {
      const validated = validateOriginConfig(config)
      origin = validated.origin
      token = validated.token
    } catch {
      return textError(503, 'Service configuration is incomplete.')
    }

    const parsed = parseOptions(request)
    if (parsed instanceof Response) {
      return parsed
    }

    const deadline = AbortSignal.timeout(timeoutMs)
    const signal = AbortSignal.any([deadline, request.signal])

    try {
      const gamesRes = await loadGames(origin, token, fetchOrigin, signal)
      const targetGames = parsed.selectedGame
        ? gamesRes.items.filter((g) => g.id === parsed.selectedGame)
        : gamesRes.items

      if (targetGames.length === 0) {
        return textError(404, 'No matching games found.')
      }

      let body: string
      if (parsed.format === 'csv') {
        const snapshots = await Promise.all(
          targetGames.map((game) =>
            loadCsvSnapshot(origin, token, game, parsed, fetchOrigin, signal),
          ),
        )
        body = renderCsv(snapshots, parsed)
      } else {
        const snapshots = await Promise.all(
          targetGames.map((game) => loadSnapshot(origin, token, game, parsed, fetchOrigin, signal)),
        )
        body =
          parsed.format === 'md' ? renderMarkdown(snapshots, parsed) : renderHtml(snapshots, parsed)
      }

      const contentType =
        parsed.format === 'csv'
          ? 'text/csv; charset=utf-8'
          : parsed.format === 'md'
            ? 'text/markdown; charset=utf-8'
            : 'text/html; charset=utf-8'

      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Cache-Control': EDGE_CACHE_CONTROL,
        Vary: 'User-Agent, Accept',
        'X-Content-Type-Options': 'nosniff',
      }
      if (parsed.format === 'csv') {
        headers['Content-Disposition'] =
          `inline; filename="lottoscope-${parsed.selectedGame ?? 'all'}-${parsed.section}.csv"`
      }

      return new Response(request.method === 'HEAD' ? null : body, {
        status: 200,
        headers,
      })
    } catch {
      return textError(
        503,
        request.method === 'HEAD'
          ? null
          : 'Data service is starting or temporarily unavailable. Please retry shortly.',
        '30',
      )
    }
  }
}
