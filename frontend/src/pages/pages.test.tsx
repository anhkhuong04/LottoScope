import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import { Checker } from './Checker'
import { History } from './History'
import { Numbers } from './Numbers'
import { Pairs } from './Pairs'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api')>()),
  api: vi.fn(),
}))

const mockState = {
  game: {
    id: 'lotto_535',
    label: 'Lotto 5/35',
    main_count: 5,
    main_min: 1,
    main_max: 35,
    special_min: 1,
    special_max: 12,
    special_excludes_main: false,
  },
  gameId: 'lotto_535',
  window: { kind: 'last_draws' as const, count: 30 },
  setWindow: vi.fn(),
  setGame: vi.fn(),
  games: [],
  gameError: null,
  retryGames: vi.fn(),
  dataRevision: 0,
  refreshData: vi.fn(),
}

vi.mock('../state', () => ({
  useApp: () => mockState,
  useUrlField: (_name: string, initial: string) => [initial, vi.fn()] as const,
  useQuery: (path: string) => {
    if (path.includes('/analytics/numbers')) {
      return {
        loading: false,
        error: null,
        retry: vi.fn(),
        data: {
          context: {
            game: 'lotto_535',
            analysis_window: { kind: 'last_draws', count: 30 },
            actual_draw_count: 30,
            as_of_draw_id: '01026',
            data_version: 1,
          },
          items: [
            {
              number: 1,
              frequency: 5,
              frequency_percent: 16.7,
              frequency_rank: 2,
              current_gap: 1,
              average_gap: 4.5,
              max_gap: 10,
              last_seen_draw_id: '01025',
            },
          ],
        },
      }
    }
    if (path.includes('/analytics/pairs')) {
      return {
        loading: false,
        error: null,
        retry: vi.fn(),
        data: {
          context: {
            game: 'lotto_535',
            analysis_window: { kind: 'last_draws', count: 30 },
            actual_draw_count: 30,
            as_of_draw_id: '01026',
            data_version: 1,
          },
          page: 1,
          page_size: 25,
          total: 1,
          items: [
            {
              numbers: [4, 11],
              frequency: 3,
              percent_of_draws: 10.0,
              current_gap: 2,
              last_seen_draw_id: '01024',
              frequency_rank: 1,
            },
          ],
        },
      }
    }
    return {
      loading: false,
      error: null,
      retry: vi.fn(),
      data: {
        page: 1,
        page_size: 25,
        total: 1,
        items: [
          {
            draw_id: '01026',
            draw_date: '2026-11-23',
            draw_time: '21:00:00',
            main_numbers: [15, 22, 26, 27, 31],
            special_number: 1,
          },
        ],
      },
    }
  },
}))

afterEach(cleanup)
beforeEach(() => vi.clearAllMocks())

describe('mobile-optimized analytics pages', () => {
  it('renders Numbers in default grid layout sorted descending without rank or meter bar', () => {
    const { container } = render(
      <MemoryRouter>
        <Numbers />
      </MemoryRouter>,
    )
    expect(screen.queryByLabelText('View')).toBeNull()
    expect(screen.getByLabelText('Sort by')).toHaveValue('frequency_desc')
    expect(container.querySelector('.numbers-page-grid')).not.toBeNull()
    expect(container.querySelector('.frequency-tile')).not.toBeNull()
    expect(container.querySelector('.rank-label')).toBeNull()
    expect(container.querySelector('.frequency-meter')).toBeNull()
  })

  it('auto-checks full combination on Checker without token chips or Check button and hides 0–2 matches', async () => {
    vi.mocked(api).mockResolvedValue({
      context: {
        game: 'lotto_535',
        analysis_window: { kind: 'last_draws', count: 30 },
        actual_draw_count: 30,
        as_of_draw_id: '01026',
        data_version: 1,
      },
      main_numbers: [1, 2, 3, 4, 5],
      history_draw_count: 1026,
      exact_match_count: 0,
      last_exact_match: null,
      overlap_histogram: {
        match_0: 500,
        match_1: 350,
        match_2: 140,
        match_3: 30,
        match_4: 6,
        match_5: 0,
      },
      similar_draws: { page: 1, page_size: 10, total: 0, items: [] },
      number_analysis: [],
      pair_analysis: [],
    })
    const { container } = render(
      <MemoryRouter>
        <Checker />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: /Check history/i })).toBeNull()
    expect(container.querySelector('.token-box')).toBeNull()
    for (const num of ['01', '02', '03', '04', '05']) {
      fireEvent.click(screen.getByRole('button', { name: `Number ${num}` }))
    }
    expect(container.querySelector('.token-box')).toBeNull()
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1))
    expect(api).toHaveBeenCalledWith(
      '/games/lotto_535/combinations/check',
      expect.any(Object),
      expect.objectContaining({ main_numbers: [1, 2, 3, 4, 5] }),
    )
    await waitFor(() => expect(screen.getByText('Exact Matches: 0 draw(s)')).toBeVisible())
    expect(screen.queryByText('0 matched')).toBeNull()
    expect(screen.queryByText('1 matched')).toBeNull()
    expect(screen.queryByText('2 matched')).toBeNull()
    expect(screen.getByText('3 matched')).toBeVisible()
    expect(screen.getByText('4 matched')).toBeVisible()
    expect(screen.getByText('5 matched')).toBeVisible()
  })

  it('toggles History advanced filter drawer state', () => {
    const { container } = render(
      <MemoryRouter>
        <History />
      </MemoryRouter>,
    )
    const toggle = screen.getByRole('button', { name: 'Filter' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(container.querySelector('.filter-extra.open')).toBeNull()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(container.querySelector('.filter-extra.open')).not.toBeNull()
  })

  it('renders responsive mobile pair rows alongside desktop table in Pairs', () => {
    const { container } = render(
      <MemoryRouter>
        <Pairs />
      </MemoryRouter>,
    )
    expect(container.querySelector('.desktop-only.table-wrap')).not.toBeNull()
    expect(container.querySelector('.mobile-only.pair-mobile-list .pair-mobile-row')).not.toBeNull()
    expect(screen.getByText(/3 draws \(10.0%\)/)).toBeInTheDocument()
  })
})
