import { test as base, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { Director } from './director';
import { installOverlay } from './overlay';
import { seed, type SeedDoc, type SettingsPatch } from './seed';

export const APP_READY_SELECTOR = '#app > *';
export const MOD = 'ControlOrMeta';

const TIMING_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'out', 'timing');

export function storyNameOf(file: string): string {
  return path.basename(file).replace(/\.story\.ts$/, '');
}

export interface Demo {
  page: Page;
  director: Director;
  open(docs: SeedDoc[], settings?: SettingsPatch): Promise<void>;
}

/** record.mjs trims the app boot off the video using the gap between page creation and the title card. */
function writeTiming(storyName: string, pageCreatedAt: number, titleShownAt: number | null): void {
  if (titleShownAt === null) return;
  mkdirSync(TIMING_DIR, { recursive: true });
  const timing = { trimStartMs: Math.max(0, titleShownAt - pageCreatedAt) };
  writeFileSync(path.join(TIMING_DIR, `${storyName}.json`), JSON.stringify(timing));
}

export const test = base.extend<{ demo: Demo }>({
  demo: async ({ page }, use, testInfo) => {
    const pageCreatedAt = Date.now();
    await page.addInitScript(installOverlay);
    const director = new Director(page);
    director.storyName = storyNameOf(testInfo.file);
    const demo: Demo = {
      page,
      director,
      async open(docs, settings) {
        await seed(page, docs, settings);
        await page.goto('/');
        await page.locator(APP_READY_SELECTOR).first().waitFor();
        await page.waitForLoadState('networkidle');
      },
    };
    await use(demo);
    writeTiming(director.storyName, pageCreatedAt, director.titleShownAt);
  },
});

export { expect };
