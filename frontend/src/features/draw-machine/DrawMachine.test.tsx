import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DrawMachine, { type Snapshot } from './DrawMachine'
import type { Game } from '../../api'

vi.mock('./DrawScene', async () => {
  const { useEffect } = await import('react')
  return {
    default: function MockScene({
      onSnapshot,
      action,
      count,
    }: {
      onSnapshot: (s: Snapshot) => void
      action: { type: string } | null
      count: number
    }) {
      useEffect(() => {
        onSnapshot({ status: 'ready', drawn: [], error: null, phase: 'main', specialNumber: null })
      }, [onSnapshot])
      useEffect(() => {
        if (action?.type === 'start')
          onSnapshot({
            status: 'drawing',
            drawn: [],
            error: null,
            phase: 'main',
            specialNumber: null,
          })
      }, [action, onSnapshot])
      return (
        <>
          <button
            onClick={() =>
              onSnapshot({
                status: count === 5 ? 'mixing' : 'complete',
                drawn: count === 5 ? [35, 1, 9, 20, 30] : [6, 1, 9, 20, 30, 45],
                error: null,
                phase: count === 5 ? 'special' : 'main',
                specialNumber: null,
              })
            }
          >
            Physical exit fixture
          </button>
          <button
            onClick={() =>
              onSnapshot({
                status: 'complete',
                drawn: [35, 1, 9, 20, 30],
                phase: 'special',
                specialNumber: 9,
                error: null,
              })
            }
          >
            Special exit fixture
          </button>
        </>
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
    const start = await screen.findByRole('button', { name: 'Start Draw' })
    await waitFor(() => expect(start).toBeEnabled())
    expect(screen.getByRole('status')).toHaveTextContent('Ready')
    expect(screen.queryByRole('link', { name: 'Check history' })).not.toBeInTheDocument()
    fireEvent.click(start)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Drawing ball'))
    fireEvent.click(screen.getByText('Physical exit fixture'))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Complete · 6 main numbers'),
    )
    expect(screen.getByRole('link', { name: 'Check history' })).toHaveAttribute(
      'href',
      '/checker?game=mega_645&window=last_draws&count=30&numbers=1%2C6%2C9%2C20%2C30%2C45',
    )
    fireEvent.click(screen.getByRole('button', { name: 'New session' }))
    expect(screen.queryByRole('link', { name: 'Check history' })).not.toBeInTheDocument()
  })
  it('reports unavailable WebGL without inventing numbers', async () => {
    setup(false)
    expect(await screen.findByRole('alert')).toHaveTextContent('WebGL 2')
    expect(screen.getByRole('button', { name: 'Start Draw' })).toBeDisabled()
    expect(screen.queryByRole('link', { name: 'Check history' })).not.toBeInTheDocument()
  })
  it('pauses the active session when the document becomes hidden', async () => {
    setup()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Draw' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Start Draw' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Drawing ball'))
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(await screen.findByText(/Tab is hidden/)).toBeVisible()
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
    expect(screen.getByText('35 BALLS')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Five main numbers + one special number.' }),
    ).toBeInTheDocument()
    expect(screen.getByText('0 / 5 · SP 0 / 1')).toBeInTheDocument()
    expect(screen.getAllByText(/Ball \d/)).toHaveLength(5)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start Draw' })).toBeEnabled())
    expect(screen.queryByRole('link', { name: 'Check history' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start Draw' }))
    fireEvent.click(screen.getByText('Physical exit fixture'))
    expect(screen.getByRole('status')).toHaveTextContent('Mixing special balls')
    expect(screen.getByText('12 BALLS')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Check history' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Special exit fixture'))
    expect(screen.getByRole('status')).toHaveTextContent(
      'Complete · 5 main numbers + 1 special number',
    )
    expect(screen.getByLabelText('Special Number')).toHaveTextContent('09')
    expect(screen.getByRole('link', { name: 'Check history' })).toHaveAttribute(
      'href',
      '/checker?game=lotto_535&window=date_range&from_date=2026-10-01&to_date=2026-10-25&numbers=1%2C9%2C20%2C30%2C35',
    )
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
      expect(await screen.findByText('Copied five main numbers and special number.')).toBeVisible()
      expect(writeText).toHaveBeenCalledWith('01 09 20 30 35 | SP: 09')
    } finally {
      vi.unstubAllGlobals()
    }
    fireEvent.click(screen.getByRole('button', { name: 'New session' }))
    expect(screen.queryByRole('link', { name: 'Check history' })).not.toBeInTheDocument()
    expect(screen.getByText('0 / 5 · SP 0 / 1')).toBeInTheDocument()
  })
})
