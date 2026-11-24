import { AlertCircle, ArrowLeft, ArrowRight, Clock3, DatabaseZap, RefreshCw } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { useEffect, useId, useState, type ReactNode } from 'react'
import {
  ApiError,
  globalSearch,
  type AnalysisWindow,
  type Context,
  type Draw,
  type Game,
  type PairMetric,
} from './api'
import { useApp } from './state'

export function PageHead({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p className="page-intro">{description}</p>
      </div>
      {children}
    </div>
  )
}
export function Card({
  title,
  subtitle,
  children,
  action,
  className = '',
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function DataTable({
  children,
  mobileHidden = false,
}: {
  children: ReactNode
  mobileHidden?: boolean
}) {
  return (
    <div
      role="region"
      aria-label="Data table"
      tabIndex={0}
      className={`${mobileHidden ? 'desktop-only ' : ''}table-wrap`}
    >
      <table className="data-table">{children}</table>
    </div>
  )
}
export function Ball({
  value,
  special = false,
  large = false,
}: {
  value: number
  special?: boolean
  large?: boolean
}) {
  return (
    <span className={`ball${special ? ' special' : ''}${large ? ' large' : ''}`}>
      {String(value).padStart(2, '0')}
    </span>
  )
}
export function FrequencyTile({
  number,
  frequency,
  maximum,
  to,
  special = false,
  rank,
}: {
  number: number
  frequency: number
  maximum: number
  to: string
  special?: boolean
  rank?: number
}) {
  return (
    <Link className="number-tile frequency-tile" to={to}>
      <Ball value={number} special={special} />
      <span className="frequency-value">
        {frequency} <small>draws</small>
      </span>
      {rank !== undefined && <span className="rank-label">Rank {rank}</span>}
      <span className="frequency-meter" aria-hidden="true">
        <span style={{ width: `${(100 * frequency) / Math.max(1, maximum)}%` }} />
      </span>
    </Link>
  )
}

export function Balls({
  values,
  special,
  large = false,
}: {
  values: number[]
  special?: number | null
  large?: boolean
}) {
  return (
    <div className="balls">
      {values.map((value) => (
        <Ball key={value} value={value} large={large} />
      ))}
      {special !== null && special !== undefined && (
        <span className="draw-special">
          <span className="draw-special-label">Special</span>{' '}
          <Ball value={special} special large={large} />
        </span>
      )}
    </div>
  )
}
export function DataState({
  loading,
  error,
  hasData,
  empty = 'No data available in this range.',
  retry,
  children,
}: {
  loading: boolean
  error: Error | null
  hasData: boolean
  empty?: string
  retry: () => void
  children: ReactNode
}) {
  if (!hasData && loading) return <LoadingSkeleton />
  if (!hasData && error && !(error instanceof ApiError && error.kind === 'missing'))
    return (
      <div className="state" role="alert">
        <AlertCircle size={26} />
        <h3>{error.message}</h3>
        <button className="btn" onClick={retry}>
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    )
  if (!hasData)
    return (
      <div className="state">
        <DatabaseZap size={26} />
        <h3>{empty}</h3>
      </div>
    )
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          Stale data in same window; update failed: {error.message}{' '}
          <button onClick={retry}>Retry</button>
        </div>
      )}
      {loading && (
        <div className="notice" role="status">
          Updating data…
        </div>
      )}
      <div className="data-content">{children}</div>
    </>
  )
}

export function LoadingSkeleton({ page = false }: { page?: boolean }) {
  const [waiting, setWaiting] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setWaiting(true), 8000)
    return () => clearTimeout(timer)
  }, [])
  return (
    <div
      className={`loading-skeleton${page ? ' page-skeleton' : ''}`}
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">{page ? 'Loading game list and data…' : 'Loading data…'}</span>
      <div className="skeleton-content" aria-hidden="true">
        <div className="skeleton-line short" />
        <div className="skeleton-line title" />
        <div className="skeleton-balls">
          {[0, 1, 2, 3, 4].map((item) => (
            <span key={item} />
          ))}
        </div>
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </div>
      {page && (
        <div className="skeleton-panels" aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <div className="skeleton-content" key={item}>
              <div className="skeleton-line short" />
              <div className="skeleton-line title" />
            </div>
          ))}
        </div>
      )}
      {waiting && (
        <p className="loading-hint">
          Connecting to service. Initial load may take extra time; please wait.
        </p>
      )}
    </div>
  )
}
export function WindowSelector({ children }: { children?: ReactNode }) {
  const { window, setWindow } = useApp()
  return (
    <WindowSelectorForm key={JSON.stringify(window)} window={window} setWindow={setWindow}>
      {children}
    </WindowSelectorForm>
  )
}

function WindowSelectorForm({
  window,
  setWindow,
  children,
}: {
  window: AnalysisWindow
  setWindow: (value: AnalysisWindow) => void
  children?: ReactNode
}) {
  const [from, setFrom] = useState(window.kind === 'date_range' ? window.from_date : '')
  const [to, setTo] = useState(window.kind === 'date_range' ? window.to_date : '')
  const [draftMode, setDraftMode] = useState<string | null>(null)
  const value = draftMode ?? (window.kind === 'last_draws' ? String(window.count) : window.kind)
  return (
    <FilterBar>
      <label className="field">
        Analysis window
        <select
          value={value}
          onChange={(event) => {
            const next = event.target.value
            if (next === 'date_range') setDraftMode('date_range')
            else {
              setDraftMode(null)
              if (next === 'all_time') setWindow({ kind: 'all_time' })
              else setWindow({ kind: 'last_draws', count: Number(next) })
            }
          }}
        >
          <option value="10">Last 10 draws</option>
          <option value="20">Last 20 draws</option>
          <option value="30">Last 30 draws</option>
          <option value="50">Last 50 draws</option>
          <option value="100">Last 100 draws</option>
          <option value="date_range">Date range</option>
          <option value="all_time">All-time history</option>
        </select>
      </label>
      {value === 'date_range' && (
        <>
          <label className="field">
            From date
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="field">
            To date
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <button
            className="btn"
            disabled={
              !from ||
              !to ||
              from > to ||
              (new Date(to).getTime() - new Date(from).getTime()) / 86400000 > 3650
            }
            onClick={() => {
              setWindow({ kind: 'date_range', from_date: from, to_date: to })
              setDraftMode(null)
            }}
          >
            Apply
          </button>
        </>
      )}
      {children}
    </FilterBar>
  )
}
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="toolbar window-toolbar filter-bar" role="region" aria-label="Filters">
      {children}
    </div>
  )
}
export function ScopeSummary({ context, subject }: { context: Context; subject?: string }) {
  return (
    <p className="scope-summary">
      {subject && <strong>{subject}</strong>}
      <span>{formatWindow(context.analysis_window)}</span>
      <span>Actual: {context.actual_draw_count} draws</span>
      <span>
        {context.as_of_draw_id ? `Through draw ${context.as_of_draw_id}` : 'No draws recorded'}
      </span>
    </p>
  )
}
export function DrawRows({ draws, game }: { draws: Draw[]; game: Game }) {
  const location = useLocation()
  const { window } = useApp()
  const detailSearch =
    location.pathname === '/history' ? location.search : globalSearch(game.id, window)
  return (
    <div>
      {draws.map((draw) => (
        <div className="draw-row" key={draw.draw_id}>
          <div className="draw-meta">
            <Link
              className="draw-id"
              to={`/history/${encodeURIComponent(draw.draw_id)}${detailSearch}`}
            >
              Draw {draw.draw_id}
            </Link>
            <div className="draw-date">
              {draw.draw_date}
              {draw.draw_time ? ` · ${draw.draw_time.slice(0, 5)}` : ''}
            </div>
          </div>
          <Balls
            values={draw.main_numbers}
            special={game.special_min === null ? null : draw.special_number}
          />
          <Link
            className="link-arrow"
            to={`/history/${encodeURIComponent(draw.draw_id)}${detailSearch}`}
          >
            Details <ArrowRight size={13} />
          </Link>
        </div>
      ))}
    </div>
  )
}
export function Pager({
  page,
  total,
  pageSize,
  setPage,
}: {
  page: number
  total: number
  pageSize: number
  setPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination-summary" aria-live="polite">
        Page {page}/{pages} · {total} items
      </span>
      <PageJump key={`${page}:${pages}:${total}`} page={page} pages={pages} setPage={setPage} />
      <div className="pagination-arrows">
        <button
          aria-label="Previous page"
          className="btn"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ArrowLeft size={16} />
        </button>
        <button
          aria-label="Next page"
          className="btn"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </nav>
  )
}

function PageJump({
  page,
  pages,
  setPage,
}: {
  page: number
  pages: number
  setPage: (page: number) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState(String(page))
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="page-jump"
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        const value = draft.trim()
        const target = Number(value)
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(target) || target < 1 || target > pages) {
          setError(`Enter page number from 1 to ${pages}.`)
          return
        }
        setError(null)
        setDraft(String(target))
        if (target !== page) setPage(target)
      }}
    >
      <div className="page-jump-controls">
        <label htmlFor={id}>Go to page</label>
        <input
          id={id}
          className="text-input"
          type="text"
          inputMode="numeric"
          value={draft}
          disabled={pages <= 1}
          aria-invalid={!!error}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setDraft(String(page))
              setError(null)
            }
          }}
        />
        <span id={`${id}-hint`} className="muted">
          / {pages}
        </span>
        <button className="btn" type="submit" disabled={pages <= 1}>
          Go
        </button>
      </div>
      {error && (
        <span id={`${id}-error`} className="page-jump-error" role="alert">
          {error}
        </span>
      )}
    </form>
  )
}
export function ContextNote({ count, version }: { count: number; version: number }) {
  return (
    <details className="data-details context-details">
      <summary>
        <Clock3 size={16} aria-hidden="true" />
        Data details
      </summary>
      <dl className="data-facts">
        <div>
          <dt>Draws in window</dt>
          <dd>{count}</dd>
        </div>
        <div>
          <dt>Data version</dt>
          <dd>{version}</dd>
        </div>
      </dl>
    </details>
  )
}
export function BackLink({ to, label }: { to: string; label: string }) {
  const location = useLocation()
  return (
    <Link className="breadcrumb" to={`${to}${location.search}`}>
      <ArrowLeft size={15} />
      {label}
    </Link>
  )
}
export function PairLink({ pair }: { pair: PairMetric }) {
  const { gameId, window } = useApp()
  return (
    <Link
      className="pair-link"
      to={`/pairs/${pair.numbers.join('-')}${globalSearch(gameId, window)}`}
    >
      <Balls values={pair.numbers} />
    </Link>
  )
}
export function formatPercent(value: number | null) {
  return value === null ? '—' : `${value.toFixed(1)}%`
}
export function formatVietnamTime(value: string) {
  return `${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))} (VN Time)`
}
export function formatWindow(window: AnalysisWindow) {
  return window.kind === 'last_draws'
    ? `Last ${window.count} draws`
    : window.kind === 'all_time'
      ? 'all-time history'
      : `${window.from_date} – ${window.to_date}`
}
