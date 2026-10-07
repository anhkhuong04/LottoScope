import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const lottoPrizes = {
  draw_id: '00922',
  currency: 'VND',
  source_url: 'https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/535?id=00922&nocatche=1',
  source_retrieved_at: '2026-10-07T00:00:00Z',
  items: [
    {
      name: 'Giải Độc Đắc',
      matches: [{ main_count: 5, special: true }],
      winner_count: 0,
      amount_vnd: '7749247500',
    },
    {
      name: 'Giải Nhất',
      matches: [{ main_count: 5, special: false }],
      winner_count: 0,
      amount_vnd: '10000000',
    },
    {
      name: 'Giải Khuyến Khích',
      matches: [
        { main_count: 2, special: true },
        { main_count: 1, special: true },
        { main_count: 0, special: true },
      ],
      winner_count: 12312,
      amount_vnd: '10000',
    },
  ],
}

test('draw prizes show zero, match conditions and exact VND without overflow', async ({ page }) => {
  await page.route('**/api/v1/games/lotto_535/draws/00922/prizes', (route) =>
    route.fulfill({ json: lottoPrizes }),
  )
  await page.goto('/history/00922?game=lotto_535')
  await expect(page.getByRole('heading', { name: 'Giải thưởng kỳ quay' })).toBeVisible()
  const table = page.getByRole('table', { name: 'Bảng giải thưởng' })
  await expect(table).toBeVisible()
  await expect(table.getByRole('row', { name: /Giải Độc Đắc/ })).toContainText('0')
  await expect(table.getByText('7.749.247.500', { exact: true })).toBeVisible()
  await expect(table.getByText('12.312', { exact: true })).toBeVisible()
  await expect(table.getByRole('img', { name: 'Trùng số đặc biệt', exact: true })).toBeVisible()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  const accessibility = await new AxeBuilder({ page }).include('.prize-card').analyze()
  expect(accessibility.violations).toEqual([])
})

test('prize source error keeps draw visible, retry works, missing data stays empty', async ({
  page,
}) => {
  let failed = true
  await page.route('**/api/v1/games/lotto_535/draws/00922/prizes', (route) =>
    failed
      ? route.fulfill({
          status: 503,
          json: {
            error: {
              code: 'prize_source_unavailable',
              message: 'Prize data source is temporarily unavailable',
              details: {},
            },
          },
        })
      : route.fulfill({ json: { ...lottoPrizes, items: [], source_retrieved_at: null } }),
  )
  await page.goto('/history/00922?game=lotto_535')
  await expect(page.getByRole('heading', { name: 'Kỳ 00922' })).toBeVisible()
  await expect(page.getByText('Ngày quay:')).toBeVisible()
  await expect(page.locator('.prize-card').getByRole('alert')).toBeVisible()
  failed = false
  await page.locator('.prize-card').getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.getByText('Chưa có dữ liệu giải thưởng cho kỳ này.')).toBeVisible()
  await expect(page.getByRole('table', { name: 'Bảng giải thưởng' })).toHaveCount(0)
})

test('Mega prize snapshot has no special matches and big money stays exact', async ({ page }) => {
  await page.route('**/api/v1/games/mega_645/draws/01570/prizes', (route) =>
    route.fulfill({
      json: {
        ...lottoPrizes,
        draw_id: '01570',
        items: [
          {
            name: 'Jackpot',
            matches: [{ main_count: 6, special: false }],
            winner_count: 0,
            amount_vnd: '9007199254740993',
          },
        ],
      },
    }),
  )
  await page.goto('/history/01570?game=mega_645')
  const table = page.getByRole('table', { name: 'Bảng giải thưởng' })
  await expect(table.getByText('9.007.199.254.740.993', { exact: true })).toBeVisible()
  await expect(table.getByRole('img', { name: 'Trùng 6 số chính', exact: true })).toBeVisible()
  await expect(table.locator('.prize-symbol.special')).toHaveCount(0)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
})

test('late Lotto prizes cannot replace the current Mega detail', async ({ page }) => {
  let release!: () => void
  let started!: () => void
  let finish!: () => void
  const finished = new Promise<void>((resolve) => {
    finish = resolve
  })
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const requested = new Promise<void>((resolve) => {
    started = resolve
  })
  await page.route('**/api/v1/games/lotto_535/draws/00922/prizes', async (route) => {
    started()
    await pending
    await route.fulfill({ json: lottoPrizes })
    finish()
  })
  await page.route('**/api/v1/games/mega_645/draws/*/prizes', (route) =>
    route.fulfill({
      json: {
        ...lottoPrizes,
        draw_id: route.request().url().split('/').at(-2),
        items: [
          {
            name: 'Jackpot',
            matches: [{ main_count: 6, special: false }],
            winner_count: 0,
            amount_vnd: '178900548500',
          },
        ],
      },
    }),
  )
  await page.goto('/history/00922?game=lotto_535')
  await requested
  await page.getByLabel('Chọn game').selectOption('mega_645')
  await expect(page).toHaveURL(/\/history\?game=mega_645/)
  await page.locator('a[href^="/history/"]:visible').first().click()
  const table = page.getByRole('table', { name: 'Bảng giải thưởng' })
  await expect(table.getByRole('row', { name: /Jackpot/ })).toBeVisible()
  release()
  await finished
  await expect(table.getByText('178.900.548.500', { exact: true })).toBeVisible()
  await expect(table.getByText('Giải Độc Đắc', { exact: true })).toHaveCount(0)
  await expect(table.locator('.prize-symbol.special')).toHaveCount(0)
})
