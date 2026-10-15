import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('flow A: dashboard to number detail, game and window switch', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Tổng quan Lotto/ })).toBeVisible()
  await expect(page.getByText('Kết quả gần nhất')).toBeVisible()
  await page.getByLabel('Phạm vi phân tích').selectOption('20')
  await expect(page).toHaveURL(/count=20/)
  await page
    .getByRole('link', { name: /Phân tích số|Xem tất cả/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: 'Tần suất & khoảng cách' })).toBeVisible()
  await page.locator('.number-tile').first().click()
  await expect(page.getByRole('heading', { name: /Số \d+/ })).toBeVisible()
  await page.getByLabel('Chọn game').selectOption('mega_645')
  await expect(page).toHaveURL(/\/numbers\?/)
  await expect(page.locator('.number-tile')).toHaveCount(45)
})

test('flow B: checker and flow C: generator with explanation', async ({ page }) => {
  await page.goto('/checker?game=lotto_535')
  for (const number of ['01', '02', '03', '04', '05'])
    await page.getByRole('button', { name: `Số ${number}` }).click()
  await page.getByRole('button', { name: 'Kiểm tra lịch sử' }).click()
  await expect(page.getByRole('heading', { name: /Trùng chính xác/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mức trùng số' })).toBeVisible()
  await page.goto('/generator?game=lotto_535')
  await page.getByRole('checkbox', { name: 'Giới hạn trùng kỳ trước' }).check()
  await page.getByRole('button', { name: 'Tạo bộ số' }).click()
  await expect(page.getByText(/bộ ·/)).toBeVisible()
  await page.getByRole('button', { name: 'Xem giải thích' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Giải thích bộ số' })).toBeVisible()
  await page.getByRole('button', { name: 'Đóng' }).click()
})

test('flow D: pair detail and responsive overflow', async ({ page }) => {
  await page.goto('/pairs?game=lotto_535&window=last_draws&count=30')
  await expect(page.getByRole('heading', { name: 'Cặp số trong lịch sử' })).toBeVisible()
  await page.locator('.data-table tbody a').first().click()
  await expect(page.getByRole('heading', { name: /Cặp \d+-\d+/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Các kỳ xuất hiện' })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
})

test('history date filter, details, labels and keyboard focus', async ({ page }) => {
  await page.goto('/history?game=lotto_535')
  await page.getByLabel('Từ ngày').fill('2026-09-01')
  await expect(page).toHaveURL(/from_date=2026-09-01/)
  await expect(page.getByRole('heading', { name: 'Kết quả các kỳ quay' })).toBeVisible()
  await page.getByRole('button', { name: 'Trang sau' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByText(/Trang 2\//)).toBeVisible()
  await page.keyboard.press('Tab')
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
})

test('cross-screen draw links keep valid filters', async ({ page }) => {
  await page.goto('/numbers/1?game=lotto_535&window=last_draws&count=30&sort=gap_desc')
  await page.locator('.timeline a').first().click()
  await expect(page.getByRole('heading', { name: /Kỳ/ })).toBeVisible()
  await page.getByRole('link', { name: 'Về lịch sử' }).click()
  await expect(page.getByRole('heading', { name: 'Kết quả các kỳ quay' })).toBeVisible()
  await expect(page).not.toHaveURL(/sort=gap_desc/)
  await page.goto('/history?game=lotto_535&sort=asc&from_date=2026-09-01')
  if (test.info().project.name === 'mobile') await page.locator('.draw-row a').first().click()
  else await page.locator('.data-table tbody a').first().click()
  await page.getByRole('link', { name: 'Về lịch sử' }).click()
  await expect(page).toHaveURL(/sort=asc/)
  await expect(page).toHaveURL(/from_date=2026-09-01/)
})

test('analysis window survives deep link and browser history', async ({ page }) => {
  await page.goto('/numbers?game=lotto_535&window=last_draws&count=30')
  await page.getByLabel('Phạm vi phân tích').selectOption('20')
  await expect(page).toHaveURL(/count=20/)
  await page.getByLabel('Phạm vi phân tích').selectOption('date_range')
  await page.getByLabel('Từ ngày').fill('2026-09-01')
  await page.getByLabel('Đến ngày').fill('2026-09-30')
  await page.getByRole('button', { name: 'Áp dụng' }).click()
  await expect(page).toHaveURL(/window=date_range/)
  await page.goBack()
  await expect(page.getByLabel('Phạm vi phân tích')).toHaveValue('20')
  await page.goBack()
  await expect(page.getByLabel('Phạm vi phân tích')).toHaveValue('30')
  await page.goForward()
  await expect(page.getByLabel('Phạm vi phân tích')).toHaveValue('20')
})

test('network error, retry and same-context stale data', async ({ page }) => {
  let fail = true
  await page.route('**/api/v1/games/lotto_535/analytics/numbers?*', async (route) =>
    fail ? route.abort() : route.continue(),
  )
  await page.goto('/numbers?game=lotto_535')
  await expect(page.getByRole('alert').getByText(/Không kết nối được API/)).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.locator('.number-tile')).toHaveCount(35)
  fail = true
  await page.getByRole('button', { name: 'Tải lại dữ liệu' }).click()
  await expect(page.getByText(/Dữ liệu cũ trong cùng phạm vi/)).toBeVisible()
  await expect(page.locator('.number-tile')).toHaveCount(35)
})

test('empty and invalid-input responses remain distinct', async ({ page }) => {
  await page.route('**/api/v1/games/lotto_535/analytics/pairs?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        context: {
          game: 'lotto_535',
          analysis_window: { kind: 'last_draws', count: 30 },
          as_of_draw_id: null,
          actual_draw_count: 0,
          data_version: 0,
        },
        page: 1,
        page_size: 25,
        total: 0,
        items: [],
      }),
    }),
  )
  await page.goto('/pairs?game=lotto_535')
  await expect(page.getByText('Không có cặp nào khớp bộ lọc.')).toBeVisible()
  await page.route('**/api/v1/games/lotto_535/analytics/numbers?*', (route) =>
    route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'invalid_window', message: 'Phạm vi không hợp lệ.', details: {} },
      }),
    }),
  )
  await page.goto('/numbers?game=lotto_535')
  await expect(page.getByRole('alert').getByText('Phạm vi không hợp lệ.')).toBeVisible()
  await page.route('**/api/v1/games/lotto_535/status', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'server_error', message: 'Dịch vụ tạm gián đoạn.', details: {} },
      }),
    }),
  )
  await page.goto('/dashboard?game=lotto_535')
  await expect(page.getByRole('alert').getByText('Dịch vụ tạm gián đoạn.')).toBeVisible()
})

test('mobile bottom navigation and touch targets', async ({ page, isMobile }) => {
  test.skip(!isMobile)
  await page.goto('/dashboard?game=lotto_535')
  await page.locator('.bottom-nav').getByRole('link', { name: 'Kiểm tra' }).click()
  await expect(page.getByRole('heading', { name: 'Đối chiếu với lịch sử' })).toBeVisible()
  await page.locator('.bottom-nav').getByRole('button', { name: 'Thêm' }).click()
  await page.getByRole('link', { name: 'Cặp số' }).click()
  await expect(page.getByRole('heading', { name: 'Cặp số trong lịch sử' })).toBeVisible()
  const sizes = await page
    .locator('.bottom-nav a, .bottom-nav button, .game-select select')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect()
        return [box.width, box.height]
      }),
    )
  expect(sizes.every(([width, height]) => width >= 44 && height >= 44)).toBe(true)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
})

test('key screens have no automated WCAG A/AA violations', async ({ page }) => {
  test.setTimeout(90_000)
  for (const path of [
    '/dashboard',
    '/history',
    '/history/00919',
    '/numbers',
    '/numbers/1',
    '/pairs',
    '/pairs/1-2',
    '/checker',
    '/generator',
  ]) {
    await page.goto(`${path}?game=lotto_535`)
    await page.getByLabel('Chọn game').waitFor()
    const report = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(
      report.violations.map(
        (item) => `${path}: ${item.id}: ${item.nodes.map((node) => node.target).join(', ')}`,
      ),
    ).toEqual([])
  }
})

test('MVP routes fit breakpoint edges without page-level horizontal scrolling', async ({
  page,
}) => {
  test.skip(test.info().project.name !== 'desktop')
  test.setTimeout(90_000)
  for (const width of [320, 390, 768, 820, 1024, 1365]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of [
      '/dashboard',
      '/history',
      '/numbers',
      '/numbers/1',
      '/pairs',
      '/pairs/1-2',
      '/checker',
      '/generator',
    ]) {
      await page.goto(`${path}?game=lotto_535`)
      await page.locator('.content h1').waitFor()
      await expect
        .poll(
          () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          { message: `${width}px ${path}` },
        )
        .toBe(true)
    }
  }
})
