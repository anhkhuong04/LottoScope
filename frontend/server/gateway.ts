type Config = { origin?: string; token?: string }
type Fetch = typeof fetch
const MAX_BODY_BYTES = 64 * 1024

function error(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message, details: {} } },
    { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
  )
}

export function createGateway(config: Config, fetchOrigin: Fetch = fetch, timeoutMs = 270_000) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/v1/'))
      return error(404, 'not_found', 'Resource was not found')
    if (!['GET', 'POST'].includes(request.method))
      return error(405, 'method_not_allowed', 'HTTP method is not supported')

    let origin: URL
    try {
      origin = new URL(config.origin ?? '')
      if (
        origin.protocol !== 'https:' ||
        origin.username ||
        origin.password ||
        origin.pathname !== '/' ||
        origin.search ||
        origin.hash ||
        !config.token ||
        config.token.length < 32
      )
        throw new Error('Invalid gateway configuration')
    } catch {
      return error(503, 'gateway_not_configured', 'Dịch vụ chưa được cấu hình hoàn tất.')
    }

    let body: Uint8Array<ArrayBuffer> | undefined
    if (request.method === 'POST') {
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? ''))
        return error(415, 'invalid_content_type', 'JSON request body is required')
      if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES)
        return error(413, 'body_too_large', 'Request body is too large')
      const reader = request.body?.getReader()
      const chunks: Uint8Array[] = []
      let length = 0
      try {
        while (reader) {
          const { done, value } = await reader.read()
          if (done) break
          length += value.byteLength
          if (length > MAX_BODY_BYTES) {
            await reader.cancel()
            return error(413, 'body_too_large', 'Request body is too large')
          }
          chunks.push(value)
        }
      } catch {
        return error(400, 'invalid_request', 'Request body could not be read')
      } finally {
        reader?.releaseLock()
      }
      body = new Uint8Array(length)
      let offset = 0
      for (const chunk of chunks) {
        body.set(chunk, offset)
        offset += chunk.byteLength
      }
    }

    const deadline = AbortSignal.timeout(timeoutMs)
    try {
      // Only the configured origin and these headers are trusted. Never forward
      // browser credentials, cookies, spoofed origin tokens or arbitrary targets.
      const upstream = await fetchOrigin(new URL(url.pathname + url.search, origin), {
        method: request.method,
        body,
        headers: {
          Accept: 'application/json',
          'X-Lotto-Origin-Token': config.token!,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.any([deadline, request.signal]),
      })
      if (!upstream.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
        await upstream.body?.cancel()
        return error(
          503,
          'backend_starting',
          'Dịch vụ đang khởi động hoặc tạm thời chưa sẵn sàng. Vui lòng thử lại sau khoảng một phút.',
        )
      }
      const headers = new Headers({
        'Content-Type': upstream.headers.get('Content-Type')!,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      const retryAfter = upstream.headers.get('Retry-After')
      if (retryAfter) headers.set('Retry-After', retryAfter)
      return new Response(upstream.body, { status: upstream.status, headers })
    } catch {
      return deadline.aborted
        ? error(
            504,
            'gateway_timeout',
            'Chưa nhận được kết quả trong thời gian chờ. Đồng bộ có thể vẫn đang chạy; hãy làm mới hiển thị trước khi thử lại.',
          )
        : error(502, 'backend_unavailable', 'Không kết nối được dịch vụ. Vui lòng thử lại sau.')
    }
  }
}
