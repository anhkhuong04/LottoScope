import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type CheckResponse } from '../api'
import { Checker } from './Checker'
import { Dashboard } from './Dashboard'
import { History } from './History'
import { NumberDetailPage, Numbers } from './Numbers'
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
    if (path.includes('/analytics/numbers/')) {
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
          number: 1,
          metrics: {
            number: 1,
            frequency: 5,
            frequency_percent: 16.7,
            frequency_rank: 2,
            current_gap: 1,
            average_gap: 4.5,
            max_gap: 10,
            last_seen_draw_id: '01025',
          },
          pair_partners: [],
          timeline_draw_ids: [],
          appearance_draws: { page: 1, page_size: 10, total: 0, items: [] },
        },
      }
    }
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
    if (path.includes('/draws/latest')) {
      return {
        loading: false,
        error: null,
        retry: vi.fn(),
        data: {
          draw_id: '01026',
          draw_date: '2026-11-23',
          draw_time: '21:00:00',
          main_numbers: [15, 22, 26, 27, 31],
          special_number: 1,
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

  it('auto-checks full combination on Checker, hides zero-exact boilerplate, and switches Kiểu A detail tabs', async () => {
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
      similar_draws: {
        page: 1,
        page_size: 5,
        total: 1,
        items: [
          {
            overlap_count: 4,
            draw: {
              draw_id: '01010',
              draw_date: '2026-11-10',
              draw_time: null,
              main_numbers: [1, 2, 3, 4, 35],
              special_number: 8,
              source_url: 'https://example.test/01010',
              source_retrieved_at: '2026-11-10T12:00:00Z',
            },
          },
        ],
      },
      number_analysis: [
        {
          number: 1,
          frequency: 12,
          frequency_percent: 40,
          current_gap: 2,
          average_gap: 3,
          max_gap: 8,
        },
      ],
      pair_analysis: [{ numbers: [1, 2], frequency: 4, percent_of_draws: 13.3 }],
    })
    const { container } = render(
      <MemoryRouter>
        <Checker />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: /Check history/i })).toBeNull()
    expect(screen.queryByPlaceholderText(/Quick enter/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /^Add$/i })).toBeNull()
    expect(container.querySelector('.checker-input-bar')).toBeNull()
    expect(container.querySelector('.token-box')).toBeNull()
    for (const num of ['01', '02', '03', '04', '05']) {
      fireEvent.click(screen.getByRole('button', { name: `Number ${num}` }))
    }
    expect(container.querySelector('.token-box')).toBeNull()
    await waitFor(() => expect(api).toHaveBeenCalledTimes(1))
    expect(api).toHaveBeenCalledWith(
      '/games/lotto_535/combinations/check',
      expect.any(Object),
      expect.objectContaining({ main_numbers: [1, 2, 3, 4, 5], similar_page_size: 5 }),
    )
    await waitFor(() => expect(screen.getByText('Checked 1026 draws')).toBeVisible())
    expect(screen.queryByText(/Exact Matches:/i)).toBeNull()
    expect(screen.queryByText(/No exact match found/i)).toBeNull()
    const dist = within(screen.getByLabelText('Match Distribution'))
    expect(dist.queryByText('0 matched')).toBeNull()
    expect(dist.queryByText('1 matched')).toBeNull()
    expect(dist.queryByText('2 matched')).toBeNull()
    expect(dist.getByText('3 matched')).toBeVisible()
    expect(dist.getByText('4 matched')).toBeVisible()
    expect(dist.getByText('5 matched')).toBeVisible()

    expect(screen.getByRole('tab', { name: /Similar Draws/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    const dimmedBalls = container.querySelectorAll('.checker-similar-row .ball.dimmed')
    expect(dimmedBalls).toHaveLength(1)
    expect(dimmedBalls[0]).toHaveTextContent('35')
    expect(container.querySelector('.draw-special-label')).toBeNull()
    expect(container.querySelector('.draw-special .ball.special')).toHaveTextContent('08')

    fireEvent.click(screen.getByRole('tab', { name: /Numbers/i }))
    expect(screen.getByRole('tab', { name: /Numbers/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('40.0%')).toBeVisible()

    fireEvent.click(screen.getByRole('tab', { name: /Pairs/i }))
    expect(screen.getByRole('tab', { name: /Pairs/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('13.3%')).toBeVisible()
  })

  it('shows exact match link pill on Checker only when exact_match_count > 0', async () => {
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
      exact_match_count: 1,
      last_exact_match: {
        draw_id: '01025',
        draw_date: '2026-11-23',
        draw_time: null,
        main_numbers: [1, 2, 3, 4, 5],
        special_number: 6,
        source_url: 'https://example.test/01025',
        source_retrieved_at: '2026-11-23T12:00:00Z',
      },
      overlap_histogram: { match_3: 2, match_4: 1, match_5: 1 },
      similar_draws: { page: 1, page_size: 5, total: 0, items: [] },
      number_analysis: [],
      pair_analysis: [],
    })
    render(
      <MemoryRouter>
        <Checker />
      </MemoryRouter>,
    )
    for (const num of ['01', '02', '03', '04', '05']) {
      fireEvent.click(screen.getByRole('button', { name: `Number ${num}` }))
    }
    await waitFor(() => expect(screen.getByText(/Exact match: 1 draw/)).toBeVisible())
    expect(screen.getByRole('link', { name: 'Draw 01025' })).toBeVisible()
  })

  it('aborts a pre-Sync Checker request and ignores its late response', async () => {
    const response: CheckResponse = {
      context: {
        game: 'lotto_535',
        analysis_window: mockState.window,
        actual_draw_count: 30,
        as_of_draw_id: '01027',
        data_version: 2,
      },
      main_numbers: [1, 2, 3, 4, 5],
      history_draw_count: 1027,
      exact_match_count: 0,
      last_exact_match: null,
      overlap_histogram: {},
      similar_draws: { items: [], page: 1, page_size: 5, total: 0 },
      number_analysis: [],
      pair_analysis: [],
    }
    let resolveOld!: (data: CheckResponse) => void
    const oldRequest = new Promise<CheckResponse>((resolve) => {
      resolveOld = resolve
    })
    vi.mocked(api).mockReturnValueOnce(oldRequest).mockResolvedValueOnce(response)
    const checker = () => (
      <MemoryRouter initialEntries={['/checker?numbers=1,2,3,4,5']}>
        <Checker />
      </MemoryRouter>
    )
    const { rerender } = render(checker())
    const oldSignal = vi.mocked(api).mock.calls[0][1]
    expect(oldSignal?.aborted).toBe(false)

    try {
      mockState.dataRevision++
      rerender(checker())
      expect(oldSignal?.aborted).toBe(true)
      expect(await screen.findByText('Checked 1027 draws')).toBeVisible()
      await act(async () => resolveOld({ ...response, history_draw_count: 1026 }))
      expect(screen.getByText('Checked 1027 draws')).toBeVisible()
      expect(screen.queryByText('Checked 1026 draws')).toBeNull()
    } finally {
      mockState.dataRevision = 0
    }
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

  it('renders responsive mobile pair rows alongside desktop table in Pairs without rank labels', () => {
    const { container } = render(
      <MemoryRouter>
        <Pairs />
      </MemoryRouter>,
    )
    expect(container.querySelector('.desktop-only.table-wrap')).not.toBeNull()
    expect(container.querySelector('.mobile-only.pair-mobile-list .pair-mobile-row')).not.toBeNull()
    expect(screen.getByText(/3 draws \(10.0%\)/)).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Rank' })).toBeNull()
    expect(screen.queryByText(/Rank \d+/)).toBeNull()
  })

  it('hides frequency rank and visible Special text across Dashboard and Number detail', () => {
    const dash = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )
    expect(dash.container.querySelector('.rank-label')).toBeNull()
    expect(dash.container.querySelector('.draw-special-label')).toBeNull()
    expect(
      dash.container.querySelector('.latest-card .draw-special .ball.special'),
    ).toHaveTextContent('01')
    expect(dash.container.textContent).not.toMatch(/\bRank\s+\d+/)
    dash.unmount()

    const detail = render(
      <MemoryRouter initialEntries={['/numbers/1']}>
        <Routes>
          <Route path="/numbers/:number" element={<NumberDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByText('5 draws (16.7%)')).toBeVisible()
    expect(screen.queryByText(/Frequency rank/i)).toBeNull()
    detail.unmount()
  })
})
