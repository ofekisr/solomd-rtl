import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const LEGACY_THEMES = ['light', 'dark', 'nord', 'solarized-light', 'solarized-dark', 'monokai', 'github-light', 'dracula'];
const SAMPLE = readFileSync(new URL('./fixtures/sample.md', import.meta.url), 'utf8');
const SETTLE_MS = 800;

async function openWithTheme(page: Page, theme: string): Promise<void> {
  await page.addInitScript(([t]) => {
    const raw = localStorage.getItem('solomd.settings.v1');
    const s = raw ? JSON.parse(raw) : {};
    localStorage.setItem('solomd.settings.v1', JSON.stringify({ ...s, theme: t, viewMode: 'split', agentWizardSeen: true }));
  }, [theme]);
  await page.goto('/');
  await page.locator('.cm-content').first().click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(SAMPLE);
  await page.waitForTimeout(SETTLE_MS);
}

for (const theme of LEGACY_THEMES) {
  test(`theme ${theme} looks the same`, async ({ page }) => {
    await openWithTheme(page, theme);
    await expect(page).toHaveScreenshot(`${theme}.png`, { fullPage: true });
  });
}
