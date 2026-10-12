// Testy v prohlížeči (Playwright): skutečná aplikace v mobilním Chromiu proti PHP API nad SQLite.
// Spuštění: npm run e2e (sestaví balík a spustí testy), npm run e2e:ui (okno s průběhem testů).
// Testy jsou v e2e/*.e2e.ts – přípona .e2e.ts, aby je nespouštěl Vitest (npm test).
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT || 8190);

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  // jedna databáze pro všechny testy → běží postupně
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: process.env.CI ? 'never' : 'on-failure' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    locale: 'cs-CZ',
    timezoneId: 'Europe/Prague',
    // service worker by v testech podstrkoval starou verzi z mezipaměti
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // aplikace je hlavně pro telefony – testujeme na velikosti mobilu
    { name: 'mobil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: `http://127.0.0.1:${port}/`,
    reuseExistingServer: false, // vždy čerstvá databáze
    timeout: 30_000,
  },
});
