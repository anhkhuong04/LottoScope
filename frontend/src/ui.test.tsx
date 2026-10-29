import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DataState, Pager } from './ui'

afterEach(cleanup)

describe('data loading presentation', () => {
  it('shows an accessible skeleton without inventing values before data arrives', () => {
    render(
      <DataState loading error={null} hasData={false} retry={vi.fn()}>
        <p>Saved result</p>
      </DataState>,
    )
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải dữ liệu')
    expect(screen.queryByText('Saved result')).not.toBeInTheDocument()
  })

  it('preserves valid saved content and retry when refreshing the same context fails', () => {
    render(
      <DataState loading={false} error={new Error('Network unavailable')} hasData retry={vi.fn()}>
        <p>Saved result</p>
      </DataState>,
    )
    expect(screen.getByText('Saved result')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Dữ liệu cũ trong cùng phạm vi')
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('Pager', () => {
  it('jumps directly on Enter or the Go button without navigating while typing', async () => {
    const user = userEvent.setup()
    const setPage = vi.fn()
    render(<Pager page={1} total={944} pageSize={25} setPage={setPage} />)
    const input = screen.getByLabelText('Đến trang')
    await user.clear(input)
    await user.type(input, '15')
    expect(setPage).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(setPage).toHaveBeenLastCalledWith(15)
    await user.clear(input)
    await user.type(input, '38')
    await user.click(screen.getByRole('button', { name: 'Đi' }))
    expect(setPage).toHaveBeenLastCalledWith(38)
  })

  it.each(['', '0', '-1', '39', '1.5', '1e1', 'abc', '99999999999999999999'])(
    'rejects invalid page %j without calling navigation',
    (value) => {
      const setPage = vi.fn()
      render(<Pager page={1} total={944} pageSize={25} setPage={setPage} />)
      const input = screen.getByLabelText('Đến trang')
      fireEvent.change(input, { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: 'Đi' }))
      expect(screen.getByRole('alert')).toHaveTextContent('Nhập số trang từ 1 đến 38.')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(setPage).not.toHaveBeenCalled()
    },
  )

  it('restores the current page on Escape and synchronizes after page or total changes', async () => {
    const user = userEvent.setup()
    const setPage = vi.fn()
    const { rerender } = render(<Pager page={15} total={944} pageSize={25} setPage={setPage} />)
    await user.clear(screen.getByLabelText('Đến trang'))
    await user.type(screen.getByLabelText('Đến trang'), '999{Enter}{Escape}')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Đến trang')).toHaveValue('15')
    rerender(<Pager page={2} total={100} pageSize={25} setPage={setPage} />)
    expect(screen.getByLabelText('Đến trang')).toHaveValue('2')
    await user.click(screen.getByRole('button', { name: 'Trang trước' }))
    expect(setPage).toHaveBeenLastCalledWith(1)
    await user.click(screen.getByRole('button', { name: 'Trang sau' }))
    expect(setPage).toHaveBeenLastCalledWith(3)
  })

  it.each([0, 10])('disables navigation for a single page with %i items', (total) => {
    render(<Pager page={1} total={total} pageSize={25} setPage={vi.fn()} />)
    expect(screen.getByLabelText('Đến trang')).toBeDisabled()
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
  })

  it('does not request the current page again', () => {
    const setPage = vi.fn()
    render(<Pager page={15} total={944} pageSize={25} setPage={setPage} />)
    fireEvent.click(screen.getByRole('button', { name: 'Đi' }))
    expect(setPage).not.toHaveBeenCalled()
  })
})
