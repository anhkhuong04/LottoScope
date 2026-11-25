import type { AnalysisWindow } from './apiTypes'

export type * from './apiTypes'

export class ApiError extends Error {
  kind: 'network' | 'server' | 'invalid' | 'missing'
  status?: number
  code?: string
  constructor(
    kind: 'network' | 'server' | 'invalid' | 'missing',
    message: string,
    status?: number,
    code?: string,
  ) {
    super(message)
    this.kind = kind
    this.status = status
    this.code = code
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
    throw new ApiError('network', 'Unable to connect to API. Please check your network or backend.')
  }
  if (!response.ok) {
    let payload: { error?: { message?: string; code?: string } } = {}
    try {
      payload = await response.json()
    } catch {
      /* Server may not return JSON. */
    }
    const kind =
      response.status === 422 ? 'invalid' : response.status === 404 ? 'missing' : 'server'
    throw new ApiError(
      kind,
      payload.error?.message ?? `API returned HTTP ${response.status}.`,
      response.status,
      payload.error?.code,
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
