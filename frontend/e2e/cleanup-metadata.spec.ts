import { expect, test } from '@playwright/test'

test('analysis metadata remains available when sync status cannot load', async ({ page }) => {
  await page.route('**/api/v1/games/lotto_535/status', (route) => route.abort())
  await page.route('**/api/v1/games/lotto_535/analytics/numbers?*', async (route) => {
    const response = await route.fetch()
    const data = await response.json()
    await route.fulfill({
      json: { ...data, context: { ...data.context, actual_draw_count: 7, data_version: 321 } },
    })
  })
  await page.goto('/dashboard?game=lotto_535')
  await expect(page.locator('.frequency-tile')).toHaveCount(6)
  const details = page.locator('.latest-card .data-details')
  await expect(details.locator('summary')).toHaveText('Chưa kiểm tra được trạng thái đồng bộ')
  await details.locator('summary').click()
  await expect(details).toContainText('Số kỳ trong phạm vi: 7')
  await expect(details).toContainText('Phiên bản dữ liệu thống kê: 321')
  await expect(details.getByRole('button', { name: 'Thử lại' })).toBeVisible()
})

test('retained stale analysis keeps its version when current sync status is newer', async ({
  page,
}) => {
  let refreshed = false
  await page.route('**/api/v1/games/lotto_535/analytics/numbers?*', async (route) => {
    if (refreshed) return route.abort()
    const response = await route.fetch()
    const data = await response.json()
    await route.fulfill({ json: { ...data, context: { ...data.context, data_version: 321 } } })
  })
  await page.route('**/api/v1/games/lotto_535/status', async (route) => {
    const response = await route.fetch()
    const data = await response.json()
    await route.fulfill({ json: { ...data, data_version: refreshed ? 999 : 321 } })
  })
  await page.route('**/api/v1/games/lotto_535/sync', (route) => {
    refreshed = true
    return route.fulfill({ json: { created: 0, enriched: 0, remaining_unresolved: 0 } })
  })
  await page.goto('/dashboard?game=lotto_535')
  await expect(page.locator('.frequency-tile')).toHaveCount(6)
  await page.getByRole('button', { name: 'Đồng bộ', exact: true }).click()
  await expect(page.getByRole('alert').first()).toContainText('Dữ liệu cũ trong cùng phạm vi')
  const details = page.locator('.latest-card .data-details')
  await details.locator('summary').click()
  await expect(details).toContainText('Phiên bản dữ liệu thống kê: 321')
  await expect(details).not.toContainText('999')
})

test('latest results keep their column while a refresh is pending', async ({ page }) => {
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
  await expect(page.locator('.latest-meta')).toBeVisible()
  await page.getByRole('button', { name: 'Đồng bộ', exact: true }).click()
  await expect(page.locator('.latest-card').getByRole('status')).toContainText('Đang cập nhật')
  const result = await page.locator('.latest-meta').boundingBox()
  const status = await page.locator('.data-freshness').boundingBox()
  if (page.viewportSize()!.width >= 768) expect(result!.x).toBeLessThan(status!.x)
  else expect(result!.y).toBeLessThan(status!.y)
  release()
  await expect(page.locator('.latest-card').getByRole('status')).toHaveCount(0)
})
