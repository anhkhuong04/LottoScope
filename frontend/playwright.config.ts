import { defineConfig, devices } from '@playwright/test'

const deployedBaseURL = process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: deployedBaseURL ?? 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
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
        command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
        timeout: 30_000,
      },
})
