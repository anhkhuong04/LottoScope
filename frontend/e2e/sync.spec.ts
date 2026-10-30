import { expect, test } from '@playwright/test'

test('manual sync posts once and reloads stored dashboard data after completion', async ({
  page,
}) => {
  let requests = 0
  let completed = false
  let release!: () => void
  const wait = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/api/v1/games/lotto_535/draws/latest', async (route) => {
    const response = await route.fetch()
    const data = await response.json()
    await route.fulfill({
      json: completed
        ? {
            ...data,
            draw_id: '99999',
            source_url:
              'https://raw.githubusercontent.com/vietvudanh/vietlott-data/main/data/power535.jsonl#draw=99999',
          }
        : data,
    })
  })
  await page.route('**/api/v1/games/lotto_535/sync', async (route) => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().postDataJSON()).toEqual({})
    requests++
    await wait
    completed = true
    await route.fulfill({
      json: {
        game: 'lotto_535',
        created: 2,
        enriched: 0,
        remaining_unresolved: 0,
        source: 'community',
      },
    })
  })
  await page.goto('/dashboard?game=lotto_535')
  await expect(page.locator('.number-tile')).toHaveCount(6)
  expect(requests).toBe(0)
  await page.getByRole('button', { name: 'Tải dữ liệu', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Đang đồng bộ…' })).toBeDisabled()
  expect(requests).toBe(1)
  release()
  await expect(
    page.getByRole('status').filter({ hasText: 'Lotto 5/35: đã thêm 2 kỳ mới' }),
  ).toBeVisible()
  await expect(page.locator('.metric-value').first()).toHaveText('99999')
  await expect(
    page.getByRole('status').filter({ hasText: 'Nguồn dự phòng cộng đồng' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Cộng đồng · vietvudanh/vietlott-data' }),
  ).toBeVisible()
  expect(requests).toBe(1)
})

test('a late sync keeps the selected game and reports source errors without losing saved data', async ({
  page,
}) => {
  let release!: () => void
  const wait = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/api/v1/games/lotto_535/sync', async (route) => {
    await wait
    await route.fulfill({
      json: { game: 'lotto_535', created: 0, enriched: 0, remaining_unresolved: 1 },
    })
  })
  await page.route('**/api/v1/games/mega_645/sync', (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: 'sync_source_unavailable', message: 'source unavailable' } },
    }),
  )
  await page.goto('/dashboard?game=lotto_535')
  await page.getByRole('button', { name: 'Tải dữ liệu', exact: true }).click()
  await page.getByLabel('Chọn game').selectOption('mega_645')
  await expect(page.locator('.number-tile')).toHaveCount(6)
  release()
  await expect(
    page.getByRole('status').filter({ hasText: 'Lotto 5/35: đã kiểm tra nguồn' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tổng quan Mega 6/45')
  await expect(page.locator('.metric-value').first()).toHaveText(/^\d{5}$/)
  const saved = await page.locator('.metric-value').first().textContent()
  await page.getByRole('button', { name: 'Tải dữ liệu', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Mega 6/45: Chưa thể hoàn tất')
  await expect(page.getByRole('alert')).toContainText('Dữ liệu đã lưu vẫn được giữ')
  await expect(page.locator('.metric-value').first()).toHaveText(saved!)
})
