import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const e2ePort = '3100';

export default defineConfig({
  testDir: './e2e',
  timeout: 35_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: externalBaseUrl || `http://127.0.0.1:${e2ePort}`,
    extraHTTPHeaders: process.env.VERCEL_BYPASS_TOKEN
      ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS_TOKEN }
      : undefined,
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: 'npx tsx server.ts',
          env: {
            ...process.env,
            PORT: e2ePort,
          },
          url: `http://127.0.0.1:${e2ePort}/api/health`,
          reuseExistingServer: false,
          timeout: 60_000,
        },
      }),
});
