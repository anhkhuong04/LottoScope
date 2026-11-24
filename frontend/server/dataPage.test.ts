// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createDataHandler } from './dataPage.js'
import { handleBotMiddleware, isAiCrawler } from './botMiddleware.js'

const config = {
  origin: 'https://lottoscope-test.onrender.com',
  token: 'not-a-real-origin-token-for-tests-123456',
}

function mockGamesFetch() {
  return vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const url = new URL(String(input))
    const p = url.pathname
    if (p === '/api/v1/games') {
      return Response.json({
        items: [
          {
            id: 'lotto_535',
            label: 'Lotto 5/35',
            main_count: 5,
            main_min: 1,
            main_max: 35,
            special_min: 1,
            special_max: 12,
          },
          {
            id: 'mega_645',
            label: 'Mega 6/45',
            main_count: 6,
            main_min: 1,
            main_max: 45,
            special_min: null,
            special_max: null,
          },
        ],
      })
    }
    if (p.endsWith('/draws')) {
      const isLotto = p.includes('lotto_535')
      return Response.json({
        items: [
          {
            draw_id: isLotto ? '00900' : '01200',
            draw_date: '2026-11-23',
            draw_time: '18:00:00',
            main_numbers: isLotto ? [1, 5, 12, 23, 35] : [2, 11, 18, 25, 33, 44],
            special_number: isLotto ? 7 : null,
          },
        ],
      })
    }
    if (p.endsWith('/analytics/numbers')) {
      const isSpecial = url.searchParams.get('number_kind') === 'special'
      return Response.json({
        context: {
          game: p.includes('lotto_535') ? 'lotto_535' : 'mega_645',
          analysis_window: { kind: 'last_draws', count: 30 },
          as_of_draw_id: p.includes('lotto_535') ? '00900' : '01200',
          actual_draw_count: 30,
          data_version: 42,
        },
        items: [
          {
            number: isSpecial ? 7 : 12,
            frequency: 8,
            frequency_percent: 26.7,
            frequency_rank: 1,
            current_gap: 0,
            average_gap: 3.5,
            max_gap: 9,
            last_seen_draw_id: isSpecial ? '00900' : '01200',
          },
        ],
      })
    }
    if (p.endsWith('/analytics/pairs')) {
      return Response.json({
        context: {
          game: p.includes('lotto_535') ? 'lotto_535' : 'mega_645',
          analysis_window: { kind: 'last_draws', count: 30 },
          as_of_draw_id: '00900',
          actual_draw_count: 30,
          data_version: 42,
        },
        items: [
          {
            numbers: [5, 12],
            frequency: 4,
            percent_of_draws: 13.3,
            current_gap: 1,
            last_seen_draw_id: '00899',
            frequency_rank: 1,
          },
        ],
      })
    }
    return new Response('not found', { status: 404 })
  })
}

describe('static AI data page handler', () => {
  it('renders semantic HTML with Edge Cache headers for all games', async () => {
    const upstream = mockGamesFetch()
    const handler = createDataHandler(config, upstream)
    const response = await handler(new Request('https://lottoscope-sable.vercel.app/data'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=300')
    expect(response.headers.get('Vary')).toContain('User-Agent')
    const html = await response.text()
    expect(html).toContain('Lotto 5/35')
    expect(html).toContain('Mega 6/45')
    expect(html).toContain('01 05 12 23 35')
    expect(html).toContain('Special Number Frequency')
    const [, init] = upstream.mock.calls[0]!
    expect(init?.headers).toMatchObject({ 'X-Lotto-Origin-Token': config.token })
  })

  it('supports single-game markdown format and preserves special separation', async () => {
    const upstream = mockGamesFetch()
    const handler = createDataHandler(config, upstream)
    const response = await handler(
      new Request('https://lottoscope-sable.vercel.app/data/lotto_535?format=md&count=10'),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/markdown')
    const md = await response.text()
    expect(md).toContain('# LottoScope — Historical Vietlott Analysis')
    expect(md).toContain('Analysis window: Last 10 draws')
    expect(md).toContain('Special Number Frequency & Gaps (01-12, Last 10 draws)')
    expect(md).not.toContain('## Mega 6/45')
  })

  it('rejects invalid methods, unknown games, and unconfigured origin without caching errors', async () => {
    const upstream = mockGamesFetch()
    const handler = createDataHandler(config, upstream)
    expect(
      (await handler(new Request('https://lottoscope-sable.vercel.app/data', { method: 'POST' })))
        .status,
    ).toBe(405)
    expect(
      (await handler(new Request('https://lottoscope-sable.vercel.app/data/unknown_game'))).status,
    ).toBe(404)
    expect(upstream).not.toHaveBeenCalled()

    const badUpstream = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('<html>Render starting</html>', {
        status: 503,
        headers: { 'Content-Type': 'text/html' },
      }),
    )
    const errRes = await createDataHandler(
      config,
      badUpstream,
    )(new Request('https://lottoscope-sable.vercel.app/data'))
    expect(errRes.status).toBe(503)
    expect(errRes.headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('AI bot edge middleware', () => {
  it('rewrites AI crawlers on root/HTML paths to /api/data and passes browsers through', () => {
    expect(isAiCrawler('Mozilla/5.0 AppleWebKit/537.36 (compatible; ChatGPT-User/1.0)')).toBe(true)
    expect(isAiCrawler('OAI-SearchBot/1.0; +https://openai.com/searchbot')).toBe(true)
    expect(isAiCrawler('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0')).toBe(false)

    const botRes = handleBotMiddleware(
      new Request('https://lottoscope-sable.vercel.app/?count=20', {
        headers: { 'User-Agent': 'ChatGPT-User/1.0' },
      }),
    )
    expect(botRes.headers.get('x-middleware-rewrite')).toBe(
      'https://lottoscope-sable.vercel.app/api/data?count=20',
    )

    const browserRes = handleBotMiddleware(
      new Request('https://lottoscope-sable.vercel.app/', {
        headers: { 'User-Agent': 'Mozilla/5.0 Chrome/130.0.0.0' },
      }),
    )
    expect(browserRes.headers.get('x-middleware-rewrite')).toBeNull()
    expect(browserRes.headers.get('x-middleware-next')).toBe('1')
  })
})
