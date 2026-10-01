import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { parseWindow, useQuery } from './state'
import { validateNumbers } from './pages/Checker'

describe('URL analysis window', () => {
  it('defaults to 30 draws and accepts documented choices', () => {
    expect(parseWindow(new URLSearchParams())).toEqual({ kind: 'last_draws', count: 30 })
    expect(parseWindow(new URLSearchParams('window=last_draws&count=100'))).toEqual({
      kind: 'last_draws',
      count: 100,
    })
    expect(parseWindow(new URLSearchParams('window=last_draws&count=999'))).toEqual({
      kind: 'last_draws',
      count: 30,
    })
    expect(parseWindow(new URLSearchParams('window=all_time'))).toEqual({ kind: 'all_time' })
  })
})

describe('checker client validation', () => {
  it('checks count, domain and duplicate for both games', () => {
    expect(validateNumbers([1, 2, 3, 4, 5], 1, 35, 5)).toBeNull()
    expect(validateNumbers([1, 2, 3, 4, 5, 6], 1, 45, 6)).toBeNull()
    expect(validateNumbers([1, 2, 3, 4], 1, 35, 5)).toMatch(/đúng 5/)
    expect(validateNumbers([1, 2, 3, 4, 4], 1, 35, 5)).toMatch(/trùng/)
    expect(validateNumbers([1, 2, 3, 4, 46, 6], 1, 45, 6)).toMatch(/1 đến 45/)
  })
})

describe('context-aware server state', () => {
  it('hides old game data and ignores a late response', async () => {
    let resolveOld!: (value: string) => void
    const old = new Promise<string>((resolve) => {
      resolveOld = resolve
    })
    const load = vi.fn((key: string, _signal: AbortSignal) =>
      key === 'lotto' ? old : Promise.resolve('mega data'),
    )
    const { result, rerender } = renderHook(
      ({ key }) => useQuery(key, (signal) => load(key, signal)),
      { initialProps: { key: 'lotto' } },
    )
    rerender({ key: 'mega' })
    expect(result.current.data).toBeNull()
    await waitFor(() => expect(result.current.data).toBe('mega data'))
    act(() => resolveOld('lotto data'))
    expect(result.current.data).toBe('mega data')
  })

  it('keeps same-context data if refresh fails', async () => {
    let calls = 0
    const { result } = renderHook(() =>
      useQuery('same', async () => {
        calls++
        if (calls > 1) throw new Error('server error')
        return 'saved data'
      }),
    )
    await waitFor(() => expect(result.current.data).toBe('saved data'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.error?.message).toBe('server error'))
    expect(result.current.data).toBe('saved data')
  })
})
