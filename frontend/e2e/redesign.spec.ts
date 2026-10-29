import { expect, test } from '@playwright/test'

test('dashboard shows latest results before compact metrics and links to complete analysis', async ({
  page,
}) => {
  await page.goto('/dashboard?game=power_655&window=last_draws&count=20')
  await expect(page.locator('.latest-card .balls > .ball')).toHaveCount(6)
  const latest = await page.locator('.latest-card').boundingBox()
  const metrics = await page.locator('.dashboard-metrics').boundingBox()
  expect(latest).not.toBeNull()
  expect(metrics).not.toBeNull()
  expect(latest!.y).toBeLessThan(page.viewportSize()!.height)
  if (page.viewportSize()!.width < 1101) expect(latest!.y).toBeLessThan(metrics!.y)
  await expect(page.locator('.dashboard-metrics .metric')).toHaveCount(4)
  await expect(page.locator('.number-tile')).toHaveCount(6)
  await expect(page.locator('.dashboard-sections .draw-meta')).toHaveCount(3)
  await page.getByRole('link', { name: 'Xem tất cả' }).click()
  await expect(page.locator('.number-tile')).toHaveCount(55)
  await expect(page.getByLabel('Phạm vi phân tích')).toHaveValue('20')
})

test('mobile more navigation dismisses on Escape or outside click and restores useful focus', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile)
  await page.goto('/dashboard?game=mega_645&window=last_draws&count=20')
  const trigger = page.locator('.bottom-nav button')
  await trigger.click()
  await expect(page.locator('#more-menu a').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('#more-menu')).toHaveCount(0)
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.locator('h1').click()
  await expect(page.locator('#more-menu')).toHaveCount(0)
  await trigger.click()
  await page.locator('#more-menu a').first().click()
  await expect(page).toHaveURL(/\/numbers\?game=mega_645/)
  await expect(page.locator('#main-content')).toBeFocused()
  await expect(page.getByLabel('Phạm vi phân tích')).toHaveValue('20')
})

test('initial loading retains the shell and replaces skeletons with the requested game', async ({
  page,
}) => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/games', async (route) => {
    await pending
    await route.continue()
  })
  await page.goto('/dashboard?game=power_655')
  await expect(page.locator('.page-skeleton')).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('status')).toContainText('Đang tải danh sách game')
  await expect(page.locator('.metric-value')).toHaveCount(0)
  await expect(page.getByLabel('Chọn game')).toBeDisabled()
  release()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tổng quan Power 6/55')
  await expect(page.locator('.latest-card .balls > .ball')).toHaveCount(6)
  await expect(page.locator('.page-skeleton')).toHaveCount(0)
})
