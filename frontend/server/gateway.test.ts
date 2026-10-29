// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createGateway } from './gateway.ts'

const config = {
  origin: 'https://lottoscope-test.onrender.com',
  token: 'not-a-real-origin-token-for-tests-123456',
}
const api = 'https://lottoscope-test.vercel.app/api/v1'

describe('cloud gateway', () => {
  it('keeps path, query and JSON precise, and replaces browser credentials', async () => {
    const upstream = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { error: { code: 'sync_cooldown', message: 'Wait', details: {} } },
          { status: 429, headers: { 'Retry-After': '60', 'Set-Cookie': 'private=secret' } },
        ),
      )
    const gateway = createGateway(config, upstream)
    const response = await gateway(
      new Request(`${api}/games/power_655/sync?count=30&game=power_655`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer browser-secret',
          Cookie: 'browser=secret',
          'X-Lotto-Origin-Token': 'spoofed',
        },
        body: '{"amount_vnd":"9007199254740993"}',
      }),
    )
    expect(upstream).toHaveBeenCalledOnce()
    const [target, init] = upstream.mock.calls[0]!
    expect(String(target)).toBe(
      `${config.origin}/api/v1/games/power_655/sync?count=30&game=power_655`,
    )
    expect(new TextDecoder().decode(init!.body as Uint8Array)).toBe(
      '{"amount_vnd":"9007199254740993"}',
    )
    expect(init!.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Lotto-Origin-Token': config.token,
    })
    expect(init!.redirect).toBe('manual')
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(response.headers.has('Set-Cookie')).toBe(false)
    expect(await response.json()).toMatchObject({ error: { code: 'sync_cooldown' } })
  })

  it('does not contact the origin for non-API paths, methods or missing configuration', async () => {
    const upstream = vi.fn<typeof fetch>()
    expect((await createGateway(config, upstream)(new Request(`${api}/../other`))).status).toBe(404)
    expect(
      (await createGateway(config, upstream)(new Request(`${api}/games`, { method: 'DELETE' })))
        .status,
    ).toBe(405)
    for (const invalid of [
      {},
      { ...config, token: '' },
      { ...config, origin: 'http://example.test' },
      { ...config, origin: 'https://example.test/private' },
      { ...config, origin: 'https://user:password@example.test' },
    ]) {
      const response = await createGateway(invalid, upstream)(new Request(`${api}/games`))
      expect(response.status).toBe(503)
    }
    expect(upstream).not.toHaveBeenCalled()
  })

  it('rejects oversized streamed bodies even without a Content-Length header', async () => {
    const upstream = vi.fn<typeof fetch>()
    const response = await createGateway(
      config,
      upstream,
    )(
      new Request(`${api}/games/mega_645/combinations/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'x'.repeat(65_537),
      }),
    )
    expect(response.status).toBe(413)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('rejects non-JSON input before contacting the origin', async () => {
    const upstream = vi.fn<typeof fetch>()
    const response = await createGateway(
      config,
      upstream,
    )(new Request(`${api}/games/mega_645/sync`, { method: 'POST', body: '{}' }))
    expect(response.status).toBe(415)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('turns Render loading HTML and redirects into JSON without leaking the response', async () => {
    for (const status of [200, 302, 503]) {
      const upstream = vi.fn<typeof fetch>().mockResolvedValue(
        new Response('<html>private origin page</html>', {
          status,
          headers: { 'Content-Type': 'text/html', Location: 'https://other.test' },
        }),
      )
      const response = await createGateway(config, upstream)(new Request(`${api}/games`))
      expect(response.status).toBe(503)
      expect(await response.json()).toMatchObject({ error: { code: 'backend_starting' } })
      expect(upstream).toHaveBeenCalledOnce()
      expect(response.headers.has('Location')).toBe(false)
    }
  })

  it('returns timeout without retrying a write whose outcome is unknown', async () => {
    const upstream = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      await new Promise<void>((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      })
      throw new Error('unreachable')
    })
    const response = await createGateway(
      config,
      upstream,
      5,
    )(
      new Request(`${api}/games/lotto_535/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
    )
    expect(response.status).toBe(504)
    expect(await response.json()).toMatchObject({ error: { code: 'gateway_timeout' } })
    expect(upstream).toHaveBeenCalledOnce()
  })
})
