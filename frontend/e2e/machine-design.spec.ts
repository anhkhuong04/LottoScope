import { expect, test } from '@playwright/test'

test('approved machine keeps one perspective without the prototype editor', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/generator/preview?game=lotto_535')
  await expect(page).toHaveURL(/\/generator\?game=lotto_535/)
  await expect(page.getByRole('button', { name: 'Bắt đầu quay' })).toBeEnabled({ timeout: 30_000 })
  await expect(page.locator('.draw-canvas canvas')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Góc nhìn' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mặt trước', exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Mở cửa thoát')).toHaveCount(0)
  await expect(page.getByLabel('Kích thước mô hình')).toHaveCount(0)
  await expect(page.locator('.draw-slot.filled')).toHaveCount(0)
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true)
  await page.screenshot({ path: test.info().outputPath('approved-machine.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('unsupported graphics keeps an illustration and never fabricates a result', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      if (args[0] === 'webgl2') return null
      return original.apply(this, args)
    }
  })
  await page.goto('/generator?game=power_655')
  await expect(page.getByRole('alert')).toContainText('WebGL 2')
  await expect(page.getByRole('img', { name: 'Minh họa lồng cầu tĩnh' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Bắt đầu quay' })).toBeDisabled()
  await expect(page.locator('.draw-slot.filled')).toHaveCount(0)
})

test('the perspective stops rendering while idle and paused', async ({ page }) => {
  await page.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.drawElementsInstanced
    const samples: number[] = []
    Object.assign(window, { machineRenderSamples: samples })
    WebGL2RenderingContext.prototype.drawElementsInstanced = function (...args) {
      samples.push(performance.now())
      return original.apply(this, args)
    }
  })
  const sample = () =>
    page.evaluate(async () => {
      const samples = (window as unknown as { machineRenderSamples: number[] }).machineRenderSamples
      samples.length = 0
      const started = performance.now()
      await new Promise((resolve) => setTimeout(resolve, 1000))
      return { times: samples.slice(), durationMs: performance.now() - started }
    })
  await page.goto('/generator?game=power_655')
  await expect(page.getByRole('button', { name: 'Bắt đầu quay' })).toBeEnabled({ timeout: 30_000 })
  // Allow the local environment texture's one-time render to finish.
  await expect.poll(async () => (await sample()).times.length).toBe(0)
  const renderer = await page.locator('.draw-canvas canvas').evaluate((canvas) => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2')!
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    return String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
  })
  await page.getByRole('button', { name: 'Bắt đầu quay' }).click()
  await sample() // Warm up before measuring the running frame intervals.
  const running = await sample()
  expect(running.times.length).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Tạm dừng', exact: true }).click()
  await expect.poll(async () => (await sample()).times.length).toBe(0)
  const intervals = running.times.slice(1).map((time, index) => time - running.times[index])
  intervals.sort((a, b) => a - b)
  const metrics = {
    renderer,
    durationMs: running.durationMs,
    framesPerSecond: (1000 * running.times.length) / running.durationMs,
    medianFrameMs: intervals[Math.floor(intervals.length / 2)] ?? null,
    p95FrameMs: intervals[Math.floor(intervals.length * 0.95)] ?? null,
    idleFrames: 0,
    pausedFrames: 0,
    environment: 'Short Chromium device-emulation sample; not a phone or hardware-GPU benchmark',
  }
  console.info('Machine render probe', test.info().project.name, metrics)
  await test.info().attach('render-samples.json', {
    body: JSON.stringify(metrics),
    contentType: 'application/json',
  })
})
