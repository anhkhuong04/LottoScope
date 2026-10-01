import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { api, type AnalysisWindow, type Game } from './api'

type AppContext = {
  games: Game[]
  game: Game | null
  gameId: string
  gameError: string | null
  retryGames: () => void
  setGame: (id: string) => void
  window: AnalysisWindow
  setWindow: (value: AnalysisWindow) => void
}
const Context = createContext<AppContext | null>(null)
const allowedCounts = [10, 20, 30, 50, 100]

export function parseWindow(search: URLSearchParams): AnalysisWindow {
  if (search.get('window') === 'all_time') return { kind: 'all_time' }
  if (
    search.get('window') === 'date_range' &&
    /^\d{4}-\d{2}-\d{2}$/.test(search.get('from_date') ?? '') &&
    /^\d{4}-\d{2}-\d{2}$/.test(search.get('to_date') ?? '')
  )
    return {
      kind: 'date_range',
      from_date: search.get('from_date')!,
      to_date: search.get('to_date')!,
    }
  const count = Number(search.get('count'))
  return { kind: 'last_draws', count: allowedCounts.includes(count) ? count : 30 }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [games, setGames] = useState<Game[]>([])
  const [gameError, setGameError] = useState<string | null>(null)
  const [gamesAttempt, setGamesAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    api<{ items: Game[] }>('/games', controller.signal)
      .then((result) => {
        setGames(result.items)
        setGameError(null)
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setGameError(error instanceof Error ? error.message : 'Không tải được danh sách game.')
      })
    return () => controller.abort()
  }, [gamesAttempt])
  const requestedGameId =
    search.get('game') ??
    (typeof localStorage !== 'undefined' ? localStorage.getItem('lottoscope-game') : null) ??
    'lotto_535'
  const gameId =
    games.length && !games.some((item) => item.id === requestedGameId)
      ? games[0].id
      : requestedGameId
  const game = games.find((item) => item.id === gameId) ?? null
  const window = parseWindow(search)
  const setGame = (id: string) => {
    localStorage.setItem('lottoscope-game', id)
    const next = new URLSearchParams({ game: id })
    if (window.kind === 'last_draws') {
      next.set('window', 'last_draws')
      next.set('count', String(window.count))
    }
    if (window.kind === 'all_time') next.set('window', 'all_time')
    if (window.kind === 'date_range') {
      next.set('window', 'date_range')
      next.set('from_date', window.from_date)
      next.set('to_date', window.to_date)
    }
    const parent = location.pathname.startsWith('/numbers/')
      ? '/numbers'
      : location.pathname.startsWith('/pairs/')
        ? '/pairs'
        : location.pathname.startsWith('/history/')
          ? '/history'
          : location.pathname
    navigate(`${parent}?${next.toString()}`)
  }
  const setWindow = (value: AnalysisWindow) => {
    const next = new URLSearchParams(search)
    for (const key of ['window', 'count', 'from_date', 'to_date', 'page']) next.delete(key)
    next.set('window', value.kind)
    if (value.kind === 'last_draws') next.set('count', String(value.count))
    if (value.kind === 'date_range') {
      next.set('from_date', value.from_date)
      next.set('to_date', value.to_date)
    }
    setSearch(next)
  }
  const context = {
    games,
    game,
    gameId,
    gameError,
    retryGames: () => setGamesAttempt((value) => value + 1),
    setGame,
    window,
    setWindow,
  }
  return <Context.Provider value={context}>{children}</Context.Provider>
}

export function useApp() {
  const value = useContext(Context)
  if (!value) throw new Error('AppProvider is missing')
  return value
}

export function useQuery<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{
    key: string
    data: T | null
    error: Error | null
    loading: boolean
  }>({ key, data: null, error: null, loading: true })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setState((previous) => ({
      key,
      data: previous.key === key ? previous.data : null,
      error: null,
      loading: true,
    }))
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data, error: null, loading: false })
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            key,
            data: previous.key === key ? previous.data : null,
            error: error instanceof Error ? error : new Error('Lỗi không xác định'),
            loading: false,
          }))
      })
    return () => controller.abort()
    // Key captures request parameters; attempt explicitly retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])
  return {
    data: state.key === key ? state.data : null,
    error: state.key === key ? state.error : null,
    loading: state.key !== key || state.loading,
    retry: () => setAttempt((value) => value + 1),
  }
}

export function useUrlField(name: string, defaultValue: string) {
  const [search, setSearch] = useSearchParams()
  const value = search.get(name) ?? defaultValue
  const setValue = (nextValue: string) => {
    const next = new URLSearchParams(search)
    if (nextValue === '' || nextValue === defaultValue) next.delete(name)
    else next.set(name, nextValue)
    if (name !== 'page') next.delete('page')
    setSearch(next)
  }
  return [value, setValue] as const
}
