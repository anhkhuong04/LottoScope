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
  await expect(page.getByRole('button', { name: 'Làm mới hiển thị' })).toHaveCount(0)
  await expect(page.locator('.dashboard-sections .frequency-tile')).toHaveCount(6)
  await expect(page.getByRole('heading', { name: 'Các cặp xuất hiện nhiều' })).toBeVisible()
  const request = page.waitForResponse(
    (response) =>
      response.url().includes('/analytics/numbers?') && response.url().includes('count=10'),
  )
  await page.getByLabel('Phạm vi phân tích').selectOption('10')
  await request
  await expect(page).toHaveURL(/count=10/)
  const status = page.locator('.latest-card .data-details')
  await status.locator('summary').click()
  await expect(status).toContainText('Phiên bản dữ liệu')
  await expect(status).toContainText('Số kỳ trong phạm vi')
  await expect(page.locator('.sidebar')).not.toContainText('không dự đoán')
  const method = page.locator('#analysis-method')
  if (page.viewportSize()!.width >= 768) {
    await page.getByRole('link', { name: 'Phương pháp thống kê' }).click()
  } else {
    await page.getByRole('button', { name: 'Thêm', exact: true }).click()
    await page.getByRole('link', { name: 'Phương pháp thống kê' }).click()
    await expect(page.locator('#more-menu')).toHaveCount(0)
  }
  await expect(method).toHaveAttribute('open', '')
  await expect(method).toContainText('không dự đoán')
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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tổng quan Lotto 5/35')
  await expect(page.getByLabel('Chọn game').locator('option')).toHaveCount(3)
  await expect(page.getByRole('option', { name: 'Keno' })).toHaveCount(0)
})
