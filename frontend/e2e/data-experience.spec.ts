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
  await page.getByLabel('Number kind').selectOption('special')
  await expect(page.locator('.frequency-tile')).toHaveCount(12)
  await expect(page.locator('.frequency-tile .ball.special')).toHaveCount(12)
  await expect(page.locator('.scope-summary')).toContainText('Last 20 draws')
  await expect(page.locator('.scope-summary')).toContainText('Actual: 20 draws')
  await expect(page).toHaveURL(/number_kind=special/)
  await page.locator('.frequency-tile[href^="/numbers/1?"]').click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Special Number 01')
  await expect(page.getByRole('heading', { name: 'Co-occurring Pairs' })).toHaveCount(0)
  await expect(page.locator('.draw-row .ball.special').first()).toHaveText('01')
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.getByRole('link', { name: 'Back to numbers' }).click()
  await expect(page.getByLabel('Number kind')).toHaveValue('special')
  await page.getByLabel('Select game').selectOption('mega_645')
  await expect(page.locator('.frequency-tile')).toHaveCount(45)
  await expect(page.getByLabel('Number kind')).toHaveCount(0)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
})

test('filter bars and scopes are visible across data screens', async ({ page }) => {
  for (const route of ['/dashboard', '/history', '/numbers', '/pairs']) {
    await page.goto(route + '?game=lotto_535&window=last_draws&count=10')
    await expect(page.getByRole('region', { name: 'Filters', exact: true })).toHaveCount(1)
    await expect(page.locator('.scope-summary').first()).toBeVisible()
    expect(
      await page.locator('h1').evaluate((node) => node.getBoundingClientRect().top),
    ).toBeLessThan(
      await page
        .getByRole('region', { name: 'Filters', exact: true })
        .evaluate((node) => node.getBoundingClientRect().top),
    )
  }
  await expect(page.getByRole('columnheader', { name: 'Rank' })).toHaveCount(0)
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
  await page.getByLabel('Number kind').selectOption('special')
  await expect(page.locator('.frequency-tile .ball.special')).toHaveCount(12)
  release()
  await expect(page.getByLabel('Number kind')).toHaveValue('special')
  await expect(page.locator('.frequency-tile')).toHaveCount(12)
  await expect(page.locator('.scope-summary')).toContainText('Special numbers')
})

test('Dashboard retains special scope on refresh failure and limits the pair preview', async ({
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
    .filter({ has: page.getByRole('heading', { name: 'Lotto 5/35 Special Numbers (01–12)' }) })
  await expect(special.locator('.frequency-tile')).toHaveCount(12)
  await page.getByRole('button', { name: 'Sync', exact: true }).click()
  await expect(special.getByRole('alert')).toContainText('Stale data in same window')
  await expect(special.locator('.scope-summary')).toContainText('Actual: 7 draws')
  await expect(special.locator('.scope-summary')).toContainText('Through draw 00123')
  await expect(special.locator('.frequency-tile .ball.special')).toHaveCount(12)
  await expect(page.locator('.pairs-summary .pair-link')).toHaveCount(5)
})
