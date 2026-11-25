import { expect, test } from '@playwright/test'
import type { AnalysisWindow, CheckResponse, Game } from '../src/apiTypes'

const game: Game = {
  id: 'lotto_535',
  label: 'Lotto 5/35',
  main_count: 5,
  main_min: 1,
  main_max: 35,
  special_min: 1,
  special_max: 12,
}

for (const outcome of ['success', 'failure after saving a draw'] as const) {
  test(`Checker refreshes after Sync with ${outcome} and keeps its selection`, async ({ page }) => {
    let drawCount = 30
    await page.route('**/api/v1/games', (route) => route.fulfill({ json: { items: [game] } }))
    await page.route('**/combinations/check', (route) => {
      const body = route.request().postDataJSON() as {
        analysis_window: AnalysisWindow
        main_numbers: number[]
        similar_page: number
        similar_page_size: number
      }
      expect(body.main_numbers).toEqual([1, 2, 3, 4, 5])
      const data: CheckResponse = {
        context: {
          game: game.id,
          analysis_window: body.analysis_window,
          actual_draw_count: 30,
          as_of_draw_id: drawCount === 30 ? '00030' : '00031',
          data_version: drawCount,
        },
        main_numbers: body.main_numbers,
        history_draw_count: drawCount,
        exact_match_count: 0,
        last_exact_match: null,
        overlap_histogram: {},
        similar_draws: {
          items: [],
          total: 15,
          page: body.similar_page,
          page_size: body.similar_page_size,
        },
        number_analysis: [],
        pair_analysis: [],
      }
      return route.fulfill({ json: data })
    })
    await page.route('**/api/v1/games/lotto_535/sync', (route) => {
      drawCount++
      return outcome === 'success'
        ? route.fulfill({ json: { created: 1, enriched: 0, remaining_unresolved: 0 } })
        : route.fulfill({
            status: 503,
            json: { error: { code: 'sync_source_unavailable' } },
          })
    })

    await page.goto('/checker?game=lotto_535&numbers=1,2,3,4,5')
    await expect(page.getByText('Checked 30 draws', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Next page' }).click()
    await expect(page.getByRole('textbox', { name: 'Go to page' })).toHaveValue('2')
    const numbersTab = page.getByRole('tab', { name: /^Numbers/ })
    await numbersTab.click()
    await page.getByRole('button', { name: 'Sync', exact: true }).click()

    await expect(page.getByText('Checked 31 draws', { exact: true })).toBeVisible()
    await expect(numbersTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('button', { name: 'Number 05' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('tab', { name: /^Similar Draws/ }).click()
    await expect(page.getByRole('textbox', { name: 'Go to page' })).toHaveValue('2')
  })
}
