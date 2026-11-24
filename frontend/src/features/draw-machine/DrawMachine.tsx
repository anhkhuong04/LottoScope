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
import type { Snapshot } from './session'
export type { Snapshot } from './session'
import './draw-machine.css'
import { MachineFallback } from './visual/MachineFallback'

const DrawScene = lazy(() => import('./DrawScene'))
export type Action = { type: 'start' | 'pause' | 'resume'; id: number }
const initial: Snapshot = {
  status: 'ready',
  drawn: [],
  specialNumber: null,
  phase: 'main',
  error: null,
}
const labels: Record<Snapshot['status'], string> = {
  ready: 'Ready',
  mixing: 'Mixing balls',
  drawing: 'Drawing ball',
  paused: 'Paused',
  stalled: 'No ball passed exit gate',
  complete: 'Complete',
  error: 'Draw session stopped',
}
function statusLabel(snapshot: Snapshot, count: number, hasSpecial: boolean): string {
  if (snapshot.status === 'complete')
    return `Complete · ${count} main numbers${hasSpecial ? ' + 1 special number' : ''}`
  if (snapshot.phase === 'special' && snapshot.status === 'mixing') return 'Mixing special balls'
  if (snapshot.phase === 'special' && snapshot.status === 'drawing') return 'Drawing special ball'
  return labels[snapshot.status]
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
  const specialMax = game.id === 'lotto_535' ? game.special_max : null
  const hasSpecial = specialMax !== null
  const running = snapshot.status === 'mixing' || snapshot.status === 'drawing'
  const finished =
    snapshot.status === 'complete' && (!hasSpecial || snapshot.specialNumber !== null)
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
    setFatal('Failed to load 3D scene or physics engine. Try a new session or refresh the page.')
    setSnapshot((value) => ({ ...value, status: 'error' }))
  }, [session])
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && running) {
        send('pause')
        setMessage('Tab is hidden so draw session was paused. Click Resume when you return.')
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    onVisibility()
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
  const countWord = game.main_count === 5 ? 'five' : 'six'
  const countWordCap = countWord.charAt(0).toUpperCase() + countWord.slice(1)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        canonical.map((n) => String(n).padStart(2, '0')).join(' ') +
          (hasSpecial ? ` | SP: ${String(snapshot.specialNumber).padStart(2, '0')}` : ''),
      )
      if (currentSession.current !== session) return
      setMessage(`Copied ${countWord} main numbers${hasSpecial ? ' and special number' : ''}.`)
    } catch {
      if (currentSession.current !== session) return
      setMessage('Automatic copy failed. You can select the numbers below to copy.')
    }
  }
  const failure =
    fatal ??
    snapshot.error ??
    (supported === false
      ? 'Browser does not support WebGL 2. Please enable hardware acceleration or use a supported browser.'
      : null)

  return (
    <div className="draw-page">
      <PageHead
        title="Draw Simulator"
        description={`${game.label} · Physical exit determines result. ${countWordCap} main numbers${hasSpecial ? ` and 1 special number (${game.special_min}–${specialMax})` : ''}, without applying historical filters.`}
      />
      <div className="draw-machine-layout">
        <section className="draw-stage" aria-label={`${game.label} Draw Chamber`}>
          <div className="draw-stage-overlay-top">
            <span className={`draw-stage-badge${snapshot.phase === 'special' ? ' special' : ''}`}>
              {snapshot.phase === 'special' ? specialMax : game.main_max} BALLS
            </span>
            <span className="draw-stage-pill-status">
              <span className={`draw-led${running ? ' active' : ''}`} />
              <span className="draw-stage-count">
                {snapshot.drawn.length} / {game.main_count}
                {hasSpecial && ` · SP ${snapshot.specialNumber === null ? 0 : 1} / 1`}
              </span>
            </span>
          </div>

          <div className="draw-viewport">
            {supported && !fatal && (
              <div
                className={hidden ? 'draw-canvas is-concealed' : 'draw-canvas'}
                aria-hidden="true"
              >
                <SceneBoundary key={session} onError={sceneError}>
                  <Suspense fallback={<p className="draw-loading">Loading machine and physics…</p>}>
                    <DrawScene
                      max={game.main_max}
                      count={game.main_count}
                      specialMax={specialMax}
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
                <Pause size={26} />
                <p>
                  3D motion rendering hidden.
                  <br />
                  Physical simulation remains active.
                </p>
              </div>
            )}
            {supported === null && <p className="draw-loading">Checking graphics support…</p>}
            {failure && (
              <div className="draw-failure" role="alert">
                <MachineFallback />
                {failure}
                <div className="draw-failure-actions">
                  <button className="btn" onClick={reset}>
                    Retry 3D scene
                  </button>
                  {fatal && (
                    <button className="btn" onClick={() => window.location.reload()}>
                      Reload page
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="draw-controls-floating">
            {snapshot.status === 'ready' && (
              <button
                className="btn primary"
                disabled={!ready || Boolean(failure)}
                onClick={() => send('start')}
              >
                <Play size={17} />
                Start Draw
              </button>
            )}
            {running && (
              <button className="btn primary" onClick={() => send('pause')}>
                <Pause size={17} />
                Pause
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
                <Play size={17} />
                {snapshot.status === 'stalled' ? 'Keep mixing' : 'Resume'}
              </button>
            )}
            <button className="btn" onClick={reset}>
              <RotateCcw size={16} />
              New session
            </button>
          </div>
        </section>

        <section className="draw-console" aria-label="Draw controls and results">
          <div className="draw-console-head">
            <p className="draw-eyebrow">LOCAL DRAW SESSION</p>
            <h2>
              {hasSpecial
                ? `${countWordCap} main numbers + one special number.`
                : `${countWordCap} balls. One combination.`}
            </h2>
            <p className="muted">
              Each ball has identical size and mass. Numbers are recorded only after passing through
              the 6-o&apos;clock discharge gate.
            </p>
          </div>

          <div className="draw-status-bar">
            <span className={`draw-led${running ? ' active' : ''}`} />
            <div className="draw-status" role="status" aria-live="polite">
              {statusLabel(snapshot, game.main_count, hasSpecial)}
            </div>
          </div>

          <div className={`draw-tray${hasSpecial ? ' has-special' : ''}`}>
            <ol
              className="draw-result-slots"
              aria-label="Draw sequence"
              style={{ gridTemplateColumns: `repeat(${game.main_count}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: game.main_count }, (_, i) => (
                <li key={i}>
                  <span className={`draw-slot${snapshot.drawn[i] !== undefined ? ' filled' : ''}`}>
                    {snapshot.drawn[i] === undefined
                      ? '—'
                      : String(snapshot.drawn[i]).padStart(2, '0')}
                  </span>
                  <small>Ball {i + 1}</small>
                </li>
              ))}
            </ol>

            {hasSpecial && (
              <div className="draw-special-result" aria-label="Special Number">
                <span
                  className={`draw-slot special${snapshot.specialNumber !== null ? ' filled' : ''}`}
                >
                  {snapshot.specialNumber === null
                    ? '—'
                    : String(snapshot.specialNumber).padStart(2, '0')}
                </span>
                <div>
                  <strong>Special Number</strong>
                  <small>
                    Red chamber · {game.special_min}–{specialMax}
                  </small>
                </div>
              </div>
            )}
          </div>

          {snapshot.status === 'stalled' && (
            <p className="notice">
              Waited 30 seconds of active simulation without an exit. You can keep mixing; already
              drawn balls are preserved.
            </p>
          )}

          {finished && !failure && (
            <div className="draw-finished">
              <h3>Sorted Combination</h3>
              <Balls values={canonical} special={snapshot.specialNumber} />
              {hasSpecial && (
                <p className="muted">History checker only compares the 5 main numbers.</p>
              )}
              <div className="draw-result-actions">
                <button className="btn" onClick={copy}>
                  <Copy size={16} />
                  Copy
                </button>
                <Link
                  className="btn primary"
                  to={`/checker${globalSearch(game.id, analysisWindow)}&numbers=${encodeURIComponent(canonical.join(','))}`}
                >
                  Check history
                </Link>
              </div>
            </div>
          )}

          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}

          <div className="draw-footer-options">
            <label className="draw-motion-option">
              <input
                type="checkbox"
                checked={hidden}
                onChange={(event) => setHidden(event.target.checked)}
              />
              Hide motion rendering
            </label>

            <div className="draw-explainer">
              <CircleHelp size={16} />
              <p>Local physics simulation only — not an official draw or prediction.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
