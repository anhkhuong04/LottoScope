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
  await page.goto('/numbers?game=power_655&window=last_draws&count=20&sort=number')
  await expect(page.getByLabel('Select game')).toHaveValue('power_655')
  await expect(page.locator('.number-tile')).toHaveCount(55)
  await page.locator('.number-tile').last().click()
  await expect(page).toHaveURL(/\/numbers\/55\?/)
  await expect(page.getByRole('heading', { name: 'Number 55', exact: true })).toBeVisible()
  await page.getByLabel('Select game').selectOption('mega_645')
  await expect(page.locator('.number-tile')).toHaveCount(45)
  await page.getByLabel('Select game').selectOption('power_655')
  await expect(page.locator('.number-tile')).toHaveCount(55)
  await expect(page.getByLabel('Analysis window')).toHaveValue('20')
})

test('Power checker accepts exactly six main numbers and resets on game change', async ({
  page,
}) => {
  await page.goto('/checker?game=power_655')
  await expect(page.locator('.picker button')).toHaveCount(55)
  await expect(page.getByText('0/6', { exact: true })).toBeVisible()
  for (const number of ['05', '10', '14', '23', '24', '38']) {
    await page.getByRole('button', { name: `Number ${number}`, exact: true }).click()
  }
  await expect(page.getByText('6/6', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Number 55', exact: true })).toBeDisabled()
  await expect(page.getByText(/Exact match: [1-9]/)).toBeVisible()
  await expect(page.getByLabel('Match Distribution')).toBeVisible()
  await page.getByLabel('Select game').selectOption('mega_645')
  await expect(page.getByText('0/6', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Match Distribution')).toHaveCount(0)
  await page.getByLabel('Select game').selectOption('power_655')
  await expect(page.locator('.picker button')).toHaveCount(55)
  await expect(page.getByRole('button', { name: 'Number 56', exact: true })).toHaveCount(0)
})

test('Power detail separates special and shows both Jackpots and five prize tiers', async ({
  page,
}) => {
  await page.goto('/history/00001?game=power_655')
  await expect(page.locator('.content .draw-special').first()).toContainText('35')
  await expect(page.locator('.prize-jackpot')).toHaveCount(2)
  await expect(page.locator('.prize-jackpot').first()).toContainText('30,528,493,950')
  await expect(page.locator('.prize-jackpot').last()).toContainText('3,058,721,550')
  const table = page.getByRole('table', { name: 'Prize table' })
  await expect(table.locator('tbody tr')).toHaveCount(5)
  const jackpot2 = table.getByRole('row', { name: /Jackpot 2/ })
  await expect(
    jackpot2.getByRole('img', { name: 'Match 5 main number(s) and special number' }),
  ).toBeVisible()
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

test('Power draw machine replaces rule generator and pair detail works', async ({ page }) => {
  await page.goto('/generator?game=power_655')
  await expect(page.getByRole('heading', { name: 'Draw Simulator' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Maximum previous overlap' })).toHaveCount(0)
  await expect(page.locator('.draw-result-slots li')).toHaveCount(6)
  await page.goto('/pairs/24-38?game=power_655&window=all_time')
  await expect(page.getByRole('heading', { name: 'Pair 24-38' })).toBeVisible()
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
  await page.getByLabel('Select game').selectOption('power_655')
  await expect(page.locator('.number-tile')).toHaveCount(55)
  release()
  await done
  await expect(page.locator('.number-tile')).toHaveCount(55)
  let failed = true
  await page.route('**/api/v1/games/power_655/analytics/numbers?*', async (route) =>
    failed ? route.abort() : route.fallback(),
  )
  await page.route('**/api/v1/games/power_655/sync', (route) =>
    route.fulfill({
      json: { created: 0, enriched: 0, remaining_unresolved: 0 },
    }),
  )
  await page.getByRole('button', { name: 'Sync', exact: true }).click()
  await expect(page.getByText(/Stale data in same window/)).toBeVisible()
  failed = false
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.number-tile')).toHaveCount(55)
})
