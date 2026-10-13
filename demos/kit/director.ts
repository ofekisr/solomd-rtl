import type { Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import { DemoCursor } from './cursor';
import { PACE } from './pace';

const SHOTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'out', 'shots');

export type StepAction = (cursor: DemoCursor) => Promise<unknown>;

/** Sequences title cards and captioned steps; the page under it is the real app. */
export class Director {
  readonly cursor: DemoCursor;

  constructor(private readonly page: Page) {
    this.cursor = new DemoCursor(page);
  }

  async title(title: string, subtitle: string): Promise<void> {
    this.titleShownAt ??= Date.now();
    await this.page.evaluate(([t, s]) => window.__demo?.card(t, s), [title, subtitle]);
    await this.page.waitForTimeout(PACE.cardHold);
    await this.page.evaluate(() => window.__demo?.hideCard());
    await this.page.waitForTimeout(PACE.cardFade);
  }

  async end(title: string, subtitle: string): Promise<void> {
    await this.page.evaluate(([t, s]) => window.__demo?.card(t, s), [title, subtitle]);
    await this.page.waitForTimeout(PACE.cardHold);
  }

  async step(caption: string, action: StepAction): Promise<void> {
    await this.page.evaluate((c) => window.__demo?.caption(c), caption);
    await this.page.waitForTimeout(PACE.captionLead);
    await action(this.cursor);
    await this.page.waitForTimeout(PACE.stepHold);
    await this.snapshot();
    await this.page.evaluate(() => window.__demo?.hideCaption());
    await this.page.waitForTimeout(PACE.captionFade);
  }

  async pause(ms: number = PACE.settle): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  /** DEMO_SHOTS=1 saves one frame per step to out/shots/<story>/ for quick review without watching the video. */
  async snapshot(): Promise<void> {
    if (!process.env.DEMO_SHOTS) return;
    this.shotIndex += 1;
    const name = String(this.shotIndex).padStart(2, '0');
    await this.page.screenshot({ path: path.join(SHOTS_DIR, this.storyName, `${name}.png`) });
  }

  private shotIndex = 0;
  storyName = 'story';
  titleShownAt: number | null = null;
}
