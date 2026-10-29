import { defineConfig } from '@playwright/test';

const PORT = 1440;

export default defineConfig({
  testDir: '.',
  use: { baseURL: `http://localhost:${PORT}`, viewport: { width: 1280, height: 800 } },
  webServer: { command: 'pnpm dev --port 1440 --strictPort', cwd: '..', port: PORT, reuseExistingServer: false },
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01 } },
});
