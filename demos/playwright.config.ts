import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const DEMOS_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_PORT = Number(process.env.DEMO_PORT ?? '1440');
const VIDEO_SIZE = { width: 1280, height: 720 };
const STORY_TIMEOUT_MS = 5 * 60_000;

export default defineConfig({
  testDir: './stories',
  testMatch: '**/*.story.ts',
  outputDir: path.join(DEMOS_DIR, 'out', 'raw'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: STORY_TIMEOUT_MS,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${APP_PORT}`,
    viewport: VIDEO_SIZE,
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'Asia/Jerusalem',
    colorScheme: 'light',
    video: { mode: 'on', size: VIDEO_SIZE },
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  webServer: {
    command: `pnpm --dir ../app exec vite --port ${APP_PORT} --strictPort`,
    url: `http://localhost:${APP_PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
