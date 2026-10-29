// app/scripts/theme/build-catalog.ts
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { cmToTheme, type ExtractedCmTheme } from '../../src/lib/theme/from-cm.ts';
import { parseTheme } from '../../src/lib/theme/schema.ts';

const ENTRY = new URL('./catalog-page.ts', import.meta.url).pathname;
const OUT_DIR = new URL('../../src/lib/theme/catalog/', import.meta.url);
const TITLE_GAP_RE = /([a-z])([A-Z])/g;

async function bundle(): Promise<string> {
  const r = await build({ entryPoints: [ENTRY], bundle: true, write: false, format: 'iife', platform: 'browser' });
  return r.outputFiles[0].text;
}

async function extractAll(js: string): Promise<ExtractedCmTheme[]> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent('<!doctype html><body></body>');
  await page.addScriptTag({ content: js });
  const out = await page.evaluate(() => (window as unknown as { extractAll: () => ExtractedCmTheme[] }).extractAll());
  await browser.close();
  return out;
}

function prettyName(name: string): string {
  const spaced = name.replace(TITLE_GAP_RE, '$1 $2');
  return spaced[0].toUpperCase() + spaced.slice(1);
}

async function main(): Promise<void> {
  const extracted = await extractAll(await bundle());
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  for (const x of extracted) {
    const parsed = parseTheme(cmToTheme({ ...x, name: prettyName(x.name) }));
    if (!parsed.ok) { console.warn(`skip ${x.name}: ${parsed.error}`); continue; }
    writeFileSync(new URL(`${parsed.theme.id}.json`, OUT_DIR), `${JSON.stringify(parsed.theme, null, 2)}\n`);
    written += 1;
  }
  console.log(`wrote ${written} of ${extracted.length} catalog themes`);
}

await main();
