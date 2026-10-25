import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DrawMachine from './DrawMachine'
import type { Game } from '../../api'

vi.mock('./DrawScene', async () => {
  const { useEffect } = await import('react')
  return {
    default: function MockScene({
      onSnapshot,
      action,
      count,
    }: {
      onSnapshot: (s: object) => void
      action: { type: string } | null
      count: number
    }) {
      useEffect(() => {
        onSnapshot({ status: 'ready', drawn: [], error: null })
      }, [onSnapshot])
      useEffect(() => {
        if (action?.type === 'start') onSnapshot({ status: 'drawing', drawn: [], error: null })
      }, [action, onSnapshot])
      return (
        <button
          onClick={() =>
            onSnapshot({
              status: 'complete',
              drawn: count === 5 ? [35, 1, 9, 20, 30] : [6, 1, 9, 20, 30, 45],
              error: null,
            })
          }
        >
          Physical exit fixture
        </button>
      )
    },
  }
})
const mega: Game = {
  id: 'mega_645',
  label: 'Mega 6/45',
  main_count: 6,
  main_min: 1,
  main_max: 45,
  special_min: null,
  special_max: null,
}
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
function setup(supported = true) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    supported ? ({ getExtension: () => null } as unknown as WebGL2RenderingContext) : null,
  )
  return render(
    <MemoryRouter>
      <DrawMachine game={mega} analysisWindow={{ kind: 'last_draws', count: 30 }} />
    </MemoryRouter>,
  )
}
describe('draw controls', () => {
  it('does not autostart, reveals only physical results and sends a sorted combination to checker', async () => {
    setup()
    const start = await screen.findByRole('button', { name: 'Bắt đầu quay' })
    await waitFor(() => expect(start).toBeEnabled())
    expect(screen.getByRole('status')).toHaveTextContent('Sẵn sàng')
    expect(screen.queryByRole('link', { name: 'Kiểm tra lịch sử' })).not.toBeInTheDocument()
    fireEvent.click(start)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Đang lấy bóng'))
    fireEvent.click(screen.getByText('Physical exit fixture'))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Hoàn tất · 6 số chính'),
    )
    expect(screen.getByRole('link', { name: 'Kiểm tra lịch sử' })).toHaveAttribute(
      'href',
      '/checker?game=mega_645&window=last_draws&count=30&numbers=1%2C6%2C9%2C20%2C30%2C45',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Phiên mới' }))
    expect(screen.queryByRole('link', { name: 'Kiểm tra lịch sử' })).not.toBeInTheDocument()
  })
  it('reports unavailable WebGL without inventing numbers', async () => {
    setup(false)
    expect(await screen.findByRole('alert')).toHaveTextContent('WebGL 2')
    expect(screen.getByRole('button', { name: 'Bắt đầu quay' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: 'Kiểm tra lịch sử' })).not.toBeInTheDocument()
  })
  it('pauses the active session when the document becomes hidden', async () => {
    setup()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bắt đầu quay' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu quay' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Đang lấy bóng'))
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(await screen.findByText(/Tab đang ẩn/)).toBeVisible()
  })
  it('supports Lotto 5/35 with 5 balls and correct labels', async () => {
    const lotto: Game = {
      id: 'lotto_535',
      label: 'Lotto 5/35',
      main_count: 5,
      main_min: 1,
      main_max: 35,
      special_min: 1,
      special_max: 12,
    }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      getExtension: () => null,
    } as unknown as WebGL2RenderingContext)
    render(
      <MemoryRouter>
        <DrawMachine
          game={lotto}
          analysisWindow={{ kind: 'date_range', from_date: '2026-10-01', to_date: '2026-10-25' }}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('35 BÓNG')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Năm bóng. Một bộ số.' })).toBeInTheDocument()
    expect(screen.getByText('0 / 5')).toBeInTheDocument()
    expect(screen.getAllByText(/Bóng \d/)).toHaveLength(5)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Bắt đầu quay' })).toBeEnabled())
    expect(screen.queryByRole('link', { name: 'Kiểm tra lịch sử' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu quay' }))
    fireEvent.click(screen.getByText('Physical exit fixture'))
    expect(screen.getByRole('status')).toHaveTextContent('Hoàn tất · 5 số chính')
    expect(screen.getByRole('link', { name: 'Kiểm tra lịch sử' })).toHaveAttribute(
      'href',
      '/checker?game=lotto_535&window=date_range&from_date=2026-10-01&to_date=2026-10-25&numbers=1%2C9%2C20%2C30%2C35',
    )
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Sao chép' }))
      expect(await screen.findByText('Đã sao chép năm số chính.')).toBeVisible()
      expect(writeText).toHaveBeenCalledWith('01 09 20 30 35')
    } finally {
      vi.unstubAllGlobals()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Phiên mới' }))
    expect(screen.queryByRole('link', { name: 'Kiểm tra lịch sử' })).not.toBeInTheDocument()
    expect(screen.getByText('0 / 5')).toBeInTheDocument()
  })
})
