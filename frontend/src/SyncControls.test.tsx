import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SyncControls } from './SyncControls'
import { api } from './api'

const refreshData = vi.fn()
vi.mock('./state', () => ({
  useApp: () => ({ game: { id: 'lotto_535', label: 'Lotto 5/35' }, refreshData }),
}))
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  api: vi.fn(),
}))
afterEach(cleanup)

describe('manual collection control', () => {
  beforeEach(() => vi.clearAllMocks())

  it('submits once, disables during collection and refreshes after completion', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(api).mockReturnValue(new Promise((resolve) => (finish = resolve)))
    render(<SyncControls />)
    fireEvent.click(screen.getByRole('button', { name: 'Tải dữ liệu' }))
    expect(screen.getByRole('button', { name: 'Đang đồng bộ…' })).toBeDisabled()
    expect(api).toHaveBeenCalledWith('/games/lotto_535/sync', undefined, {})
    expect(api).toHaveBeenCalledTimes(1)
    await act(async () => finish({ created: 2, enriched: 0, remaining_unresolved: 8 }))
    expect(screen.getByRole('status')).toHaveTextContent('Lotto 5/35: đã thêm 2 kỳ mới')
    expect(screen.getByRole('status')).toHaveTextContent('8 kỳ lịch sử')
    expect(refreshData).toHaveBeenCalledTimes(1)
  })

  it('keeps the stored view and reports failure without claiming success', async () => {
    vi.mocked(api).mockRejectedValue(new Error('source unavailable'))
    render(<SyncControls />)
    fireEvent.click(screen.getByRole('button', { name: 'Tải dữ liệu' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('source unavailable'))
    expect(screen.getByRole('alert')).toHaveTextContent('Dữ liệu đã lưu vẫn được giữ')
    expect(refreshData).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/đã thêm/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Tải dữ liệu' })).toBeEnabled()
  })

  it('identifies a successful community fallback explicitly', async () => {
    vi.mocked(api).mockResolvedValue({
      created: 2,
      enriched: 0,
      remaining_unresolved: 0,
      source: 'community',
    })
    render(<SyncControls />)
    fireEvent.click(screen.getByRole('button', { name: 'Tải dữ liệu' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('đã thêm 2 kỳ mới'))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Nguồn dự phòng cộng đồng: vietvudanh/vietlott-data',
    )
  })
})
