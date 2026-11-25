import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('dashboard keeps useful analysis without decorative labels, duplicate KPIs or refresh', async ({
  page,
}) => {
  await page.goto('/dashboard?game=lotto_535&window=last_draws&count=30')
  await expect(page.locator('.latest-card .balls .ball')).toHaveCount(6)
  await expect(
    page.locator('.dashboard-metrics, .eyebrow, .sidebar-caption, .topbar-title'),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Refresh display' })).toHaveCount(0)
  await expect(page.locator('.dashboard-sections .frequency-tile')).toHaveCount(6)
  await expect(page.getByRole('heading', { name: 'Frequent Pairs' })).toBeVisible()
  const request = page.waitForResponse(
    (response) =>
      response.url().includes('/analytics/numbers?') && response.url().includes('count=10'),
  )
  await page.getByLabel('Analysis window').selectOption('10')
  await request
  await expect(page).toHaveURL(/count=10/)
  await expect(page.locator('.scope-summary').first()).toContainText('Actual: 10 draws')
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations).toEqual([])
  await page.locator('h1').click()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: test.info().outputPath('cleanup-dashboard.png'), fullPage: true })
})

test('unsupported games are hidden and unavailable from URL', async ({ page }) => {
  await page.route('**/api/v1/games', async (route) => {
    const response = await route.fetch()
    const result = await response.json()
    await route.fulfill({
      json: { items: [...result.items, { ...result.items[0], id: 'keno', label: 'Keno' }] },
    })
  })
  await page.goto('/dashboard?game=keno')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lotto 5/35 Overview')
  await expect(page.getByLabel('Select game').locator('option')).toHaveCount(3)
  await expect(page.getByRole('option', { name: 'Keno' })).toHaveCount(0)
})
