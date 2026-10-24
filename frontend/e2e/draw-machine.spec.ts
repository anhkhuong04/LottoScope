import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

for (const [game, max] of [
  ['mega_645', 45],
  ['power_655', 55],
] as const) {
  test(`${game}: real physical draw ends at six and hands off to checker`, async ({
    page,
    context,
  }) => {
    test.setTimeout(150_000)
    const errors: string[] = []
    const generated: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('request', (request) => {
      if (request.url().includes('/combinations/generate')) generated.push(request.url())
    })
    await page.goto(`/generator?game=${game}`)
    await expect(page.getByRole('button', { name: 'Bắt đầu quay' })).toBeEnabled({
      timeout: 30_000,
    })
    await expect(page.locator('.draw-slot.filled')).toHaveCount(0)
    await page.getByRole('button', { name: 'Bắt đầu quay' }).click()
    await expect(page.locator('.draw-status')).toHaveText('Hoàn tất · 6 số chính', {
      timeout: 110_000,
    })
    const drawn = (await page.locator('.draw-slot.filled').allTextContents()).map(Number)
    expect(drawn).toHaveLength(6)
    expect(new Set(drawn).size).toBe(6)
    expect(drawn.every((n) => n >= 1 && n <= max)).toBe(true)
    expect(generated).toEqual([])
    await expect(page.locator('.draw-finished .ball.special')).toHaveCount(0)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
    const report = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(report.violations).toEqual([])
    await page.screenshot({
      path: `test-results/draw-${game}-${test.info().project.name}.png`,
      fullPage: true,
    })
    if (test.info().project.name === 'desktop') {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      await page.getByRole('button', { name: 'Sao chép', exact: true }).click()
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        [...drawn]
          .sort((a, b) => a - b)
          .map((n) => String(n).padStart(2, '0'))
          .join(' '),
      )
    }
    await page.getByRole('link', { name: 'Kiểm tra lịch sử' }).click()
    await expect(page.getByText('6/6 số đã chọn')).toBeVisible()
    await page.getByRole('button', { name: 'Kiểm tra lịch sử' }).click()
    await expect(page.getByRole('heading', { name: /Trùng chính xác/ })).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('pause, reset and game change discard the old physical session', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('/generator?game=power_655')
  await expect(page.getByRole('button', { name: 'Bắt đầu quay' })).toBeEnabled({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Bắt đầu quay' }).click()
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
  await expect(page.locator('.draw-status')).toHaveText('Đã tạm dừng')
  const values = await page.locator('.draw-slot').allTextContents()
  await expect(page.getByRole('button', { name: 'Tiếp tục' })).toBeVisible()
  expect(await page.locator('.draw-slot').allTextContents()).toEqual(values)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.locator('.draw-status')).toHaveText('Đã tạm dừng')
  await page.getByRole('button', { name: 'Phiên mới' }).click()
  await expect(page.locator('.draw-slot.filled')).toHaveCount(0)
  await page.getByLabel('Chọn game').selectOption('mega_645')
  await expect(page.locator('.draw-stage-badge')).toHaveText('45 BÓNG')
  await expect(page.locator('.draw-slot.filled')).toHaveCount(0)
  await page.getByLabel('Chọn game').selectOption('lotto_535')
  await expect(page.getByRole('button', { name: 'Tạo bộ số', exact: true })).toBeVisible()
  await expect(page.locator('.draw-canvas')).toHaveCount(0)
})

test('WebGL failure is explicit; reduced motion hides the scene without auto-running', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/generator?game=mega_645')
  await expect(page.getByLabel('Ẩn hình ảnh chuyển động')).toBeChecked()
  await expect(page.locator('.draw-slot.filled')).toHaveCount(0)
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof getContext>) {
      if (args[0] === 'webgl2') return null
      return getContext.apply(this, args)
    }
  })
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('WebGL 2')
  await expect(page.getByRole('button', { name: 'Bắt đầu quay' })).toBeDisabled()
  await expect(page.locator('.draw-slot.filled')).toHaveCount(0)
})

test('reset alone reinitializes the scene and an actual context loss can recover', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.goto('/generator?game=mega_645')
  const start = page.getByRole('button', { name: 'Bắt đầu quay' })
  await expect(start).toBeEnabled({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Phiên mới' }).click()
  await expect(start).toBeEnabled({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Bắt đầu quay' }).click()
  await expect(page.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible()
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.draw-canvas canvas')!
    canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext()
  })
  await expect(page.getByRole('alert')).toContainText('Không tải được cảnh 3D')
  await page.getByRole('button', { name: 'Thử lại cảnh 3D' }).click()
  await expect(start).toBeEnabled({ timeout: 20_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.locator('.draw-slot.filled')).toHaveCount(0)
})
