import {
  Activity,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  GitCompareArrows,
  Grid2X2,
  LayoutDashboard,
  Menu,
  SearchCheck,
  Shuffle,
} from 'lucide-react'
import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router'
import { useState } from 'react'
import { AppProvider, useApp } from './state'
import { Dashboard } from './pages/Dashboard'
import { History, DrawDetail } from './pages/History'
import { Numbers, NumberDetailPage } from './pages/Numbers'
import { Pairs, PairDetailPage } from './pages/Pairs'
import { Checker } from './pages/Checker'
import { Generator } from './pages/Generator'
import { globalSearch } from './api'
import './index.css'
import { SyncControls } from './SyncControls'

const links = [
  { to: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { to: '/history', label: 'Lịch sử', icon: CalendarDays },
  { to: '/numbers', label: 'Số', icon: Grid2X2 },
  { to: '/pairs', label: 'Cặp số', icon: GitCompareArrows },
  { to: '/checker', label: 'Kiểm tra', icon: SearchCheck },
  { to: '/generator', label: 'Tạo bộ số', icon: Shuffle },
]

function Shell() {
  const { games, game, gameId, gameError, retryGames, setGame, window } = useApp()
  const [more, setMore] = useState(false)
  const location = useLocation()
  const search = globalSearch(gameId, window)
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" aria-label="LottoScope — Tổng quan" to={`/dashboard${search}`}>
          <span className="brand-mark">
            <Activity size={22} />
          </span>
          <span>
            Lotto<span className="brand-accent">Scope</span>
            <small>Phân tích lịch sử</small>
          </span>
        </Link>
        <p className="sidebar-caption">KHÁM PHÁ DỮ LIỆU</p>
        <nav aria-label="Điều hướng chính">
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
        <div className="sidebar-note">
          <CircleHelp size={18} />
          <span>Số liệu mô tả kết quả đã công bố; không dự đoán kỳ tiếp theo.</span>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand">
            <Activity size={22} />
            <strong>LottoScope</strong>
          </div>
          <div className="topbar-title">Lịch sử rõ ràng. Quyết định của bạn.</div>
          <label className="game-select">
            Game{' '}
            <select
              aria-label="Chọn game"
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
                <option value={gameId}>Đang tải…</option>
              )}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </label>
        </header>
        <main id="main-content" className="content">
          <SyncControls />
          {gameError && (
            <div className="notice error" role="alert">
              {gameError} <button onClick={retryGames}>Thử lại</button>
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
                path="*"
                element={
                  <div className="card">
                    <h1>Không tìm thấy trang</h1>
                    <Link to={`/dashboard${search}`}>Về tổng quan</Link>
                  </div>
                }
              />
            </Routes>
          ) : (
            <div className="card" role="status">
              {gameError ? 'Chưa có danh sách game.' : 'Đang tải danh sách game…'}
            </div>
          )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Điều hướng di động">
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
          <span>Thêm</span>
        </button>
      </nav>
      {more && (
        <div id="more-menu" className="more-menu">
          <p>Xem thêm</p>
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
