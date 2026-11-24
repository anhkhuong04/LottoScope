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

type Paged<T> = {
  items: T[]
  page: number
  page_size: number
  total: number
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
  draws: Paged<DrawItem>
  numbers: { context: ContextMeta; items: NumberMetricItem[] } | null
  specialNumbers: { context: ContextMeta; items: NumberMetricItem[] } | null
  pairs: ({ context: ContextMeta } & Paged<PairMetricItem>) | null
}

type OutputFormat = 'html' | 'md' | 'csv'
type CsvSection = 'draws' | 'numbers' | 'special' | 'pairs'

type DataQueryOptions = {
  selectedGame: string | null
  windowKind: 'last_draws' | 'date_range' | 'all_time'
  count: number
  fromDate: string | null
  toDate: string | null
  asOfDrawId: string | null
  drawId: string | null
  drawLimit: number
  drawPage: number
  drawSort: 'asc' | 'desc'
  pairLimit: number
  pairPage: number
  format: OutputFormat
  section: CsvSection
}

const VALID_GAMES = new Set(['lotto_535', 'mega_645', 'power_655'])
const VALID_COUNTS = new Set([10, 20, 30, 50, 100])
const VALID_SECTIONS = new Set<CsvSection>(['draws', 'numbers', 'special', 'pairs'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DRAW_ID_RE = /^[a-zA-Z0-9_-]{1,32}$/
const EDGE_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600'

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeCsv(value: unknown): string {
  const str = String(value ?? '')
  return /[",\r\n]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str
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

function formatWindowLabel(opts: DataQueryOptions): string {
  const base =
    opts.windowKind === 'all_time'
      ? 'All-time history'
      : opts.windowKind === 'date_range'
        ? `${opts.fromDate} to ${opts.toDate}`
        : `Last ${opts.count} draws`
  return opts.asOfDrawId ? `${base} (through ${opts.asOfDrawId})` : base
}

function parseBoundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null || raw === '') return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
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

function parseOptions(request: Request): DataQueryOptions | Response {
  const url = new URL(request.url)
  const pathMatch = /^\/data\/([^/]+)\/?$/.exec(url.pathname)
  const rawGame = pathMatch?.[1] ?? url.searchParams.get('game')
  const selectedGame = rawGame && rawGame !== '' ? rawGame : null

  if (selectedGame !== null && !VALID_GAMES.has(selectedGame)) {
    return textError(404, `Unknown game: ${selectedGame}`)
  }

  const rawFromDate = url.searchParams.get('from_date')
  const rawToDate = url.searchParams.get('to_date')
  if (rawFromDate && !DATE_RE.test(rawFromDate)) {
    return textError(400, 'Invalid from_date format. Expected YYYY-MM-DD.')
  }
  if (rawToDate && !DATE_RE.test(rawToDate)) {
    return textError(400, 'Invalid to_date format. Expected YYYY-MM-DD.')
  }

  const rawAsOfDrawId = url.searchParams.get('as_of_draw_id')
  const asOfDrawId = rawAsOfDrawId && DRAW_ID_RE.test(rawAsOfDrawId) ? rawAsOfDrawId : null

  const rawDrawId = url.searchParams.get('draw_id')
  const drawId = rawDrawId && DRAW_ID_RE.test(rawDrawId) ? rawDrawId : null

  const rawWindow = url.searchParams.get('window')
  let windowKind: DataQueryOptions['windowKind'] = 'last_draws'
  if (rawWindow === 'all_time') {
    windowKind = 'all_time'
  } else if (rawWindow === 'date_range' || (rawWindow === null && rawFromDate && rawToDate)) {
    if (!rawFromDate || !rawToDate) {
      return textError(400, 'Both from_date and to_date (YYYY-MM-DD) are required for date_range.')
    }
    windowKind = 'date_range'
  }

  const rawCount = Number(url.searchParams.get('count') ?? '30')
  const count = VALID_COUNTS.has(rawCount) ? rawCount : 30

  const defaultDrawLimit = selectedGame ? 20 : 10
  const defaultPairLimit = selectedGame ? 25 : 10
  const drawLimit = parseBoundedInt(url.searchParams.get('draw_limit'), defaultDrawLimit, 1, 100)
  const drawPage = parseBoundedInt(url.searchParams.get('draw_page'), 1, 1, 10_000)
  const drawSort = url.searchParams.get('draw_sort') === 'asc' ? 'asc' : 'desc'
  const pairLimit = parseBoundedInt(url.searchParams.get('pair_limit'), defaultPairLimit, 1, 100)
  const pairPage = parseBoundedInt(url.searchParams.get('pair_page'), 1, 1, 10_000)

  const formatParam = url.searchParams.get('format')
  const acceptHeader = request.headers.get('Accept')?.toLowerCase() ?? ''
  let format: OutputFormat = 'html'
  if (formatParam === 'csv' || (formatParam === null && acceptHeader.includes('text/csv'))) {
    format = 'csv'
  } else if (
    formatParam === 'md' ||
    (formatParam === null && acceptHeader.includes('text/markdown'))
  ) {
    format = 'md'
  }

  const rawSection = url.searchParams.get('section') as CsvSection | null
  const section: CsvSection = rawSection && VALID_SECTIONS.has(rawSection) ? rawSection : 'draws'

  return {
    selectedGame,
    windowKind,
    count,
    fromDate: rawFromDate || null,
    toDate: rawToDate || null,
    asOfDrawId,
    drawId,
    drawLimit,
    drawPage,
    drawSort,
    pairLimit,
    pairPage,
    format,
    section,
  }
}

function buildAnalyticsQuery(opts: DataQueryOptions): string {
  const qs = new URLSearchParams()
  qs.set('window', opts.windowKind)
  if (opts.windowKind === 'last_draws') {
    qs.set('count', String(opts.count))
  } else if (opts.windowKind === 'date_range' && opts.fromDate && opts.toDate) {
    qs.set('from_date', opts.fromDate)
    qs.set('to_date', opts.toDate)
  }
  if (opts.asOfDrawId) qs.set('as_of_draw_id', opts.asOfDrawId)
  return qs.toString()
}

function buildDrawsQuery(opts: DataQueryOptions): string {
  const qs = new URLSearchParams()
  qs.set('page', String(opts.drawPage))
  qs.set('page_size', String(opts.drawLimit))
  qs.set('sort', opts.drawSort)
  if (opts.fromDate) qs.set('from_date', opts.fromDate)
  if (opts.toDate) qs.set('to_date', opts.toDate)
  if (opts.drawId) qs.set('draw_id', opts.drawId)
  return qs.toString()
}

function buildPageHref(
  opts: DataQueryOptions,
  overrides: Partial<{
    windowKind: DataQueryOptions['windowKind']
    count: number
    drawPage: number
    pairPage: number
    format: OutputFormat
    section: CsvSection
  }> = {},
): string {
  const basePath = opts.selectedGame ? `/data/${encodeURIComponent(opts.selectedGame)}` : '/data'
  const qs = new URLSearchParams()
  const win = overrides.windowKind ?? opts.windowKind
  const cnt = overrides.count ?? opts.count
  const dPage = overrides.drawPage ?? opts.drawPage
  const pPage = overrides.pairPage ?? opts.pairPage
  const fmt = overrides.format ?? opts.format
  const sec = overrides.section ?? opts.section

  if (win === 'all_time') {
    qs.set('window', 'all_time')
  } else if (win === 'date_range' && opts.fromDate && opts.toDate) {
    qs.set('window', 'date_range')
    qs.set('from_date', opts.fromDate)
    qs.set('to_date', opts.toDate)
  } else if (cnt !== 30) {
    qs.set('count', String(cnt))
  }

  if (opts.asOfDrawId) qs.set('as_of_draw_id', opts.asOfDrawId)
  if (opts.drawId) qs.set('draw_id', opts.drawId)
  if (opts.drawLimit !== (opts.selectedGame ? 20 : 10)) qs.set('draw_limit', String(opts.drawLimit))
  if (dPage > 1) qs.set('draw_page', String(dPage))
  if (opts.drawSort !== 'desc') qs.set('draw_sort', opts.drawSort)
  if (opts.pairLimit !== (opts.selectedGame ? 25 : 10)) qs.set('pair_limit', String(opts.pairLimit))
  if (pPage > 1) qs.set('pair_page', String(pPage))
  if (fmt !== 'html') qs.set('format', fmt)
  if (fmt === 'csv' && sec !== 'draws') qs.set('section', sec)

  const str = qs.toString()
  return str ? `${basePath}?${str}` : basePath
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
  opts: DataQueryOptions,
  fetchOrigin: Fetch,
  signal: AbortSignal,
): Promise<GameSnapshot> {
  const windowQuery = buildAnalyticsQuery(opts)
  const drawsQuery = buildDrawsQuery(opts)

  const [drawsRes, numbersRes, pairsRes, specialRes] = await Promise.allSettled([
    fetchOriginJson<Paged<DrawItem>>(
      origin,
      token,
      `/games/${game.id}/draws?${drawsQuery}`,
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
    fetchOriginJson<{ context: ContextMeta } & Paged<PairMetricItem>>(
      origin,
      token,
      `/games/${game.id}/analytics/pairs?${windowQuery}&page=${opts.pairPage}&page_size=${opts.pairLimit}&sort=frequency_desc`,
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

function renderCsv(snapshots: GameSnapshot[], opts: DataQueryOptions): string {
  const rows: string[][] = []
  if (opts.section === 'draws') {
    rows.push(['game', 'draw_id', 'draw_date', 'draw_time', 'main_numbers', 'special_number'])
    for (const snap of snapshots) {
      for (const d of snap.draws.items) {
        rows.push([
          snap.game.id,
          d.draw_id,
          d.draw_date,
          d.draw_time ?? '',
          d.main_numbers.map(padBall).join(' '),
          d.special_number === null ? '' : padBall(d.special_number),
        ])
      }
    }
  } else if (opts.section === 'numbers' || opts.section === 'special') {
    rows.push([
      'game',
      'number_kind',
      'rank',
      'number',
      'frequency',
      'frequency_percent',
      'current_gap',
      'average_gap',
      'max_gap',
      'last_seen_draw_id',
    ])
    for (const snap of snapshots) {
      const source = opts.section === 'special' ? snap.specialNumbers : snap.numbers
      const kind = opts.section === 'special' ? 'special' : 'main'
      for (const item of source?.items ?? []) {
        rows.push([
          snap.game.id,
          kind,
          String(item.frequency_rank),
          padBall(item.number),
          String(item.frequency),
          item.frequency_percent === null ? '' : item.frequency_percent.toFixed(1),
          item.current_gap === null ? '' : String(item.current_gap),
          item.average_gap === null ? '' : item.average_gap.toFixed(1),
          item.max_gap === null ? '' : String(item.max_gap),
          item.last_seen_draw_id ?? '',
        ])
      }
    }
  } else {
    rows.push([
      'game',
      'rank',
      'pair',
      'frequency',
      'percent_of_draws',
      'current_gap',
      'last_seen_draw_id',
    ])
    for (const snap of snapshots) {
      for (const pair of snap.pairs?.items ?? []) {
        rows.push([
          snap.game.id,
          String(pair.frequency_rank),
          pair.numbers.map(padBall).join('-'),
          String(pair.frequency),
          pair.percent_of_draws === null ? '' : pair.percent_of_draws.toFixed(1),
          pair.current_gap === null ? '' : String(pair.current_gap),
          pair.last_seen_draw_id ?? '',
        ])
      }
    }
  }

  return rows.map((cols) => cols.map(escapeCsv).join(',')).join('\n')
}

function renderMarkdown(snapshots: GameSnapshot[], opts: DataQueryOptions): string {
  const windowLabel = formatWindowLabel(opts)
  const lines: string[] = [
    `# LottoScope — Historical Vietlott Analysis`,
    ``,
    `- Scope: ${opts.selectedGame ?? 'All Games (Lotto 5/35, Mega 6/45, Power 6/55)'}`,
    `- Analysis window: ${windowLabel}`,
    `- Draws slice: page ${opts.drawPage}, limit ${opts.drawLimit}, sort ${opts.drawSort}`,
    `- Pairs slice: page ${opts.pairPage}, limit ${opts.pairLimit}`,
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

    const totalDrawPages = Math.max(
      1,
      Math.ceil((draws.total || draws.items.length) / opts.drawLimit),
    )
    lines.push(
      `### Recent Draws (Page ${draws.page ?? opts.drawPage}/${totalDrawPages}, Total: ${draws.total ?? draws.items.length})`,
    )
    if (draws.items.length === 0) {
      lines.push(`No draws recorded in this range.`)
    } else {
      lines.push(`| Draw ID | Date | Main Numbers | Special |`)
      lines.push(`| --- | --- | --- | --- |`)
      for (const d of draws.items) {
        lines.push(
          `| ${d.draw_id} | ${d.draw_date} | ${d.main_numbers.map(padBall).join(' ')} | ${d.special_number === null ? '-' : padBall(d.special_number)} |`,
        )
      }
    }
    lines.push(``)

    if (numbers && numbers.items.length > 0) {
      const limit = opts.selectedGame ? numbers.items.length : 15
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
      const totalPairPages = Math.max(
        1,
        Math.ceil((pairs.total || pairs.items.length) / opts.pairLimit),
      )
      lines.push(
        `### Co-occurring Pairs (${windowLabel}, Page ${pairs.page ?? opts.pairPage}/${totalPairPages}, Total: ${pairs.total ?? pairs.items.length})`,
      )
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

function renderHtml(snapshots: GameSnapshot[], opts: DataQueryOptions): string {
  const windowLabel = formatWindowLabel(opts)
  const titleSuffix = opts.selectedGame
    ? `${snapshots[0]?.game.label ?? opts.selectedGame} (${windowLabel})`
    : `Historical Draw Results & Frequency (${windowLabel})`
  const mdHref = buildPageHref(opts, { format: 'md' })
  const csvDrawsHref = buildPageHref(opts, { format: 'csv', section: 'draws' })
  const csvNumbersHref = buildPageHref(opts, { format: 'csv', section: 'numbers' })
  const csvPairsHref = buildPageHref(opts, { format: 'csv', section: 'pairs' })

  const sections = snapshots
    .map((snap) => {
      const { game, draws, numbers, specialNumbers, pairs } = snap
      const ctx = numbers?.context
      const totalDraws = draws.total ?? draws.items.length
      const totalDrawPages = Math.max(1, Math.ceil(totalDraws / opts.drawLimit))
      const drawsRows =
        draws.items.length === 0
          ? `<tr><td colspan="4">No draws recorded in this range.</td></tr>`
          : draws.items
              .map(
                (d) =>
                  `<tr><td>${escapeHtml(d.draw_id)}</td><td>${escapeHtml(d.draw_date)}</td><td>${escapeHtml(d.main_numbers.map(padBall).join(' '))}</td><td>${d.special_number === null ? '-' : escapeHtml(padBall(d.special_number))}</td></tr>`,
              )
              .join('')

      const drawPagerLinks: string[] = []
      if (opts.drawPage > 1) {
        drawPagerLinks.push(
          `<a href="${escapeHtml(buildPageHref(opts, { drawPage: opts.drawPage - 1 }))}">Previous draws</a>`,
        )
      }
      if (opts.drawPage < totalDrawPages) {
        drawPagerLinks.push(
          `<a href="${escapeHtml(buildPageHref(opts, { drawPage: opts.drawPage + 1 }))}">Next draws</a>`,
        )
      }

      const mainLimit = opts.selectedGame ? (numbers?.items.length ?? 0) : 15
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

      const totalPairs = pairs?.total ?? pairs?.items.length ?? 0
      const totalPairPages = Math.max(1, Math.ceil(totalPairs / opts.pairLimit))
      const pairPagerLinks: string[] = []
      if (opts.pairPage > 1) {
        pairPagerLinks.push(
          `<a href="${escapeHtml(buildPageHref(opts, { pairPage: opts.pairPage - 1 }))}">Previous pairs</a>`,
        )
      }
      if (opts.pairPage < totalPairPages) {
        pairPagerLinks.push(
          `<a href="${escapeHtml(buildPageHref(opts, { pairPage: opts.pairPage + 1 }))}">Next pairs</a>`,
        )
      }

      const pairsSection =
        pairs && pairs.items.length > 0
          ? `<h3>Co-occurring Main Pairs (Page ${pairs.page ?? opts.pairPage}/${totalPairPages}, Total: ${totalPairs})</h3>
${pairPagerLinks.length > 0 ? `<p>${pairPagerLinks.join(' | ')}</p>` : ''}
<table><thead><tr><th>Rank</th><th>Pair</th><th>Frequency</th><th>% of Draws</th><th>Current Gap</th><th>Last Seen</th></tr></thead><tbody>${pairs.items
              .map(
                (pair) =>
                  `<tr><td>#${pair.frequency_rank}</td><td>${escapeHtml(pair.numbers.map(padBall).join(' - '))}</td><td>${pair.frequency}</td><td>${escapeHtml(formatPercent(pair.percent_of_draws))}</td><td>${escapeHtml(formatGap(pair.current_gap))}</td><td>${escapeHtml(pair.last_seen_draw_id ?? '-')}</td></tr>`,
              )
              .join('')}</tbody></table>`
          : ''

      const latestSummary = draws.items[0]
        ? `<p><strong>Latest Draw in Page:</strong> ${escapeHtml(draws.items[0].draw_id)} (${escapeHtml(draws.items[0].draw_date)}): ${escapeHtml(formatBalls(draws.items[0].main_numbers, draws.items[0].special_number))}</p>`
        : ''

      return `<section aria-labelledby="game-${escapeHtml(game.id)}">
<h2 id="game-${escapeHtml(game.id)}"><a href="/data/${escapeHtml(game.id)}">${escapeHtml(game.label)} (${escapeHtml(game.id)})</a></h2>
${latestSummary}
${ctx ? `<p>Analysis window: ${escapeHtml(windowLabel)} | Actual draws: ${ctx.actual_draw_count} | Through draw: ${escapeHtml(ctx.as_of_draw_id ?? '-')} | Data version: ${ctx.data_version}</p>` : ''}
<h3>Recent Draws (Page ${draws.page ?? opts.drawPage}/${totalDrawPages}, Total: ${totalDraws})</h3>
${drawPagerLinks.length > 0 ? `<p>${drawPagerLinks.join(' | ')}</p>` : ''}
<table><thead><tr><th>Draw ID</th><th>Date</th><th>Main Numbers</th><th>Special</th></tr></thead><tbody>${drawsRows}</tbody></table>
${numberRows ? `<h3>Main Number Frequency &amp; Gaps${opts.selectedGame ? '' : ' (Top 15)'}</h3><table><thead><tr><th>Rank</th><th>Number</th><th>Frequency</th><th>%</th><th>Current Gap</th><th>Avg Gap</th><th>Max Gap</th><th>Last Seen</th></tr></thead><tbody>${numberRows}</tbody></table>` : ''}
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
  <link rel="alternate" type="text/markdown" title="Markdown Data" href="${escapeHtml(mdHref)}" />
  <link rel="alternate" type="text/csv" title="CSV Draws Data" href="${escapeHtml(csvDrawsHref)}" />
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
      <a href="${escapeHtml(mdHref)}">Markdown</a>
      <a href="${escapeHtml(csvDrawsHref)}">CSV (Draws)</a>
      <a href="${escapeHtml(csvNumbersHref)}">CSV (Numbers)</a>
      <a href="${escapeHtml(csvPairsHref)}">CSV (Pairs)</a>
      <a href="/llms.txt">llms.txt</a>
    </nav>
    <p>Windows: <a href="${escapeHtml(buildPageHref(opts, { windowKind: 'last_draws', count: 10 }))}">Last 10</a> | <a href="${escapeHtml(buildPageHref(opts, { windowKind: 'last_draws', count: 20 }))}">Last 20</a> | <a href="${escapeHtml(buildPageHref(opts, { windowKind: 'last_draws', count: 30 }))}">Last 30</a> | <a href="${escapeHtml(buildPageHref(opts, { windowKind: 'last_draws', count: 50 }))}">Last 50</a> | <a href="${escapeHtml(buildPageHref(opts, { windowKind: 'last_draws', count: 100 }))}">Last 100</a> | <a href="${escapeHtml(buildPageHref(opts, { windowKind: 'all_time' }))}">All time</a></p>
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

    const parsed = parseOptions(request)
    if (parsed instanceof Response) {
      return parsed
    }

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
      const targetGames = parsed.selectedGame
        ? gamesRes.items.filter((g) => g.id === parsed.selectedGame)
        : gamesRes.items

      if (targetGames.length === 0) {
        return textError(404, 'No matching games found.')
      }

      const snapshots = await Promise.all(
        targetGames.map((game) => loadSnapshot(origin, token, game, parsed, fetchOrigin, signal)),
      )

      const body =
        parsed.format === 'csv'
          ? renderCsv(snapshots, parsed)
          : parsed.format === 'md'
            ? renderMarkdown(snapshots, parsed)
            : renderHtml(snapshots, parsed)

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
        'Data service is starting or temporarily unavailable. Please retry shortly.',
        '30',
      )
    }
  }
}
