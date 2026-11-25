import { analysisDrawCounts, supportedGameIds } from '../src/analysisOptions.js'
import { textError } from './dataResponse.js'

type OutputFormat = 'html' | 'md' | 'csv'
type CsvSection = 'draws' | 'numbers' | 'special' | 'pairs'

export type DataQueryOptions = {
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

const VALID_SECTIONS = new Set<CsvSection>(['draws', 'numbers', 'special', 'pairs'])
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DRAW_ID_RE = /^[a-zA-Z0-9_-]{1,32}$/

function parseBoundedInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (raw === null || raw === '') return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

export function parseOptions(request: Request): DataQueryOptions | Response {
  const url = new URL(request.url)
  const pathMatch = /^\/data\/([^/]+)\/?$/.exec(url.pathname)
  const rawGame = pathMatch?.[1] ?? url.searchParams.get('game')
  const selectedGame = rawGame && rawGame !== '' ? rawGame : null

  if (selectedGame !== null && !supportedGameIds.has(selectedGame)) {
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
  const count = analysisDrawCounts.has(rawCount) ? rawCount : 30

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

export function buildAnalyticsQuery(opts: DataQueryOptions): string {
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

export function buildDrawsQuery(opts: DataQueryOptions): string {
  const qs = new URLSearchParams()
  qs.set('page', String(opts.drawPage))
  qs.set('page_size', String(opts.drawLimit))
  qs.set('sort', opts.drawSort)
  if (opts.fromDate) qs.set('from_date', opts.fromDate)
  if (opts.toDate) qs.set('to_date', opts.toDate)
  if (opts.drawId) qs.set('draw_id', opts.drawId)
  return qs.toString()
}

export function buildPageHref(
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

  // With both dates and an omitted window, the parser infers date_range.
  if (win !== 'last_draws' || (opts.fromDate && opts.toDate)) qs.set('window', win)
  if (win === 'last_draws' && cnt !== 30) qs.set('count', String(cnt))
  if (opts.fromDate) qs.set('from_date', opts.fromDate)
  if (opts.toDate) qs.set('to_date', opts.toDate)

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
