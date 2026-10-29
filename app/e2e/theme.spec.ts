import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const LS_KEY = 'solomd.settings.v1';
const SAMPLE = readFileSync(new URL('./fixtures/sample.md', import.meta.url), 'utf8');
const CATALOG_DRACULA = JSON.parse(
  readFileSync(new URL('../src/lib/theme/catalog/cm-dracula.json', import.meta.url), 'utf8'),
);
const CATALOG_COLORS = CATALOG_DRACULA.variants.dark;
const SOLOMD_LIGHT = { themeId: 'solomd', variant: 'light' };

async function boot(page: Page, settings: Record<string, unknown> | null): Promise<void> {
  await page.addInitScript(([key, s]) => {
    if (s) localStorage.setItem(key as string, JSON.stringify(s));
  }, [LS_KEY, settings] as const);
  await page.goto('/');
  await page.waitForSelector('style#solomd-theme', { state: 'attached' });
}

const cssVar = (page: Page, name: string): Promise<string> =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

const resolvedColor = (page: Page, value: string): Promise<string> =>
  page.evaluate((v) => {
    const probe = document.createElement('span');
    probe.style.color = v;
    document.body.appendChild(probe);
    const out = getComputedStyle(probe).color;
    probe.remove();
    return out;
  }, value);

async function expectVar(page: Page, name: string, expected: string): Promise<void> {
  const want = await resolvedColor(page, expected);
  await expect.poll(async () => resolvedColor(page, await cssVar(page, name))).toBe(want);
}

async function fillSampleInSplit(page: Page): Promise<void> {
  await page.locator('.cm-content').first().click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.insertText(SAMPLE);
}

const mermaidNodeColors = (page: Page): Promise<{ fill: string; stroke: string }> =>
  page.evaluate(() => {
    const shape = document.querySelector('.mermaid-block svg .node rect, .mermaid-block svg .node polygon');
    if (!shape) return { fill: '', stroke: '' };
    const cs = getComputedStyle(shape);
    return { fill: cs.fill, stroke: cs.stroke };
  });

test('dark slot paints shell and editor variables', async ({ page }) => {
  await boot(page, { themeLayerVersion: 1, appearance: 'dark', darkSlot: { themeId: 'nord', variant: 'dark' }, lightSlot: SOLOMD_LIGHT });
  await expectVar(page, '--bg', '#2e3440');
  await expectVar(page, '--cm-bg', '#2e3440');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('follow system flips with the OS scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await boot(page, { themeLayerVersion: 1, appearance: 'system', darkSlot: { themeId: 'dracula', variant: 'dark' }, lightSlot: { themeId: 'github', variant: 'light' } });
  await expectVar(page, '--bg', '#ffffff');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expectVar(page, '--bg', '#282a36');
});

test('legacy settings migrate once', async ({ page }) => {
  await boot(page, { theme: 'monokai' });
  await expectVar(page, '--bg', '#272822');
  const read = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), LS_KEY);
  await expect.poll(async () => (await read()).themeLayerVersion).toBe(1);
  expect((await read()).darkSlot).toEqual({ themeId: 'monokai', variant: 'dark' });
});

test('a catalog theme fills the editor chrome', async ({ page }) => {
  await boot(page, { themeLayerVersion: 1, appearance: 'dark', darkSlot: { themeId: 'cm-dracula', variant: 'dark' }, lightSlot: SOLOMD_LIGHT });
  const expected = [
    ['--cm-bg', CATALOG_COLORS.editor?.colors?.background],
    ['--syn-keyword', CATALOG_COLORS.code?.colors?.keyword],
  ] as const;
  const unset = await resolvedColor(page, '');
  for (const [name, value] of expected) {
    expect(typeof value === 'string' && value.length > 0, `${name} expected value in catalog JSON`).toBe(true);
    expect(await resolvedColor(page, value as string)).not.toBe(unset);
    await expectVar(page, name, value as string);
  }
});

const NORD_PANEL = '#3b4252';
const NORD_ACCENT = '#88c0d0';

async function renderedMermaidColors(page: Page, themeId: string): Promise<{ fill: string; stroke: string }> {
  await boot(page, { themeLayerVersion: 1, appearance: 'dark', viewMode: 'split', agentWizardSeen: true, darkSlot: { themeId, variant: 'dark' }, lightSlot: SOLOMD_LIGHT });
  await fillSampleInSplit(page);
  await expect.poll(() => mermaidNodeColors(page).then((c) => c.fill)).not.toBe('');
  return mermaidNodeColors(page);
}

test('mermaid diagram follows the active slot theme', async ({ browser }) => {
  const nordPage = await browser.newPage();
  const draculaPage = await browser.newPage();
  try {
    const nord = await renderedMermaidColors(nordPage, 'nord');
    const dracula = await renderedMermaidColors(draculaPage, 'dracula');
    expect(nord.fill).toBe(await resolvedColor(nordPage, NORD_PANEL));
    expect(nord.stroke).toBe(await resolvedColor(nordPage, NORD_ACCENT));
    expect(dracula.fill).not.toBe(nord.fill);
    expect(dracula.stroke).not.toBe(nord.stroke);
  } finally {
    await nordPage.close();
    await draculaPage.close();
  }
});

test('fresh install follows a light system and stamps the layer version', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await boot(page, null);
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');
  const read = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), LS_KEY);
  await expect.poll(async () => (await read()).themeLayerVersion).toBe(1);
  expect((await read()).appearance).toBe('system');
});
