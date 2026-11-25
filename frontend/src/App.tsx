import {
  CalendarDays,
  ChevronDown,
  GitCompareArrows,
  Grid2X2,
  LayoutDashboard,
  Menu,
  SearchCheck,
  Shuffle,
} from 'lucide-react'
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from 'react-router'
import { useEffect, useRef, useState } from 'react'
import { AppProvider, useApp } from './state'
import { Dashboard } from './pages/Dashboard'
import { History, DrawDetail } from './pages/History'
import { Numbers, NumberDetailPage } from './pages/Numbers'
import { Pairs, PairDetailPage } from './pages/Pairs'
import { Checker } from './pages/Checker'
import { Generator } from './pages/Generator'
import { globalSearch } from './api'
import './theme.css'
import { SyncControls } from './SyncControls'
import { LoadingSkeleton } from './ui'

const links = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/history', label: 'History', icon: CalendarDays },
  { to: '/numbers', label: 'Numbers', icon: Grid2X2 },
  { to: '/pairs', label: 'Pairs', icon: GitCompareArrows },
  { to: '/checker', label: 'Checker', icon: SearchCheck },
  { to: '/generator', label: 'Generator', icon: Shuffle },
]

function Shell() {
  const { games, game, gameId, gameError, retryGames, setGame, window } = useApp()
  const [more, setMore] = useState(false)
  const location = useLocation()
  const navigationType = useNavigationType()
  const moreButton = useRef<HTMLButtonElement>(null)
  const moreMenu = useRef<HTMLDivElement>(null)
  const main = useRef<HTMLElement>(null)
  const previousPath = useRef(location.pathname)
  useEffect(() => {
    if (!more) return
    moreMenu.current?.querySelector('a')?.focus()
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !moreMenu.current?.contains(event.target) &&
        !moreButton.current?.contains(event.target)
      )
        setMore(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMore(false)
        moreButton.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [more])
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname
      setMore(false)
      main.current?.focus({ preventScroll: true })
      if (navigationType !== 'POP') globalThis.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [location.pathname, navigationType])
  const search = globalSearch(gameId, window)
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="sidebar">
        <Link className="brand" aria-label="LottoScope — Dashboard" to={`/dashboard${search}`}>
          <span className="brand-mark">
            <img src="/lottoscope.svg" width="42" height="42" alt="" />
          </span>
          <span>
            Lotto<span className="brand-accent">Scope</span>
            <small>Historical Analysis</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={`${to}${search}`}
              aria-label={label}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand">
            <img src="/lottoscope.svg" width="28" height="28" alt="" />
            <strong>LottoScope</strong>
          </div>
          <div className="topbar-actions">
            <label className="game-select">
              Game{' '}
              <select
                aria-label="Select game"
                value={gameId}
                disabled={!games.length}
                onChange={(event) => {
                  setGame(event.target.value)
                  setMore(false)
                }}
              >
                {games.length ? (
                  games.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))
                ) : (
                  <option value={gameId}>Loading…</option>
                )}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </label>
            <SyncControls />
          </div>
        </header>
        <main id="main-content" className="content" ref={main} tabIndex={-1}>
          {gameError && (
            <div className="notice error" role="alert">
              {gameError} <button onClick={retryGames}>Retry</button>
            </div>
          )}
          {game ? (
            <Routes>
              <Route path="/" element={<Navigate to={`/dashboard${search}`} replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/history" element={<History />} />
              <Route path="/history/:drawId" element={<DrawDetail />} />
              <Route path="/numbers" element={<Numbers />} />
              <Route path="/numbers/:number" element={<NumberDetailPage />} />
              <Route path="/pairs" element={<Pairs />} />
              <Route path="/pairs/:pair" element={<PairDetailPage />} />
              <Route path="/checker" element={<Checker key={game.id} />} />
              <Route path="/generator" element={<Generator key={game.id} />} />
              <Route
                path="/generator/preview"
                element={<Navigate to={`/generator${search}`} replace />}
              />
              <Route path="/data/*" element={<Navigate to={`/dashboard${search}`} replace />} />
              <Route
                path="*"
                element={
                  <div className="card">
                    <h1>Page not found</h1>
                    <Link to={`/dashboard${search}`}>Back to dashboard</Link>
                  </div>
                }
              />
            </Routes>
          ) : gameError ? (
            <div className="card">No games available.</div>
          ) : (
            <LoadingSkeleton page />
          )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {[links[0], links[1], links[4], links[5]].map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={`${to}${search}`}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
        <button
          ref={moreButton}
          className={
            more ||
            location.pathname.startsWith('/numbers') ||
            location.pathname.startsWith('/pairs')
              ? 'active'
              : ''
          }
          onClick={() => setMore((value) => !value)}
          aria-expanded={more}
          aria-controls="more-menu"
        >
          <Menu size={21} />
          <span>More</span>
        </button>
      </nav>
      {more && (
        <div id="more-menu" className="more-menu" ref={moreMenu}>
          <p>More options</p>
          {[links[2], links[3]].map(({ to, label, icon: Icon }) => (
            <Link key={to} to={`${to}${search}`} onClick={() => setMore(false)}>
              <Icon size={20} />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
