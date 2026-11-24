import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { History } from './History'
import { Numbers } from './Numbers'
import { Pairs } from './Pairs'

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

describe('mobile-optimized analytics pages', () => {
  it('renders Numbers in default grid layout without a View selector', () => {
    const { container } = render(
      <MemoryRouter>
        <Numbers />
      </MemoryRouter>,
    )
    expect(screen.queryByLabelText('View')).toBeNull()
    expect(screen.getByLabelText('Sort by')).toBeVisible()
    expect(container.querySelector('.numbers-page-grid')).not.toBeNull()
    expect(container.querySelector('.frequency-tile')).not.toBeNull()
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
