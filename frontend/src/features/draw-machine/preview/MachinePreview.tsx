import { Component, lazy, Suspense, useCallback, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { globalSearch } from '../../../api'
import { useApp } from '../../../state'
import { PageHead } from '../../../ui'
import { defaultDesign, type Design, type View } from './design'
import { MachineFallback } from './MachineFallback'
import './preview.css'

const Scene = lazy(() => import('./PreviewScene'))
function initialDesign(): Design {
  return {
    ...defaultDesign,
    quality: window.matchMedia('(max-width: 767px)').matches ? 'economy' : 'standard',
  }
}
function supportsGraphics() {
  try {
    const context = document.createElement('canvas').getContext('webgl2')
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(context)
  } catch {
    return false
  }
}
class PreviewBoundary extends Component<
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

export function MachinePreview() {
  const { game, window: analysisWindow } = useApp()
  const [design, setDesign] = useState(initialDesign)
  const [view, setView] = useState<View>('isometric')
  const [cutaway, setCutaway] = useState(false)
  const [gateOpen, setGateOpen] = useState(false)
  const [supported, setSupported] = useState(supportsGraphics)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const onReady = useCallback(() => setReady(true), [])
  const onError = useCallback(() => {
    setFailed(true)
    setReady(false)
  }, [])
  const reset = () => {
    setDesign(initialDesign())
    setView('isometric')
    setCutaway(false)
    setGateOpen(false)
  }
  const retry = () => {
    setSupported(supportsGraphics())
    setFailed(false)
    setReady(false)
    setAttempt((value) => value + 1)
  }
  const unavailable = !supported || failed
  const update = <K extends keyof Design>(key: K, value: Design[K]) =>
    setDesign((previous) => ({ ...previous, [key]: value }))
  return (
    <>
      <Link className="back-link" to={`/generator${globalSearch(game!.id, analysisWindow)}`}>
        <ArrowLeft size={16} aria-hidden="true" /> Về mô phỏng hiện tại
      </Link>
      <PageHead
        title="Thiết kế lồng cầu"
        description="Bản duyệt thiết kế tĩnh theo ảnh tham chiếu. Chưa tích hợp vật lý hoặc quay số."
      />
      <div className="machine-preview-layout">
        <section className="machine-preview-stage" aria-label="Mô hình lồng cầu tĩnh">
          <div className="machine-preview-views" role="group" aria-label="Góc nhìn">
            {(
              [
                ['isometric', 'Phối cảnh'],
                ['front', 'Mặt trước'],
                ['right', 'Bên phải'],
                ['top', 'Trên cao'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className="btn"
                aria-pressed={view === value}
                disabled={unavailable}
                onClick={() => setView(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="machine-preview-canvas" aria-hidden={!unavailable}>
            {!unavailable ? (
              <PreviewBoundary key={`${game!.id}-${attempt}`} onError={onError}>
                <Suspense
                  fallback={<p className="machine-preview-loading">Đang tải mô hình 3D…</p>}
                >
                  <Scene
                    design={design}
                    count={game!.main_max}
                    view={view}
                    cutaway={cutaway}
                    gateOpen={gateOpen}
                    onReady={onReady}
                    onError={onError}
                  />
                </Suspense>
              </PreviewBoundary>
            ) : (
              <MachineFallback />
            )}
          </div>
          {unavailable ? (
            <div className="machine-preview-error" role="alert">
              <p>
                {failed
                  ? 'Mất kết nối đồ họa hoặc không dựng được mô hình. Bạn vẫn có thể xem hình minh họa.'
                  : 'Thiết bị chưa hỗ trợ WebGL 2. Đang hiển thị hình minh họa; hãy bật tăng tốc đồ họa hoặc dùng trình duyệt khác để xem 3D.'}
              </p>
              <button className="btn" onClick={retry}>
                Thử lại 3D
              </button>
            </div>
          ) : (
            <p className="machine-preview-status" role="status" aria-label="Trạng thái mô hình">
              {game!.main_max} bóng tĩnh · {ready ? 'Sẵn sàng' : 'Đang tải'}
            </p>
          )}
          <p className="machine-preview-hint">
            Kéo để đổi góc, cuộn để phóng to. Có thể dùng các nút góc nhìn và thanh kích thước.
          </p>
        </section>
        <aside className="machine-preview-settings card" aria-label="Cấu hình thiết kế">
          <h2>Thiết kế</h2>
          <fieldset disabled={unavailable}>
            <legend>Quan sát</legend>
            <label className="machine-preview-check">
              <input
                type="checkbox"
                checked={cutaway}
                onChange={(event) => setCutaway(event.target.checked)}
              />
              Mở vỏ phía trước
            </label>
            <label className="machine-preview-check">
              <input
                type="checkbox"
                checked={gateOpen}
                onChange={(event) => setGateOpen(event.target.checked)}
              />
              Mở cửa thoát
            </label>
            <label className="field">
              Kích thước mô hình{' '}
              <input
                type="range"
                min="0.75"
                max="1.25"
                step="0.05"
                value={design.scale}
                onChange={(event) => update('scale', Number(event.target.value))}
              />
              <output>{Math.round(design.scale * 100)}%</output>
            </label>
            <label className="field">
              Độ hiện vỏ acrylic{' '}
              <input
                type="range"
                min="0"
                max="0.35"
                step="0.01"
                value={design.acrylicOpacity}
                onChange={(event) => update('acrylicOpacity', Number(event.target.value))}
              />
            </label>
          </fieldset>
          <fieldset disabled={unavailable}>
            <legend>Vật liệu</legend>
            <div className="machine-preview-colors">
              <label className="field">
                Khung{' '}
                <input
                  type="color"
                  value={design.frameColor}
                  onChange={(event) => update('frameColor', event.target.value)}
                />
              </label>
              <label className="field">
                Bóng{' '}
                <input
                  type="color"
                  value={design.ballColor}
                  onChange={(event) => update('ballColor', event.target.value)}
                />
              </label>
              <label className="field">
                Chữ số{' '}
                <input
                  type="color"
                  value={design.digitColor}
                  onChange={(event) => update('digitColor', event.target.value)}
                />
              </label>
            </div>
            <label className="field">
              Chất lượng{' '}
              <select
                value={design.quality}
                onChange={(event) => update('quality', event.target.value as Design['quality'])}
              >
                <option value="standard">Tiêu chuẩn</option>
                <option value="economy">Tiết kiệm</option>
              </select>
            </label>
          </fieldset>
          <button className="btn" onClick={reset}>
            <RotateCcw size={16} aria-hidden="true" />
            Đặt lại thiết kế
          </button>
          <p className="muted">
            Các bóng là bố trí minh họa. Cửa mở/đóng chỉ dùng để đánh giá hình dáng cơ khí.
          </p>
        </aside>
      </div>
    </>
  )
}
