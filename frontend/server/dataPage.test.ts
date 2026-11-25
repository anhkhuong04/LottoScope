// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createDataHandler } from './dataPage.js'
import { handleBotMiddleware, isAiCrawler } from './botMiddleware.js'

const config = {
  origin: 'https://lottoscope-test.onrender.com',
  token: 'not-a-real-origin-token-for-tests-123456',
}

function mockGamesFetch(override?: (url: URL) => Response | undefined) {
  return vi.fn<typeof fetch>().mockImplementation(async (input) => {
    const url = new URL(String(input))
    const overridden = override?.(url)
    if (overridden) return overridden
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
          {
            id: 'power_655',
            label: 'Power 6/55',
            main_count: 6,
            main_min: 1,
            main_max: 55,
            special_min: 1,
            special_max: 55,
          },
        ],
      })
    }
    if (p.endsWith('/draws')) {
      const isLotto = p.includes('lotto_535')
      const page = Number(url.searchParams.get('page') ?? '1')
      const pageSize = Number(url.searchParams.get('page_size') ?? '20')
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
        page,
        page_size: pageSize,
        total: 150,
      })
    }
    if (p.endsWith('/analytics/numbers')) {
      const isSpecial = url.searchParams.get('number_kind') === 'special'
      return Response.json({
        context: {
          game: p.includes('lotto_535') ? 'lotto_535' : 'mega_645',
          analysis_window:
            url.searchParams.get('window') === 'date_range'
              ? {
                  kind: 'date_range',
                  from_date: url.searchParams.get('from_date'),
                  to_date: url.searchParams.get('to_date'),
                }
              : { kind: 'last_draws', count: Number(url.searchParams.get('count') ?? '30') },
          as_of_draw_id:
            url.searchParams.get('as_of_draw_id') ?? (p.includes('lotto_535') ? '00900' : '01200'),
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
      const page = Number(url.searchParams.get('page') ?? '1')
      const pageSize = Number(url.searchParams.get('page_size') ?? '25')
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
        page,
        page_size: pageSize,
        total: 80,
      })
    }
    return new Response('not found', { status: 404 })
  })
}

describe('static AI data page handler', () => {
  it('skips the unsupported Power special analytics request', async () => {
    const upstream = mockGamesFetch()
    const handler = createDataHandler(config, upstream)
    const response = await handler(
      new Request('https://lottoscope-sable.vercel.app/data/power_655'),
    )
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('Power 6/55')
    expect(html).toContain('Main Number Frequency')
    expect(html).not.toContain('Special Number Frequency')
    const calls = upstream.mock.calls.map(([input]) => new URL(String(input)))
    expect(calls).toHaveLength(4)
    expect(calls.some((url) => url.searchParams.get('number_kind') === 'main')).toBe(true)
    expect(calls.some((url) => url.searchParams.get('number_kind') === 'special')).toBe(false)
  })

  it('renders semantic HTML with Edge Cache headers and pagination links', async () => {
    const upstream = mockGamesFetch()
    const handler = createDataHandler(config, upstream)
    const response = await handler(
      new Request(
        'https://lottoscope-sable.vercel.app/data/mega_645?count=30&draw_limit=50&draw_page=2&pair_limit=20&pair_page=2',
      ),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=300')
    expect(response.headers.get('Vary')).toContain('User-Agent')
    const html = await response.text()
    expect(html).toContain('Mega 6/45')
    expect(html).toContain('Page 2/3, Total: 150')
    expect(html).toContain('Page 2/4, Total: 80')
    expect(html).toContain('Previous draws')
    expect(html).toContain('Next draws')
    expect(html).toContain('Previous pairs')
    expect(html).toContain('Next pairs')
    const [, init] = upstream.mock.calls[0]!
    expect(init?.headers).toMatchObject({ 'X-Lotto-Origin-Token': config.token })
  })

  it('separates count from draw_limit and forwards date_range and as_of_draw_id', async () => {
    const upstream = mockGamesFetch()
    const handler = createDataHandler(config, upstream)
    const response = await handler(
      new Request(
        'https://lottoscope-sable.vercel.app/data/lotto_535?from_date=2026-01-01&to_date=2026-11-23&as_of_draw_id=00888&draw_limit=100&draw_sort=asc&format=md',
      ),
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/markdown')
    const md = await response.text()
    expect(md).toContain('2026-01-01 to 2026-11-23 (through 00888)')
    expect(md).toContain('Draws slice: page 1, limit 100, sort asc')
    expect(md).toContain(
      'Special Number Frequency & Gaps (01-12, 2026-01-01 to 2026-11-23 (through 00888))',
    )
    expect(md).not.toContain('## Mega 6/45')

    const calledUrls = upstream.mock.calls.map(([u]) => String(u))
    expect(calledUrls).toContainEqual(
      expect.stringContaining(
        '/draws?page=1&page_size=100&sort=asc&from_date=2026-01-01&to_date=2026-11-23',
      ),
    )
    expect(calledUrls).toContainEqual(
      expect.stringContaining(
        '/analytics/numbers?window=date_range&from_date=2026-01-01&to_date=2026-11-23&as_of_draw_id=00888',
      ),
    )
  })

  it('supports CSV format for draws, numbers, special, and pairs', async () => {
    const upstream = mockGamesFetch()
    const handler = createDataHandler(config, upstream)

    const drawsCsv = await handler(
      new Request('https://lottoscope-sable.vercel.app/data/lotto_535?format=csv&section=draws'),
    )
    expect(drawsCsv.status).toBe(200)
    expect(drawsCsv.headers.get('Content-Type')).toContain('text/csv')
    expect(drawsCsv.headers.get('Content-Disposition')).toContain('lottoscope-lotto_535-draws.csv')
    expect(await drawsCsv.text()).toBe(
      'game,draw_id,draw_date,draw_time,main_numbers,special_number\nlotto_535,00900,2026-11-23,18:00:00,01 05 12 23 35,07',
    )

    const pairsCsv = await handler(
      new Request('https://lottoscope-sable.vercel.app/data/mega_645?format=csv&section=pairs'),
    )
    expect(pairsCsv.status).toBe(200)
    expect(await pairsCsv.text()).toBe(
      'game,rank,pair,frequency,percent_of_draws,current_gap,last_seen_draw_id\nmega_645,1,05-12,4,13.3,1,00899',
    )
  })

  it.each([
    ['GET', 'draws', '/draws', null],
    ['HEAD', 'draws', '/draws', null],
    ['GET', 'numbers', '/analytics/numbers', 'main'],
    ['HEAD', 'numbers', '/analytics/numbers', 'main'],
    ['GET', 'pairs', '/analytics/pairs', null],
    ['GET', 'special', '/analytics/numbers', 'special'],
  ])(
    'returns an uncached 503 for %s CSV %s when its source fails',
    async (method, section, path, kind) => {
      const upstream = mockGamesFetch((url) =>
        url.pathname.endsWith(path) && url.searchParams.get('number_kind') === kind
          ? Response.json({ error: 'source failure' }, { status: 500 })
          : undefined,
      )
      const response = await createDataHandler(
        config,
        upstream,
      )(
        new Request(
          `https://lottoscope-sable.vercel.app/data/lotto_535?format=csv&section=${section}`,
          {
            method,
          },
        ),
      )
      expect(response.status).toBe(503)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(response.headers.get('Retry-After')).toBe('30')
      expect(response.headers.get('Content-Disposition')).toBeNull()
      const body = await response.text()
      if (method === 'HEAD') expect(body).toBe('')
      else expect(body).toContain('temporarily unavailable')
    },
  )

  it('exports a legitimately empty CSV without reading other sections', async () => {
    const upstream = mockGamesFetch((url) =>
      url.pathname.endsWith('/analytics/pairs')
        ? Response.json({ items: [] })
        : url.pathname.endsWith('/games')
          ? undefined
          : Response.json({ error: 'unrelated failure' }, { status: 500 }),
    )
    const response = await createDataHandler(
      config,
      upstream,
    )(new Request('https://lottoscope-sable.vercel.app/data/lotto_535?format=csv&section=pairs'))
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('public')
    expect(await response.text()).toBe(
      'game,rank,pair,frequency,percent_of_draws,current_gap,last_seen_draw_id',
    )
    expect(upstream.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/api/v1/games',
      '/api/v1/games/lotto_535/analytics/pairs',
    ])
  })

  it('returns an empty special CSV for Power without reading any draw or analytics data', async () => {
    const upstream = mockGamesFetch()
    const response = await createDataHandler(
      config,
      upstream,
    )(new Request('https://lottoscope-sable.vercel.app/data/power_655?format=csv&section=special'))
    expect(response.status).toBe(200)
    expect((await response.text()).split('\n')).toHaveLength(1)
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it('rejects an all-games CSV if the requested section fails for one game', async () => {
    const upstream = mockGamesFetch((url) =>
      url.pathname.endsWith('/mega_645/analytics/pairs')
        ? Response.json({ error: 'source failure' }, { status: 500 })
        : undefined,
    )
    const response = await createDataHandler(
      config,
      upstream,
    )(new Request('https://lottoscope-sable.vercel.app/data?format=csv&section=pairs'))
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('rejects invalid methods, malformed dates, unknown games, and unconfigured origin without caching errors', async () => {
    const upstream = mockGamesFetch()
    const handler = createDataHandler(config, upstream)
    expect(
      (await handler(new Request('https://lottoscope-sable.vercel.app/data', { method: 'POST' })))
        .status,
    ).toBe(405)
    expect(
      (await handler(new Request('https://lottoscope-sable.vercel.app/data/unknown_game'))).status,
    ).toBe(404)
    expect(
      (
        await handler(
          new Request('https://lottoscope-sable.vercel.app/data/mega_645?from_date=not-a-date'),
        )
      ).status,
    ).toBe(400)
    expect(
      (
        await handler(
          new Request(
            'https://lottoscope-sable.vercel.app/data/mega_645?window=date_range&from_date=2026-01-01',
          ),
        )
      ).status,
    ).toBe(400)
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
