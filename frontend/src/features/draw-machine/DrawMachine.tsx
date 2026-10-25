import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import { Copy, Pause, Play, RotateCcw, CircleHelp } from 'lucide-react'
import { globalSearch, type AnalysisWindow, type Game } from '../../api'
import { Balls, PageHead } from '../../ui'
import type { Status } from './physics'
import './draw-machine.css'

const DrawScene = lazy(() => import('./DrawScene'))
export type Snapshot = { status: Status; drawn: number[]; error: string | null }
export type Action = { type: 'start' | 'pause' | 'resume'; id: number }
const initial: Snapshot = { status: 'ready', drawn: [], error: null }
const labels: Record<Status, string> = {
  ready: 'Sẵn sàng',
  mixing: 'Đang trộn bóng',
  drawing: 'Đang lấy bóng',
  paused: 'Đã tạm dừng',
  stalled: 'Chưa có bóng đi qua cửa',
  complete: 'Hoàn tất',
  error: 'Phiên quay đã dừng',
}
function statusLabel(status: Status, count: number): string {
  if (status === 'complete') return `Hoàn tất · ${count} số chính`
  return labels[status]
}
function supportsWebGL() {
  try {
    const context = document.createElement('canvas').getContext('webgl2')
    const supported = Boolean(context)
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    return supported
  } catch {
    return false
  }
}

class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function DrawMachine({
  game,
  analysisWindow,
}: {
  game: Game
  analysisWindow: AnalysisWindow
}) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial)
  const [ready, setReady] = useState(false)
  const [supported, setSupported] = useState(supportsWebGL)
  const [fatal, setFatal] = useState<string | null>(null)
  const [session, setSession] = useState(0)
  const currentSession = useRef(0)
  const [action, setAction] = useState<Action | null>(null)
  const [hidden, setHidden] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )
  const [message, setMessage] = useState('')
  const running = snapshot.status === 'mixing' || snapshot.status === 'drawing'
  const finished = snapshot.status === 'complete'
  const send = useCallback(
    (type: Action['type']) => setAction((previous) => ({ type, id: (previous?.id ?? 0) + 1 })),
    [],
  )
  const receive = useCallback(
    (value: Snapshot) => {
      if (currentSession.current !== session) return
      setReady(true)
      setSnapshot(value)
    },
    [session],
  )
  const sceneError = useCallback(() => {
    if (currentSession.current !== session) return
    setFatal('Không tải được cảnh 3D hoặc bộ máy vật lý. Hãy thử phiên mới hoặc tải lại trang.')
    setSnapshot((value) => ({ ...value, status: 'error' }))
  }, [session])
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && running) {
        send('pause')
        setMessage('Tab đang ẩn nên phiên quay đã tạm dừng. Bấm Tiếp tục khi quay lại.')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [running, send])
  const reset = () => {
    currentSession.current += 1
    setSupported(supportsWebGL())
    setSession((value) => value + 1)
    setSnapshot(initial)
    setReady(false)
    setFatal(null)
    setAction(null)
    setMessage('')
  }
  const canonical = [...snapshot.drawn].sort((a, b) => a - b)
  const countWord = game.main_count === 5 ? 'năm' : 'sáu'
  const countWordCap = countWord.charAt(0).toUpperCase() + countWord.slice(1)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        canonical.map((n) => String(n).padStart(2, '0')).join(' '),
      )
      if (currentSession.current !== session) return
      setMessage(`Đã sao chép ${countWord} số chính.`)
    } catch {
      if (currentSession.current !== session) return
      setMessage('Không sao chép tự động được. Bạn có thể chọn bộ số bên dưới để sao chép.')
    }
  }
  const failure =
    fatal ??
    snapshot.error ??
    (supported === false
      ? 'Trình duyệt chưa hỗ trợ WebGL 2. Hãy bật tăng tốc đồ họa hoặc dùng trình duyệt khác.'
      : null)
  return (
    <>
      <PageHead
        kicker="Tạo bộ số"
        title="Lồng cầu mô phỏng"
        description={`${game.label} · Bóng qua cửa quyết định kết quả. ${countWordCap} số chính, không áp dụng bộ lọc lịch sử.`}
      />
      <div className="draw-machine-layout">
        <section className="draw-stage" aria-label={`Lồng cầu ${game.label}`}>
          <div className="draw-stage-head">
            <span className="draw-stage-brand">
              LOTTOSCOPE <span>DRAW LAB</span>
            </span>
            <span className="draw-stage-badge">{game.main_max} BÓNG</span>
          </div>
          <div className="draw-controls">
            {snapshot.status === 'ready' && (
              <button
                className="btn primary"
                disabled={!ready || Boolean(failure)}
                onClick={() => send('start')}
              >
                <Play size={18} />
                Bắt đầu quay
              </button>
            )}
            {running && (
              <button className="btn primary" onClick={() => send('pause')}>
                <Pause size={18} />
                Tạm dừng
              </button>
            )}
            {(snapshot.status === 'paused' || snapshot.status === 'stalled') && !failure && (
              <button
                className="btn primary"
                onClick={() => {
                  setMessage('')
                  send('resume')
                }}
              >
                <Play size={18} />
                {snapshot.status === 'stalled' ? 'Trộn tiếp' : 'Tiếp tục'}
              </button>
            )}
            <button className="btn" onClick={reset}>
              <RotateCcw size={17} />
              Phiên mới
            </button>
          </div>
          <div className="draw-viewport">
            {supported && !fatal && (
              <div
                className={hidden ? 'draw-canvas is-concealed' : 'draw-canvas'}
                aria-hidden="true"
              >
                <SceneBoundary key={session} onError={sceneError}>
                  <Suspense fallback={<p className="draw-loading">Đang tải lồng cầu và vật lý…</p>}>
                    <DrawScene
                      max={game.main_max}
                      count={game.main_count}
                      action={action}
                      running={running}
                      onSnapshot={receive}
                      onError={sceneError}
                    />
                  </Suspense>
                </SceneBoundary>
              </div>
            )}
            {hidden && !failure && (
              <div className="draw-concealed-note">
                <Pause size={30} />
                <p>
                  Đang ẩn hình ảnh chuyển động.
                  <br />
                  Cơ chế quay vật lý giữ nguyên.
                </p>
              </div>
            )}
            {supported === null && <p className="draw-loading">Đang kiểm tra đồ họa…</p>}
            {failure && (
              <div className="draw-failure" role="alert">
                {failure}
                <button className="btn" onClick={reset}>
                  Thử lại cảnh 3D
                </button>
                {fatal && (
                  <button className="btn" onClick={() => window.location.reload()}>
                    Tải lại trang
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="draw-stage-foot">
            <span className={`draw-led${running ? ' active' : ''}`} />
            {failure
              ? 'Cảnh quay chưa sẵn sàng'
              : !ready
                ? 'Đang khởi tạo'
                : statusLabel(snapshot.status, game.main_count)}
            <span className="draw-stage-count">
              {snapshot.drawn.length} / {game.main_count}
            </span>
          </div>
        </section>
        <section className="card draw-console" aria-label="Điều khiển và kết quả quay">
          <p className="draw-eyebrow">PHIÊN QUAY CỤC BỘ</p>
          <h2>{countWordCap} bóng. Một bộ số.</h2>
          <p className="muted">
            Mỗi bóng có cùng kích thước và khối lượng. Số chỉ được ghi nhận sau khi bóng đi qua cửa
            lồng.
          </p>
          <div className="draw-status" role="status" aria-live="polite">
            {statusLabel(snapshot.status, game.main_count)}
          </div>
          <ol
            className="draw-result-slots"
            aria-label="Thứ tự bóng ra"
            style={{ gridTemplateColumns: `repeat(${game.main_count}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: game.main_count }, (_, i) => (
              <li key={i}>
                <span className={`draw-slot${snapshot.drawn[i] !== undefined ? ' filled' : ''}`}>
                  {snapshot.drawn[i] === undefined
                    ? '—'
                    : String(snapshot.drawn[i]).padStart(2, '0')}
                </span>
                <small>Bóng {i + 1}</small>
              </li>
            ))}
          </ol>
          <label className="draw-motion-option">
            <input
              type="checkbox"
              checked={hidden}
              onChange={(event) => setHidden(event.target.checked)}
            />
            Ẩn hình ảnh chuyển động
          </label>
          {snapshot.status === 'stalled' && (
            <p className="notice">
              Đã chờ 30 giây hoạt động chưa có bóng ra. Bạn có thể trộn tiếp; các số đã ra được giữ
              nguyên.
            </p>
          )}
          {finished && !failure && (
            <div className="draw-finished">
              <h3>Bộ số tăng dần</h3>
              <Balls values={canonical} />
              <div className="draw-result-actions">
                <button className="btn" onClick={copy}>
                  <Copy size={16} />
                  Sao chép
                </button>
                <Link
                  className="btn primary"
                  to={`/checker${globalSearch(game.id, analysisWindow)}&numbers=${encodeURIComponent(canonical.join(','))}`}
                >
                  Kiểm tra lịch sử
                </Link>
              </div>
            </div>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          <div className="draw-explainer">
            <CircleHelp size={19} />
            <p>
              Đây là kết quả mô phỏng, không phải kỳ quay chính thức hoặc dự đoán. Cơ cấu vật lý
              chưa được chứng nhận phân bố đồng đều.
            </p>
          </div>
        </section>
      </div>
    </>
  )
}
