import { expect, test } from '@playwright/test'

test('number analysis reports the draw count and version from the response', async ({ page }) => {
  await page.route('**/api/v1/games/lotto_535/analytics/numbers?*', async (route) => {
    const response = await route.fetch()
    const data = await response.json()
    await route.fulfill({
      json: { ...data, context: { ...data.context, actual_draw_count: 7, data_version: 321 } },
    })
  })
  await page.goto('/numbers?game=lotto_535')
  await expect(page.locator('.frequency-tile')).toHaveCount(35)
  const details = page.locator('.data-details')
  await details.locator('summary').click()
  await expect(details.locator('dd')).toHaveText(['7', '321'])
})

test('stale number analysis retains its version until retry succeeds', async ({ page }) => {
  let refreshed = false
  let fail = false
  await page.route('**/api/v1/games/lotto_535/analytics/numbers?*', async (route) => {
    if (fail) return route.abort()
    const response = await route.fetch()
    const data = await response.json()
    await route.fulfill({
      json: { ...data, context: { ...data.context, data_version: refreshed ? 999 : 321 } },
    })
  })
  await page.route('**/api/v1/games/lotto_535/sync', (route) => {
    refreshed = true
    fail = true
    return route.fulfill({ json: { created: 0, enriched: 0, remaining_unresolved: 0 } })
  })
  await page.goto('/numbers?game=lotto_535')
  await expect(page.locator('.frequency-tile')).toHaveCount(35)
  await page.getByRole('button', { name: 'Sync', exact: true }).click()
  await expect(page.getByRole('alert').first()).toContainText('Stale data in same window')
  const details = page.locator('.data-details')
  await details.locator('summary').click()
  await expect(details.locator('dd').last()).toHaveText('321')
  fail = false
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(details.locator('dd').last()).toHaveText('999')
})

test('latest results remain visible while a refresh is pending', async ({ page }) => {
  let refreshed = false
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/games/lotto_535/draws/latest', async (route) => {
    if (refreshed) await pending
    await route.continue()
  })
  await page.route('**/api/v1/games/lotto_535/sync', (route) => {
    refreshed = true
    return route.fulfill({ json: { created: 0, enriched: 0, remaining_unresolved: 0 } })
  })
  await page.goto('/dashboard?game=lotto_535')
  const latest = page.locator('.latest-meta')
  await expect(latest).toBeVisible()
  const saved = await latest.locator('span').allTextContents()
  await page.getByRole('button', { name: 'Sync', exact: true }).click()
  await expect(page.locator('.latest-card').getByRole('status')).toContainText('Updating data')
  await expect(latest.locator('span')).toHaveText(saved)
  release()
  await expect(page.locator('.latest-card').getByRole('status')).toHaveCount(0)
})
