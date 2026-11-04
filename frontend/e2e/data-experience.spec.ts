import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('main and special balls use distinct solid colors with white digits', async ({ page }) => {
  await page.goto('/dashboard?game=lotto_535')
  const main = page.locator('.latest-card .ball:not(.special)').first()
  const special = page.locator('.latest-card .ball.special')
  await expect(main).toBeVisible()
  const colors = await main.evaluate((node) => [
    getComputedStyle(node).backgroundColor,
    getComputedStyle(node).color,
  ])
  expect(colors).toEqual(['rgb(21, 128, 61)', 'rgb(255, 255, 255)'])
  expect(
    await special.evaluate((node) => [
      getComputedStyle(node).backgroundColor,
      getComputedStyle(node).color,
    ]),
  ).toEqual(['rgb(185, 28, 28)', 'rgb(255, 255, 255)'])
})

test('Lotto special analytics keeps its pool, applied scope and appearance history separate', async ({
  page,
}) => {
  await page.goto('/numbers?game=lotto_535&window=last_draws&count=20')
  await expect(page.locator('.frequency-tile')).toHaveCount(35)
  await page.getByLabel('Nhóm số').selectOption('special')
  await expect(page.locator('.frequency-tile')).toHaveCount(12)
  await expect(page.locator('.frequency-tile .ball.special')).toHaveCount(12)
  await expect(page.locator('.scope-summary')).toContainText('20 kỳ gần nhất')
  await expect(page.locator('.scope-summary')).toContainText('Thực tế: 20 kỳ')
  await expect(page).toHaveURL(/number_kind=special/)
  await page.locator('.frequency-tile').first().click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Số đặc biệt 01')
  await expect(page.getByRole('heading', { name: 'Các cặp đi cùng' })).toHaveCount(0)
  await expect(page.locator('.draw-row .ball.special').first()).toHaveText('01')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.getByRole('link', { name: 'Về phân tích số' }).click()
  await expect(page.getByLabel('Nhóm số')).toHaveValue('special')
  await page.getByLabel('Chọn game').selectOption('mega_645')
  await expect(page.locator('.frequency-tile')).toHaveCount(45)
  await expect(page.getByLabel('Nhóm số')).toHaveCount(0)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('filter bars, scopes and dense ranks are visible across data screens', async ({ page }) => {
  for (const route of ['/dashboard', '/history', '/numbers', '/pairs']) {
    await page.goto(route + '?game=lotto_535&window=last_draws&count=10')
    await expect(page.getByRole('region', { name: 'Bộ lọc', exact: true })).toHaveCount(1)
    await expect(page.locator('.scope-summary').first()).toBeVisible()
    expect(
      await page.locator('h1').evaluate((node) => node.getBoundingClientRect().top),
    ).toBeLessThan(
      await page
        .getByRole('region', { name: 'Bộ lọc', exact: true })
        .evaluate((node) => node.getBoundingClientRect().top),
    )
  }
  await expect(page.getByRole('columnheader', { name: 'Hạng tần suất' })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  await page.screenshot({
    path: test.info().outputPath('pairs-data-experience.png'),
    fullPage: true,
  })
})

test('switching number pools discards a delayed main response', async ({ page }) => {
  let release!: () => void
  let started!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const requested = new Promise<void>((resolve) => {
    started = resolve
  })
  await page.route('**/api/v1/games/lotto_535/analytics/numbers?*', async (route) => {
    const main = new URL(route.request().url()).searchParams.get('number_kind') === 'main'
    if (main) {
      started()
      await pending
    }
    await route.continue()
  })
  await page.goto('/numbers?game=lotto_535')
  await requested
  await page.getByLabel('Nhóm số').selectOption('special')
  await expect(page.locator('.frequency-tile .ball.special')).toHaveCount(12)
  release()
  await expect(page.getByLabel('Nhóm số')).toHaveValue('special')
  await expect(page.locator('.frequency-tile')).toHaveCount(12)
  await expect(page.locator('.scope-summary')).toContainText('Số đặc biệt')
})

test('Dashboard retains special scope on refresh failure and labels the shortened pair list', async ({
  page,
}) => {
  let refreshed = false
  await page.route('**/api/v1/games/lotto_535/analytics/numbers?*', async (route) => {
    if (new URL(route.request().url()).searchParams.get('number_kind') !== 'special') {
      return route.continue()
    }
    if (refreshed) return route.abort()
    const response = await route.fetch()
    const payload = await response.json()
    await route.fulfill({
      json: {
        ...payload,
        context: { ...payload.context, actual_draw_count: 7, as_of_draw_id: '00123' },
      },
    })
  })
  await page.route('**/api/v1/games/lotto_535/sync', (route) => {
    refreshed = true
    return route.fulfill({ json: { created: 0, enriched: 0, remaining_unresolved: 0 } })
  })
  await page.goto('/dashboard?game=lotto_535')
  const special = page
    .locator('.card')
    .filter({ has: page.getByRole('heading', { name: 'Thống kê số đặc biệt Lotto 5/35' }) })
  await expect(special.locator('.frequency-tile')).toHaveCount(12)
  await page.getByRole('button', { name: 'Đồng bộ', exact: true }).click()
  await expect(special.getByRole('alert')).toContainText('Dữ liệu cũ trong cùng phạm vi')
  await expect(special.locator('.scope-summary')).toContainText('Thực tế: 7 kỳ')
  await expect(special.locator('.scope-summary')).toContainText('Đến kỳ 00123')
  await expect(special.locator('.frequency-tile .ball.special')).toHaveCount(12)
  await expect(page.locator('.pairs-summary .scope-summary')).toContainText('Cặp số chính')
  await expect(page.locator('.pairs-summary')).toContainText('Tối đa 5 cặp')
  await expect(page.locator('.pairs-summary')).toContainText('Cùng tần suất cùng hạng')
})
