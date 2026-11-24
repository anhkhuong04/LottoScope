import { buildOriginHeaders, validateOriginConfig, type OriginConfig } from './originConfig.js'

type Fetch = typeof fetch

type GameItem = {
  id: string
  label: string
  main_count: number
  main_min: number
  main_max: number
  special_min: number | null
  special_max: number | null
}

type DrawItem = {
  draw_id: string
  draw_date: string
  draw_time: string | null
  main_numbers: number[]
  special_number: number | null
}

type ContextMeta = {
  game: string
  analysis_window:
    | { kind: 'last_draws'; count: number }
    | { kind: 'all_time' }
    | { kind: 'date_range'; from_date: string; to_date: string }
  as_of_draw_id: string | null
  actual_draw_count: number
  data_version: number
}

type NumberMetricItem = {
  number: number
  frequency: number
  frequency_percent: number | null
  frequency_rank: number
  current_gap: number | null
  average_gap: number | null
  max_gap: number | null
  last_seen_draw_id: string | null
}

type PairMetricItem = {
  numbers: [number, number]
  frequency: number
  percent_of_draws: number | null
  current_gap: number | null
  last_seen_draw_id: string | null
  frequency_rank: number
}

type GameSnapshot = {
  game: GameItem
  draws: DrawItem[]
  numbers: { context: ContextMeta; items: NumberMetricItem[] } | null
  specialNumbers: { context: ContextMeta; items: NumberMetricItem[] } | null
  pairs: { context: ContextMeta; items: PairMetricItem[] } | null
}

const VALID_GAMES = new Set(['lotto_535', 'mega_645', 'power_655'])
const VALID_COUNTS = new Set([10, 20, 30, 50, 100])
const EDGE_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function padBall(n: number): string {
  return String(n).padStart(2, '0')
}

function formatBalls(main: number[], special: number | null): string {
  const base = main.map(padBall).join(' ')
  return special === null ? base : `${base} | Special: ${padBall(special)}`
}

function formatGap(gap: number | null): string {
  return gap === null ? '-' : String(gap)
}

function formatPercent(value: number | null): string {
  return value === null ? '-' : `${value.toFixed(1)}%`
}

function formatWindowLabel(windowKind: 'last_draws' | 'all_time', count: number): string {
  return windowKind === 'all_time' ? 'All-time history' : `Last ${count} draws`
}

function textError(status: number, body: string, retryAfter?: string): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }
  if (retryAfter) headers['Retry-After'] = retryAfter
  return new Response(body, { status, headers })
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

async function loadSnapshot(
  origin: URL,
  token: string,
  game: GameItem,
  windowQuery: string,
  drawLimit: number,
  pairLimit: number,
  fetchOrigin: Fetch,
  signal: AbortSignal,
): Promise<GameSnapshot> {
  const [drawsRes, numbersRes, pairsRes, specialRes] = await Promise.allSettled([
    fetchOriginJson<{ items: DrawItem[] }>(
      origin,
      token,
      `/games/${game.id}/draws?page=1&page_size=${drawLimit}&sort=desc`,
      fetchOrigin,
      signal,
    ),
    fetchOriginJson<{ context: ContextMeta; items: NumberMetricItem[] }>(
      origin,
      token,
      `/games/${game.id}/analytics/numbers?${windowQuery}&number_kind=main&sort=frequency_desc`,
      fetchOrigin,
      signal,
    ),
    fetchOriginJson<{ context: ContextMeta; items: PairMetricItem[] }>(
      origin,
      token,
      `/games/${game.id}/analytics/pairs?${windowQuery}&page=1&page_size=${pairLimit}&sort=frequency_desc`,
      fetchOrigin,
      signal,
    ),
    game.special_min !== null
      ? fetchOriginJson<{ context: ContextMeta; items: NumberMetricItem[] }>(
          origin,
          token,
          `/games/${game.id}/analytics/numbers?${windowQuery}&number_kind=special&sort=frequency_desc`,
          fetchOrigin,
          signal,
        )
      : Promise.resolve(null),
  ])

  // If draws themselves fail with upstream_unavailable, propagate so edge never caches an empty page.
  if (drawsRes.status === 'rejected') {
    throw drawsRes.reason
  }

  return {
    game,
    draws: drawsRes.value.items,
    numbers: numbersRes.status === 'fulfilled' ? numbersRes.value : null,
    pairs: pairsRes.status === 'fulfilled' ? pairsRes.value : null,
    specialNumbers: specialRes.status === 'fulfilled' ? specialRes.value : null,
  }
}

function renderMarkdown(
  snapshots: GameSnapshot[],
  selectedGame: string | null,
  windowKind: 'last_draws' | 'all_time',
  count: number,
): string {
  const windowLabel = formatWindowLabel(windowKind, count)
  const lines: string[] = [
    `# LottoScope — Historical Vietlott Analysis`,
    ``,
    `- Scope: ${selectedGame ?? 'All Games (Lotto 5/35, Mega 6/45, Power 6/55)'}`,
    `- Analysis window: ${windowLabel}`,
    `- Disclaimer: Historical statistical summary only; LottoScope does not predict future draws or guarantee outcomes.`,
    ``,
    `## Data Pages`,
    `- All games overview: https://lottoscope-sable.vercel.app/data`,
    `- Lotto 5/35: https://lottoscope-sable.vercel.app/data/lotto_535`,
    `- Mega 6/45: https://lottoscope-sable.vercel.app/data/mega_645`,
    `- Power 6/55: https://lottoscope-sable.vercel.app/data/power_655`,
    ``,
  ]

  for (const snap of snapshots) {
    const { game, draws, numbers, specialNumbers, pairs } = snap
    lines.push(`## ${game.label} (\`${game.id}\`)`)
    lines.push(``)
    if (numbers?.context) {
      lines.push(
        `- Actual draws in window: ${numbers.context.actual_draw_count} | Through draw: ${numbers.context.as_of_draw_id ?? '-'} | Data version: ${numbers.context.data_version}`,
      )
      lines.push(``)
    }

    lines.push(`### Recent Draws`)
    if (draws.length === 0) {
      lines.push(`No draws recorded.`)
    } else {
      lines.push(`| Draw ID | Date | Main Numbers | Special |`)
      lines.push(`| --- | --- | --- | --- |`)
      for (const d of draws) {
        lines.push(
          `| ${d.draw_id} | ${d.draw_date} | ${d.main_numbers.map(padBall).join(' ')} | ${d.special_number === null ? '-' : padBall(d.special_number)} |`,
        )
      }
    }
    lines.push(``)

    if (numbers && numbers.items.length > 0) {
      const limit = selectedGame ? numbers.items.length : 15
      lines.push(`### Main Number Frequency & Gaps (${windowLabel})`)
      lines.push(`| Rank | Number | Frequency | % | Current Gap | Avg Gap | Max Gap | Last Seen |`)
      lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- |`)
      for (const item of numbers.items.slice(0, limit)) {
        const avg = item.average_gap === null ? '-' : item.average_gap.toFixed(1)
        lines.push(
          `| #${item.frequency_rank} | ${padBall(item.number)} | ${item.frequency} | ${formatPercent(item.frequency_percent)} | ${formatGap(item.current_gap)} | ${avg} | ${formatGap(item.max_gap)} | ${item.last_seen_draw_id ?? '-'} |`,
        )
      }
      lines.push(``)
    }

    if (specialNumbers && specialNumbers.items.length > 0) {
      lines.push(`### Special Number Frequency & Gaps (01-12, ${windowLabel})`)
      lines.push(`| Rank | Special | Frequency | % | Current Gap | Avg Gap | Max Gap | Last Seen |`)
      lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- |`)
      for (const item of specialNumbers.items) {
        const avg = item.average_gap === null ? '-' : item.average_gap.toFixed(1)
        lines.push(
          `| #${item.frequency_rank} | ${padBall(item.number)} | ${item.frequency} | ${formatPercent(item.frequency_percent)} | ${formatGap(item.current_gap)} | ${avg} | ${formatGap(item.max_gap)} | ${item.last_seen_draw_id ?? '-'} |`,
        )
      }
      lines.push(``)
    }

    if (pairs && pairs.items.length > 0) {
      lines.push(`### Top Co-occurring Pairs (${windowLabel})`)
      lines.push(`| Rank | Pair | Frequency | % of Draws | Current Gap | Last Seen |`)
      lines.push(`| --- | --- | --- | --- | --- | --- |`)
      for (const pair of pairs.items) {
        lines.push(
          `| #${pair.frequency_rank} | ${pair.numbers.map(padBall).join(' - ')} | ${pair.frequency} | ${formatPercent(pair.percent_of_draws)} | ${formatGap(pair.current_gap)} | ${pair.last_seen_draw_id ?? '-'} |`,
        )
      }
      lines.push(``)
    }
  }

  return lines.join('\n')
}

function renderHtml(
  snapshots: GameSnapshot[],
  selectedGame: string | null,
  windowKind: 'last_draws' | 'all_time',
  count: number,
): string {
  const windowLabel = formatWindowLabel(windowKind, count)
  const titleSuffix = selectedGame
    ? `${snapshots[0]?.game.label ?? selectedGame} (${windowLabel})`
    : `Historical Draw Results & Frequency (${windowLabel})`
  const mdPath = selectedGame
    ? `/data/${encodeURIComponent(selectedGame)}?format=md${windowKind === 'all_time' ? '&window=all_time' : `&count=${count}`}`
    : `/data?format=md${windowKind === 'all_time' ? '&window=all_time' : `&count=${count}`}`

  const sections = snapshots
    .map((snap) => {
      const { game, draws, numbers, specialNumbers, pairs } = snap
      const ctx = numbers?.context
      const drawsRows =
        draws.length === 0
          ? `<tr><td colspan="4">No draws recorded.</td></tr>`
          : draws
              .map(
                (d) =>
                  `<tr><td>${escapeHtml(d.draw_id)}</td><td>${escapeHtml(d.draw_date)}</td><td>${escapeHtml(d.main_numbers.map(padBall).join(' '))}</td><td>${d.special_number === null ? '-' : escapeHtml(padBall(d.special_number))}</td></tr>`,
              )
              .join('')

      const mainLimit = selectedGame ? (numbers?.items.length ?? 0) : 15
      const numberRows = (numbers?.items ?? [])
        .slice(0, mainLimit)
        .map(
          (item) =>
            `<tr><td>#${item.frequency_rank}</td><td>${padBall(item.number)}</td><td>${item.frequency}</td><td>${escapeHtml(formatPercent(item.frequency_percent))}</td><td>${escapeHtml(formatGap(item.current_gap))}</td><td>${item.average_gap === null ? '-' : item.average_gap.toFixed(1)}</td><td>${escapeHtml(formatGap(item.max_gap))}</td><td>${escapeHtml(item.last_seen_draw_id ?? '-')}</td></tr>`,
        )
        .join('')

      const specialSection =
        specialNumbers && specialNumbers.items.length > 0
          ? `<h3>Special Number Frequency &amp; Gaps (01-12)</h3>
<table><thead><tr><th>Rank</th><th>Special</th><th>Frequency</th><th>%</th><th>Current Gap</th><th>Avg Gap</th><th>Max Gap</th><th>Last Seen</th></tr></thead><tbody>${specialNumbers.items
              .map(
                (item) =>
                  `<tr><td>#${item.frequency_rank}</td><td>${padBall(item.number)}</td><td>${item.frequency}</td><td>${escapeHtml(formatPercent(item.frequency_percent))}</td><td>${escapeHtml(formatGap(item.current_gap))}</td><td>${item.average_gap === null ? '-' : item.average_gap.toFixed(1)}</td><td>${escapeHtml(formatGap(item.max_gap))}</td><td>${escapeHtml(item.last_seen_draw_id ?? '-')}</td></tr>`,
              )
              .join('')}</tbody></table>`
          : ''

      const pairsSection =
        pairs && pairs.items.length > 0
          ? `<h3>Top Co-occurring Main Pairs</h3>
<table><thead><tr><th>Rank</th><th>Pair</th><th>Frequency</th><th>% of Draws</th><th>Current Gap</th><th>Last Seen</th></tr></thead><tbody>${pairs.items
              .map(
                (pair) =>
                  `<tr><td>#${pair.frequency_rank}</td><td>${escapeHtml(pair.numbers.map(padBall).join(' - '))}</td><td>${pair.frequency}</td><td>${escapeHtml(formatPercent(pair.percent_of_draws))}</td><td>${escapeHtml(formatGap(pair.current_gap))}</td><td>${escapeHtml(pair.last_seen_draw_id ?? '-')}</td></tr>`,
              )
              .join('')}</tbody></table>`
          : ''

      const latestSummary = draws[0]
        ? `<p><strong>Latest Draw:</strong> ${escapeHtml(draws[0].draw_id)} (${escapeHtml(draws[0].draw_date)}): ${escapeHtml(formatBalls(draws[0].main_numbers, draws[0].special_number))}</p>`
        : ''

      return `<section aria-labelledby="game-${escapeHtml(game.id)}">
<h2 id="game-${escapeHtml(game.id)}"><a href="/data/${escapeHtml(game.id)}">${escapeHtml(game.label)} (${escapeHtml(game.id)})</a></h2>
${latestSummary}
${ctx ? `<p>Analysis window: ${escapeHtml(windowLabel)} | Actual draws: ${ctx.actual_draw_count} | Through draw: ${escapeHtml(ctx.as_of_draw_id ?? '-')} | Data version: ${ctx.data_version}</p>` : ''}
<h3>Recent Draws</h3>
<table><thead><tr><th>Draw ID</th><th>Date</th><th>Main Numbers</th><th>Special</th></tr></thead><tbody>${drawsRows}</tbody></table>
${numberRows ? `<h3>Main Number Frequency &amp; Gaps${selectedGame ? '' : ' (Top 15)'}</h3><table><thead><tr><th>Rank</th><th>Number</th><th>Frequency</th><th>%</th><th>Current Gap</th><th>Avg Gap</th><th>Max Gap</th><th>Last Seen</th></tr></thead><tbody>${numberRows}</tbody></table>` : ''}
${specialSection}
${pairsSection}
</section>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LottoScope — ${escapeHtml(titleSuffix)}</title>
  <meta name="description" content="LottoScope historical Vietlott draw results, number frequencies, and co-occurrence statistics." />
  <link rel="alternate" type="text/markdown" title="Markdown Data" href="${escapeHtml(mdPath)}" />
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 960px; margin: 24px auto; padding: 0 16px; color: #102b36; line-height: 1.5; }
    nav a { margin-right: 12px; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0 24px; font-size: 0.92rem; }
    th, td { border: 1px solid #d5dfe5; padding: 6px 8px; text-align: left; }
    th { background: #f2f5f7; }
    section { border-top: 1px solid #e1e8ec; padding-top: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <header>
    <h1>LottoScope — Historical Analysis (${escapeHtml(titleSuffix)})</h1>
    <p>Historical draw results, number frequencies, gap metrics, and pair statistics for Vietlott games. Descriptive historical records only — does not predict future draws.</p>
    <nav aria-label="Game data views">
      <a href="/data">All Games</a>
      <a href="/data/lotto_535">Lotto 5/35</a>
      <a href="/data/mega_645">Mega 6/45</a>
      <a href="/data/power_655">Power 6/55</a>
      <a href="${escapeHtml(mdPath)}">Markdown format</a>
      <a href="/llms.txt">llms.txt</a>
    </nav>
    <p>Windows: <a href="?count=10">Last 10</a> | <a href="?count=20">Last 20</a> | <a href="?count=30">Last 30</a> | <a href="?count=50">Last 50</a> | <a href="?count=100">Last 100</a> | <a href="?window=all_time">All time</a></p>
  </header>
  <main>
    ${sections}
  </main>
</body>
</html>`
}

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

    const url = new URL(request.url)
    const pathMatch = /^\/data\/([^/]+)\/?$/.exec(url.pathname)
    const rawGame = pathMatch?.[1] ?? url.searchParams.get('game')
    const selectedGame = rawGame && rawGame !== '' ? rawGame : null

    if (selectedGame !== null && !VALID_GAMES.has(selectedGame)) {
      return textError(404, `Unknown game: ${selectedGame}`)
    }

    const rawWindow = url.searchParams.get('window')
    const rawCount = Number(url.searchParams.get('count') ?? '30')
    const windowKind: 'last_draws' | 'all_time' =
      rawWindow === 'all_time' ? 'all_time' : 'last_draws'
    const count = VALID_COUNTS.has(rawCount) ? rawCount : 30
    const windowQuery =
      windowKind === 'all_time' ? 'window=all_time' : `window=last_draws&count=${count}`

    const formatParam = url.searchParams.get('format')
    const acceptHeader = request.headers.get('Accept')?.toLowerCase() ?? ''
    const isMarkdown = formatParam === 'md' || acceptHeader.includes('text/markdown')

    const deadline = AbortSignal.timeout(timeoutMs)
    const signal = AbortSignal.any([deadline, request.signal])

    try {
      const gamesRes = await fetchOriginJson<{ items: GameItem[] }>(
        origin,
        token,
        '/games',
        fetchOrigin,
        signal,
      )
      const targetGames = selectedGame
        ? gamesRes.items.filter((g) => g.id === selectedGame)
        : gamesRes.items

      if (targetGames.length === 0) {
        return textError(404, 'No matching games found.')
      }

      const drawLimit = selectedGame ? 20 : 10
      const pairLimit = selectedGame ? 25 : 10
      const snapshots = await Promise.all(
        targetGames.map((game) =>
          loadSnapshot(origin, token, game, windowQuery, drawLimit, pairLimit, fetchOrigin, signal),
        ),
      )

      const body = isMarkdown
        ? renderMarkdown(snapshots, selectedGame, windowKind, count)
        : renderHtml(snapshots, selectedGame, windowKind, count)

      return new Response(request.method === 'HEAD' ? null : body, {
        status: 200,
        headers: {
          'Content-Type': isMarkdown ? 'text/markdown; charset=utf-8' : 'text/html; charset=utf-8',
          'Cache-Control': EDGE_CACHE_CONTROL,
          Vary: 'User-Agent, Accept',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    } catch {
      return textError(
        503,
        'Data service is starting or temporarily unavailable. Please retry shortly.',
        '30',
      )
    }
  }
}
