import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Pre-deployment runs may relay to a scheduler-disabled API on a restored database.
const isolatedApi = process.env.POWER_TEST_API
test.beforeEach(async ({ page }) => {
  if (isolatedApi)
    await page.route('**/api/v1/**', async (route) => {
      const original = new URL(route.request().url())
      const response = await route.fetch({
        url: new URL(original.pathname + original.search, isolatedApi).href,
      })
      await route.fulfill({ response })
    })
})

test('Power numbers, deep links and game switch preserve window and use 55 numbers', async ({
  page,
}) => {
  await page.goto('/numbers?game=power_655&window=last_draws&count=20')
  await expect(page.getByLabel('Chọn game')).toHaveValue('power_655')
  await expect(page.locator('.number-tile')).toHaveCount(55)
  await page.locator('.number-tile').last().click()
  await expect(page).toHaveURL(/\/numbers\/55\?/)
  await expect(page.getByRole('heading', { name: 'Số 55', exact: true })).toBeVisible()
  await page.getByLabel('Chọn game').selectOption('mega_645')
  await expect(page.locator('.number-tile')).toHaveCount(45)
  await page.getByLabel('Chọn game').selectOption('power_655')
  await expect(page.locator('.number-tile')).toHaveCount(55)
  await expect(page.getByLabel('Phạm vi phân tích')).toHaveValue('20')
})

test('Power checker accepts exactly six main numbers and resets on game change', async ({
  page,
}) => {
  await page.goto('/checker?game=power_655')
  await expect(page.locator('.picker button')).toHaveCount(55)
  await expect(page.getByRole('button', { name: 'Kiểm tra lịch sử' })).toBeDisabled()
  await page.getByLabel('Nhập số').fill('05 10 14 23 24 38')
  await page.getByRole('button', { name: 'Thêm số' }).click()
  await expect(page.getByText('6/6 số đã chọn')).toBeVisible()
  await page.getByRole('button', { name: 'Kiểm tra lịch sử' }).click()
  await expect(page.getByRole('heading', { name: /Trùng chính xác: [1-9]/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mức trùng số' })).toBeVisible()
  await page.getByLabel('Chọn game').selectOption('mega_645')
  await expect(page.getByText('Chưa chọn số nào')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Kiểm tra lịch sử' })).toBeDisabled()
  await page.getByLabel('Chọn game').selectOption('power_655')
  await expect(page.locator('.picker button')).toHaveCount(55)
  await page.getByLabel('Nhập số').fill('56')
  await page.getByRole('button', { name: 'Thêm số' }).click()
  await expect(page.getByRole('alert')).toContainText('1 đến 55')
})

test('Power detail separates special and shows both Jackpots and five prize tiers', async ({
  page,
}) => {
  await page.goto('/history/00001?game=power_655')
  await expect(page.locator('.content .draw-special').first()).toContainText('35')
  await expect(page.locator('.prize-jackpot')).toHaveCount(2)
  await expect(page.locator('.prize-jackpot').first()).toContainText('30.528.493.950')
  await expect(page.locator('.prize-jackpot').last()).toContainText('3.058.721.550')
  const table = page.getByRole('table', { name: 'Bảng giải thưởng' })
  await expect(table.locator('tbody tr')).toHaveCount(5)
  const jackpot2 = table.getByRole('row', { name: /Jackpot 2/ })
  await expect(jackpot2.getByRole('img', { name: 'Trùng 5 số chính và số đặc biệt' })).toBeVisible()
  await expect(jackpot2.locator('.prize-symbol.special')).toHaveCount(1)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  const report = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(report.violations).toEqual([])
  await page.screenshot({
    path: `test-results/power-detail-${test.info().project.name}.png`,
    fullPage: true,
  })
})

test('Power generator yields six main numbers with explanation and pair detail works', async ({
  page,
}) => {
  await page.goto('/generator?game=power_655')
  await page.getByRole('checkbox', { name: 'Giới hạn trùng kỳ trước' }).check()
  await page.getByRole('button', { name: 'Tạo bộ số' }).click()
  await expect(page.locator('.result-list .result-item')).toHaveCount(5)
  await expect(page.locator('.result-list .result-item').first().locator('.ball')).toHaveCount(6)
  await expect(page.locator('.result-list .ball.special')).toHaveCount(0)
  await page.getByRole('button', { name: 'Xem giải thích' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Giới hạn trùng kỳ trước')).toBeVisible()
  await page.getByRole('button', { name: 'Đóng' }).click()
  await page.goto('/pairs/24-38?game=power_655&window=all_time')
  await expect(page.getByRole('heading', { name: 'Cặp 24-38' })).toBeVisible()
  await expect(page.locator('.draw-row')).not.toHaveCount(0)
})

test('late Mega response cannot replace Power analytics; Power error can retry', async ({
  page,
}) => {
  let release!: () => void
  let started!: () => void
  let finished!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const requested = new Promise<void>((resolve) => {
    started = resolve
  })
  const done = new Promise<void>((resolve) => {
    finished = resolve
  })
  await page.route('**/api/v1/games/mega_645/analytics/numbers?*', async (route) => {
    started()
    await pending
    await route.fulfill({ json: { items: [], context: { game: 'mega_645' } } })
    finished()
  })
  await page.goto('/numbers?game=mega_645')
  await requested
  await page.getByLabel('Chọn game').selectOption('power_655')
  await expect(page.locator('.number-tile')).toHaveCount(55)
  release()
  await done
  await expect(page.locator('.number-tile')).toHaveCount(55)
  let failed = true
  await page.route('**/api/v1/games/power_655/analytics/numbers?*', async (route) =>
    failed ? route.abort() : route.fallback(),
  )
  await page.getByRole('button', { name: 'Tải lại dữ liệu' }).click()
  await expect(page.getByText(/Dữ liệu cũ trong cùng phạm vi/)).toBeVisible()
  failed = false
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.number-tile')).toHaveCount(55)
})
