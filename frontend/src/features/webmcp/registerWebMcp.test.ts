import { describe, expect, it, vi } from 'vitest'
import { registerWebMcpTools, type ModelContextLike, type WebMcpTool } from './registerWebMcp'

describe('WebMCP tool registration', () => {
  it('registers read-only historical analysis tools and forwards queries to /api/v1', async () => {
    const tools: WebMcpTool[] = []
    const signals: (AbortSignal | undefined)[] = []
    const mockContext: ModelContextLike = {
      registerTool: (tool, options) => {
        tools.push(tool)
        signals.push(options?.signal)
      },
    }

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ context: { game: 'mega_645' }, items: [] }))

    const cleanup = registerWebMcpTools(mockContext)
    expect(tools.map((t) => t.name)).toEqual([
      'get_games',
      'get_game_status',
      'get_latest_draw',
      'get_draws',
      'get_number_frequencies',
      'get_number_detail',
      'get_pair_frequencies',
      'check_combination',
    ])
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true)
    }

    const freqTool = tools.find((t) => t.name === 'get_number_frequencies')!
    const result = await freqTool.execute({ game: 'mega_645', count: 30 })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/games/mega_645/analytics/numbers?window=last_draws&count=30&number_kind=main&sort=frequency_desc',
      expect.objectContaining({ method: 'GET' }),
    )
    expect(JSON.parse(result.content[0].text)).toMatchObject({ context: { game: 'mega_645' } })

    await expect(freqTool.execute({ game: 'mega_645', number_kind: 'special' })).rejects.toThrow(
      /lotto_535/,
    )

    cleanup()
    expect(signals[0]?.aborted).toBe(true)
    fetchMock.mockRestore()
  })

  it('no-ops safely when document.modelContext is absent', () => {
    const cleanup = registerWebMcpTools(null)
    expect(() => cleanup()).not.toThrow()
  })
})
