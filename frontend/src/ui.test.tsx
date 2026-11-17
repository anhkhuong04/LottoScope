import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContextNote, DataState, PageHead, Pager, ScopeSummary } from './ui'

afterEach(cleanup)

describe('data loading presentation', () => {
  it('shows the applied response window and actual sample rather than an assumed 30 draws', () => {
    render(
      <ScopeSummary
        context={{
          game: 'lotto_535',
          analysis_window: { kind: 'last_draws', count: 20 },
          actual_draw_count: 7,
          as_of_draw_id: '00985',
          data_version: 4,
        }}
      />,
    )
    expect(screen.getByText(/Last 20 draws/)).toBeVisible()
    expect(screen.getByText(/Actual: 7 draws/)).toBeVisible()
    expect(screen.getByText(/Through draw 00985/)).toBeVisible()
  })
  it('shows saved data without a redundant refresh action', () => {
    render(
      <DataState loading={false} error={null} hasData retry={vi.fn()}>
        <p>Saved result</p>
      </DataState>,
    )
    expect(screen.getByText('Saved result')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Refresh display' })).toBeNull()
  })

  it('keeps the page title and useful description without decorative labels', () => {
    render(<PageHead title="Overview" description="Saved history" />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Overview')
    expect(screen.getByText('Saved history')).toBeVisible()
    expect(screen.queryByText('Explore data')).toBeNull()
  })

  it('discloses actual sample size and data version in data status', () => {
    const { container } = render(<ContextNote count={12} version={995} />)
    expect(screen.getByText('Data details')).toBeVisible()
    expect(container.querySelector('details')).not.toHaveAttribute('open')
    expect(screen.queryByText(/data version 995/)).toBeNull()
    expect(screen.getByText('995')).not.toBeVisible()
  })
  it('shows an accessible skeleton without inventing values before data arrives', () => {
    render(
      <DataState loading error={null} hasData={false} retry={vi.fn()}>
        <p>Saved result</p>
      </DataState>,
    )
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Loading data')
    expect(screen.queryByText('Saved result')).not.toBeInTheDocument()
  })

  it('preserves valid saved content and retry when refreshing the same context fails', () => {
    render(
      <DataState loading={false} error={new Error('Network unavailable')} hasData retry={vi.fn()}>
        <p>Saved result</p>
      </DataState>,
    )
    expect(screen.getByText('Saved result')).toBeVisible()
    expect(screen.getByRole('alert')).toHaveTextContent('Stale data in same window')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('Pager', () => {
  it('jumps directly on Enter or the Go button without navigating while typing', async () => {
    const user = userEvent.setup()
    const setPage = vi.fn()
    render(<Pager page={1} total={944} pageSize={25} setPage={setPage} />)
    const input = screen.getByLabelText('Go to page')
    await user.clear(input)
    await user.type(input, '15')
    expect(setPage).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(setPage).toHaveBeenLastCalledWith(15)
    await user.clear(input)
    await user.type(input, '38')
    await user.click(screen.getByRole('button', { name: 'Go' }))
    expect(setPage).toHaveBeenLastCalledWith(38)
  })

  it.each(['', '0', '-1', '39', '1.5', '1e1', 'abc', '99999999999999999999'])(
    'rejects invalid page %j without calling navigation',
    (value) => {
      const setPage = vi.fn()
      render(<Pager page={1} total={944} pageSize={25} setPage={setPage} />)
      const input = screen.getByLabelText('Go to page')
      fireEvent.change(input, { target: { value } })
      fireEvent.click(screen.getByRole('button', { name: 'Go' }))
      expect(screen.getByRole('alert')).toHaveTextContent('Enter page number from 1 to 38.')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(setPage).not.toHaveBeenCalled()
    },
  )

  it('restores the current page on Escape and synchronizes after page or total changes', async () => {
    const user = userEvent.setup()
    const setPage = vi.fn()
    const { rerender } = render(<Pager page={15} total={944} pageSize={25} setPage={setPage} />)
    await user.clear(screen.getByLabelText('Go to page'))
    await user.type(screen.getByLabelText('Go to page'), '999{Enter}{Escape}')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Go to page')).toHaveValue('15')
    rerender(<Pager page={2} total={100} pageSize={25} setPage={setPage} />)
    expect(screen.getByLabelText('Go to page')).toHaveValue('2')
    await user.click(screen.getByRole('button', { name: 'Previous page' }))
    expect(setPage).toHaveBeenLastCalledWith(1)
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(setPage).toHaveBeenLastCalledWith(3)
  })

  it.each([0, 10])('disables navigation for a single page with %i items', (total) => {
    render(<Pager page={1} total={total} pageSize={25} setPage={vi.fn()} />)
    expect(screen.getByLabelText('Go to page')).toBeDisabled()
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled()
  })

  it('does not request the current page again', () => {
    const setPage = vi.fn()
    render(<Pager page={15} total={944} pageSize={25} setPage={setPage} />)
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(setPage).not.toHaveBeenCalled()
  })
})
