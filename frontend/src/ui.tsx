import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Clock3,
  DatabaseZap,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { useId, useState, type ReactNode } from 'react'
import {
  ApiError,
  globalSearch,
  type AnalysisWindow,
  type Draw,
  type Game,
  type PairMetric,
} from './api'
import { useApp } from './state'

export function PageHead({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{kicker}</p>
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
    <div className={`${mobileHidden ? 'desktop-only ' : ''}table-wrap`}>
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
          Đặc biệt <Ball value={special} special large={large} />
        </span>
      )}
    </div>
  )
}
export function Metric({ label, value, foot }: { label: string; value: ReactNode; foot?: string }) {
  return (
    <div className="card metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value ?? '—'}</div>
      {foot && <div className="metric-foot">{foot}</div>}
    </div>
  )
}
export function DataState({
  loading,
  error,
  hasData,
  empty = 'Chưa có dữ liệu trong phạm vi này.',
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
  if (!hasData && loading)
    return (
      <div className="state" role="status">
        <LoaderCircle size={26} />
        <h3>Đang tải dữ liệu…</h3>
      </div>
    )
  if (!hasData && error && !(error instanceof ApiError && error.kind === 'missing'))
    return (
      <div className="state" role="alert">
        <AlertCircle size={26} />
        <h3>{error.message}</h3>
        <button className="btn" onClick={retry}>
          <RefreshCw size={16} /> Thử lại
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
          Dữ liệu cũ trong cùng phạm vi; cập nhật thất bại: {error.message}{' '}
          <button onClick={retry}>Thử lại</button>
        </div>
      )}
      {loading && (
        <div className="notice" role="status">
          Đang cập nhật dữ liệu…
        </div>
      )}
      {children}
      <div className="refresh-row">
        <button className="btn ghost" disabled={loading} onClick={retry}>
          <RefreshCw size={15} /> Cập nhật
        </button>
      </div>
    </>
  )
}
export function WindowSelector() {
  const { window, setWindow } = useApp()
  return <WindowSelectorForm key={JSON.stringify(window)} window={window} setWindow={setWindow} />
}

function WindowSelectorForm({
  window,
  setWindow,
}: {
  window: AnalysisWindow
  setWindow: (value: AnalysisWindow) => void
}) {
  const [from, setFrom] = useState(window.kind === 'date_range' ? window.from_date : '')
  const [to, setTo] = useState(window.kind === 'date_range' ? window.to_date : '')
  const [draftMode, setDraftMode] = useState<string | null>(null)
  const value = draftMode ?? (window.kind === 'last_draws' ? String(window.count) : window.kind)
  return (
    <div className="toolbar">
      <label className="field">
        Phạm vi phân tích
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
          <option value="10">10 kỳ gần nhất</option>
          <option value="20">20 kỳ gần nhất</option>
          <option value="30">30 kỳ gần nhất</option>
          <option value="50">50 kỳ gần nhất</option>
          <option value="100">100 kỳ gần nhất</option>
          <option value="date_range">Khoảng ngày</option>
          <option value="all_time">Toàn bộ lịch sử</option>
        </select>
      </label>
      {value === 'date_range' && (
        <>
          <label className="field">
            Từ ngày
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="field">
            Đến ngày
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
            Áp dụng
          </button>
        </>
      )}
    </div>
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
              Kỳ {draw.draw_id}
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
            Chi tiết <ArrowRight size={13} />
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
    <nav className="pagination" aria-label="Phân trang">
      <span className="pagination-summary" aria-live="polite">
        Trang {page}/{pages} · {total} mục
      </span>
      <PageJump key={`${page}:${pages}:${total}`} page={page} pages={pages} setPage={setPage} />
      <div className="pagination-arrows">
        <button
          aria-label="Trang trước"
          className="btn"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ArrowLeft size={16} />
        </button>
        <button
          aria-label="Trang sau"
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
          setError(`Nhập số trang từ 1 đến ${pages}.`)
          return
        }
        setError(null)
        setDraft(String(target))
        if (target !== page) setPage(target)
      }}
    >
      <div className="page-jump-controls">
        <label htmlFor={id}>Đến trang</label>
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
          Đi
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
    <span className="pill">
      <Clock3 size={13} /> {count} kỳ trong phạm vi · bản dữ liệu {version}
    </span>
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
    <Link to={`/pairs/${pair.numbers.join('-')}${globalSearch(gameId, window)}`}>
      <Balls values={pair.numbers} />
    </Link>
  )
}
export function formatPercent(value: number | null) {
  return value === null ? '—' : `${value.toFixed(1)}%`
}
export function formatVietnamTime(value: string) {
  return `${new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))} (giờ VN)`
}
export function formatWindow(window: AnalysisWindow) {
  return window.kind === 'last_draws'
    ? `${window.count} kỳ gần nhất`
    : window.kind === 'all_time'
      ? 'toàn bộ lịch sử'
      : `${window.from_date} – ${window.to_date}`
}
