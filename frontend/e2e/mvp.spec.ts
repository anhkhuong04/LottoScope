import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('flow A: dashboard to number detail, game and window switch', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Lotto 5/35 Overview' })).toBeVisible()
  await expect(page.getByText('Latest Result')).toBeVisible()
  await page.getByLabel('Analysis window').selectOption('20')
  await expect(page).toHaveURL(/count=20/)
  await page.getByRole('link', { name: 'View all' }).first().click()
  await expect(page.getByRole('heading', { name: 'Frequency & Gaps' })).toBeVisible()
  await page.locator('.number-tile').first().click()
  await expect(page.getByRole('heading', { name: /^Number \d+/ })).toBeVisible()
  await page.getByLabel('Select game').selectOption('mega_645')
  await expect(page).toHaveURL(/\/numbers\?/)
  await expect(page.locator('.number-tile')).toHaveCount(45)
})

test('flow B: checker and flow C: generator with draw machine', async ({ page }) => {
  await page.goto('/checker?game=lotto_535')
  for (const number of ['01', '02', '03', '04', '05'])
    await page.getByRole('button', { name: `Number ${number}`, exact: true }).click()
  await expect(page.getByText(/Exact match: [1-9]/)).toBeVisible()
  await expect(page.getByLabel('Match Distribution')).toBeVisible()
  await page.goto('/generator?game=lotto_535')
  await expect(page.getByRole('heading', { name: 'Draw Simulator' })).toBeVisible()
  await expect(page.locator('.draw-stage-badge')).toHaveText('35 BALLS')
  await expect(page.locator('.draw-result-slots li')).toHaveCount(5)
})

test('flow D: pair detail and responsive overflow', async ({ page }) => {
  await page.goto('/pairs?game=lotto_535&window=last_draws&count=30')
  await expect(page.getByRole('heading', { name: 'Historical Number Pairs' })).toBeVisible()
  await page.locator('.pair-link:visible').first().click()
  await expect(page.getByRole('heading', { name: /^Pair \d+-\d+/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Appeared Draws' })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
})

test('history date filter, details, labels and keyboard focus', async ({ page }) => {
  await page.goto('/history?game=lotto_535')
  await expect(page.getByRole('heading', { name: 'Draw History' })).toBeVisible()
  const filter = page.getByRole('button', { name: 'Filter', exact: true })
  if (await filter.isVisible()) await filter.click()
  await page.getByLabel('From date').fill('2026-09-01')
  await expect(page).toHaveURL(/from_date=2026-09-01/)
  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(page).toHaveURL(/page=2/)
  await expect(page.getByText(/Page 2\//)).toBeVisible()
  await page.keyboard.press('Tab')
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true)
})

test('cross-screen draw links keep valid filters', async ({ page }) => {
  await page.goto('/numbers/1?game=lotto_535&window=last_draws&count=30&sort=gap_desc')
  await page.locator('.timeline a').first().click()
  await expect(page.getByRole('heading', { name: /^Draw \d{5}$/ })).toBeVisible()
  await page.getByRole('link', { name: 'Back to history' }).click()
  await expect(page.getByRole('heading', { name: 'Draw History' })).toBeVisible()
  await expect(page).not.toHaveURL(/sort=gap_desc/)
  await page.goto('/history?game=lotto_535&sort=asc&from_date=2026-09-01')
  if (test.info().project.name === 'mobile') await page.locator('.draw-row a').first().click()
  else await page.locator('.data-table tbody a').first().click()
  await page.getByRole('link', { name: 'Back to history' }).click()
  await expect(page).toHaveURL(/sort=asc/)
  await expect(page).toHaveURL(/from_date=2026-09-01/)
})

test('analysis window survives deep link and browser history', async ({ page }) => {
  await page.goto('/numbers?game=lotto_535&window=last_draws&count=30')
  await page.getByLabel('Analysis window').selectOption('20')
  await expect(page).toHaveURL(/count=20/)
  await page.getByLabel('Analysis window').selectOption('date_range')
  await page.getByLabel('From date').fill('2026-09-01')
  await page.getByLabel('To date').fill('2026-09-30')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page).toHaveURL(/window=date_range/)
  await page.goBack()
  await expect(page.getByLabel('Analysis window')).toHaveValue('20')
  await page.goBack()
  await expect(page.getByLabel('Analysis window')).toHaveValue('30')
  await page.goForward()
  await expect(page.getByLabel('Analysis window')).toHaveValue('20')
})

test('network error, retry and same-context stale data', async ({ page }) => {
  let fail = true
  await page.route('**/api/v1/games/lotto_535/analytics/numbers?*', async (route) =>
    fail ? route.abort() : route.continue(),
  )
  await page.goto('/numbers?game=lotto_535')
  await expect(page.getByRole('alert').getByText(/Unable to connect to API/)).toBeVisible()
  fail = false
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.locator('.number-tile')).toHaveCount(35)
  fail = true
  await page.route('**/api/v1/games/lotto_535/sync', (route) =>
    route.fulfill({
      json: { created: 0, enriched: 0, remaining_unresolved: 0 },
    }),
  )
  await page.getByRole('button', { name: 'Sync', exact: true }).click()
  await expect(page.getByText(/Stale data in same window/)).toBeVisible()
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
  await expect(page.getByText('No pairs match the filter.')).toBeVisible()
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
  await page.unroute('**/api/v1/games/lotto_535/analytics/numbers?*')
  await page.route('**/api/v1/games/lotto_535/draws/latest', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 'server_error', message: 'Dịch vụ tạm gián đoạn.', details: {} },
      }),
    }),
  )
  await page.goto('/dashboard?game=lotto_535')
  const latest = page.locator('.latest-card')
  await expect(latest.getByRole('alert').getByText('Dịch vụ tạm gián đoạn.')).toBeVisible()
  await expect(page.locator('.dashboard-sections .frequency-tile')).toHaveCount(6)
})

test('mobile bottom navigation and touch targets', async ({ page, isMobile }) => {
  test.skip(!isMobile)
  await page.goto('/dashboard?game=lotto_535')
  await page.locator('.bottom-nav').getByRole('link', { name: 'Checker' }).click()
  await expect(page.getByRole('heading', { name: 'Combination Checker' })).toBeVisible()
  await page.locator('.bottom-nav').getByRole('button', { name: 'More' }).click()
  await page.locator('#more-menu').getByRole('link', { name: 'Pairs' }).click()
  await expect(page.getByRole('heading', { name: 'Historical Number Pairs' })).toBeVisible()
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
    await page.getByLabel('Select game').waitFor()
    await expect(page.locator('.skeleton-content')).toHaveCount(0)
    // Scan resolved, opaque content instead of an entrance-animation frame.
    await expect(page.locator('.page-head')).toHaveCSS('opacity', '1')
    if (path === '/dashboard')
      await expect(page.locator('.latest-result .data-content')).toHaveCSS('opacity', '1')
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
