import type { Locator, Page } from '@playwright/test';
import { PACE } from './pace';

export interface ClickOptions {
  button?: 'left' | 'right';
  double?: boolean;
  modifiers?: Array<'Meta' | 'Shift' | 'Alt' | 'Control'>;
}

export interface Point {
  x: number;
  y: number;
}

/** Real mouse + the drawn cursor move together, so hovers fire and the viewer sees the pointer. */
export class DemoCursor {
  constructor(private readonly page: Page) {}

  async glideTo(target: Locator | Point): Promise<Point> {
    const point = 'x' in target ? target : await this.centerOf(target);
    await this.page.evaluate(
      ({ x, y, d }) => window.__demo?.moveCursor(x, y, d),
      { x: point.x, y: point.y, d: PACE.cursorGlide },
    );
    await this.page.mouse.move(point.x, point.y, { steps: PACE.cursorSteps });
    await this.page.waitForTimeout(PACE.cursorGlide);
    return point;
  }

  async hover(target: Locator): Promise<void> {
    await this.glideTo(target);
  }

  async click(target: Locator | Point, options: ClickOptions = {}): Promise<void> {
    const point = await this.glideTo(target);
    await this.page.waitForTimeout(PACE.beforeClick);
    await this.page.evaluate(() => window.__demo?.ripple());
    for (const key of options.modifiers ?? []) await this.page.keyboard.down(key);
    await this.page.mouse.click(point.x, point.y, {
      button: options.button ?? 'left',
      clickCount: options.double ? 2 : 1,
    });
    for (const key of options.modifiers ?? []) await this.page.keyboard.up(key);
    await this.page.waitForTimeout(PACE.afterClick);
  }

  async type(text: string): Promise<void> {
    await this.page.keyboard.type(text, { delay: PACE.typeDelay });
  }

  /** Headless Chromium ignores the OS paste shortcut, so the paste event the shortcut would raise is dispatched directly. */
  async paste(text: string, targetSelector?: string): Promise<void> {
    await this.page.evaluate(({ payload, selector }) => {
      const data = new DataTransfer();
      data.setData('text/plain', payload);
      const target = (selector && document.querySelector(selector)) || document.activeElement || document.body;
      target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, { payload: text, selector: targetSelector });
    await this.page.waitForTimeout(PACE.keyHold);
  }

  async press(key: string): Promise<void> {
    await this.page.keyboard.press(key);
    await this.page.waitForTimeout(PACE.keyHold);
  }

  private async centerOf(target: Locator): Promise<Point> {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error(`demo cursor: target has no box — ${target.toString()}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
}
