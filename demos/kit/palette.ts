import type { Page } from '@playwright/test';
import type { DemoCursor } from './cursor';
import { MOD } from './fixtures';
import { PACE } from './pace';

/** Opens the command palette, types the query on camera and runs the top match. */
export async function runCommand(page: Page, c: DemoCursor, query: string): Promise<void> {
  await c.press(`${MOD}+Shift+K`);
  await page.locator('input.palette__input').waitFor();
  await c.type(query);
  await page.waitForTimeout(PACE.settle);
  await c.press('Enter');
}
