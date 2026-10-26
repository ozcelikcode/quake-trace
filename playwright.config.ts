import { defineConfig, devices } from '@playwright/test';

const port = 4173;
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Headless browsers render the 3D map with software WebGL; more workers starve the main
  // thread and make page evaluation (axe) time out. CI runners (no GPU, shared vCPUs) render
  // more slowly still, so they run one worker with longer budgets.
  workers: isCi ? 1 : 2,
  timeout: isCi ? 120_000 : 60_000,
  expect: { timeout: isCi ? 15_000 : 5_000 },
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  reporter: isCi
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${String(port)}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } },
    },
    { name: 'phone-android', use: { ...devices['Pixel 7'] } },
    { name: 'phone-ios', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${String(port)} --strictPort`,
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !isCi,
    timeout: 180_000,
  },
});
