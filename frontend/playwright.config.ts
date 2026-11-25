import { defineConfig, devices } from '@playwright/test'

const deployedBaseURL = process.env.PLAYWRIGHT_BASE_URL
const localBaseURL = 'http://127.0.0.1:5197'
const testBuild = '.vite/e2e'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 2,
  use: { baseURL: deployedBaseURL ?? localBaseURL, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1365, height: 900 } },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1000 } },
    },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: deployedBaseURL
    ? undefined
    : {
        command:
          `npm run build -- --outDir ${testBuild} && ` +
          `npm run preview -- --host 127.0.0.1 --port 5197 --strictPort --outDir ${testBuild}`,
        env: { LOTTO_DEV_API_ORIGIN: process.env.LOTTO_DEV_API_ORIGIN ?? 'http://127.0.0.1:5198' },
        url: localBaseURL,
        reuseExistingServer: false,
        timeout: 90_000,
      },
})
