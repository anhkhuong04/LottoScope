import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/games', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 'lotto_535',
            label: 'Lotto 5/35',
            main_min: 1,
            main_max: 35,
            main_count: 5,
            special_min: 1,
            special_max: 12,
          },
          {
            id: 'mega_645',
            label: 'Mega 6/45',
            main_min: 1,
            main_max: 45,
            main_count: 6,
            special_min: null,
            special_max: null,
          },
          {
            id: 'power_655',
            label: 'Power 6/55',
            main_min: 1,
            main_max: 55,
            main_count: 6,
            special_min: 1,
            special_max: 55,
          },
        ],
      },
    }),
  )
})

test('static preview has configurable views and never starts a draw', async ({ page }) => {
  const errors: string[] = []
  const forbidden: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (/rapier|\.wasm|combinations\/generate|\/sync/.test(request.url()))
      forbidden.push(request.url())
  })
  await page.goto('/generator/preview?game=lotto_535')
  await expect(page.getByRole('heading', { name: 'Thiết kế lồng cầu' })).toBeVisible()
  await expect(page.getByRole('status', { name: 'Trạng thái mô hình' })).toHaveText(
    '35 bóng tĩnh · Sẵn sàng',
    { timeout: 30_000 },
  )
  await expect(page.getByRole('button', { name: 'Bắt đầu quay' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Mặt trước', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mặt trước', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByLabel('Mở vỏ phía trước').check()
  await page.getByLabel('Mở cửa thoát').check()
  await page.getByLabel('Kích thước mô hình').fill('1.1')
  await page.getByLabel('Chất lượng').selectOption('economy')
  await expect(page.getByRole('status', { name: 'Trạng thái mô hình' })).toContainText('Sẵn sàng')
  await page.getByRole('button', { name: 'Đặt lại thiết kế' }).click()
  await expect(page.getByLabel('Mở cửa thoát')).not.toBeChecked()
  await page.getByLabel('Chọn game').selectOption('power_655')
  await expect(page.getByRole('status', { name: 'Trạng thái mô hình' })).toHaveText(
    '55 bóng tĩnh · Sẵn sàng',
    { timeout: 30_000 },
  )
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  expect(forbidden).toEqual([])
  expect(errors).toEqual([])
  await page.screenshot({ path: test.info().outputPath('machine-preview.png'), fullPage: true })
})

test('no WebGL shows a useful fallback without result controls', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      if (args[0] === 'webgl2') return null
      return original.apply(this, args)
    }
  })
  await page.goto('/generator/preview?game=mega_645')
  await expect(page.getByRole('alert')).toContainText('WebGL 2')
  await expect(page.getByRole('img', { name: 'Minh họa lồng cầu tĩnh' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bắt đầu quay' })).toHaveCount(0)
})

test('context loss can retry the static renderer', async ({ page }) => {
  await page.goto('/generator/preview?game=lotto_535')
  await expect(page.getByRole('status', { name: 'Trạng thái mô hình' })).toContainText('Sẵn sàng', {
    timeout: 30_000,
  })
  await page.evaluate(() => {
    document
      .querySelector<HTMLCanvasElement>('.machine-preview-canvas canvas')!
      .getContext('webgl2')!
      .getExtension('WEBGL_lose_context')!
      .loseContext()
  })
  await expect(page.getByRole('alert')).toContainText('Mất kết nối đồ họa')
  await page.getByRole('button', { name: 'Thử lại 3D' }).click()
  await expect(page.getByRole('status', { name: 'Trạng thái mô hình' })).toContainText('Sẵn sàng', {
    timeout: 30_000,
  })
})
