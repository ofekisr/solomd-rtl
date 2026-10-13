import type { Locator, Page } from '@playwright/test';
import { PACE } from './pace';

type Modifier = 'Meta' | 'Shift' | 'Alt' | 'Control';

export interface ClickOptions {
  button?: 'left' | 'right';
  double?: boolean;
  modifiers?: Modifier[];
  /** Overrides the badge text; defaults to the target's aria-label, title or text. */
  label?: string;
}

export interface Point {
  x: number;
  y: number;
}

const KEY_GLYPHS: Record<string, string> = {
  ControlOrMeta: '⌘', Meta: '⌘', Control: '⌃', Shift: '⇧', Alt: '⌥',
  Enter: '↵ Enter', Tab: '⇥ Tab', Space: '␣ Space', Escape: 'Esc', End: 'End', Home: 'Home',
  ArrowDown: '↓', ArrowUp: '↑', ArrowLeft: '←', ArrowRight: '→', Backspace: '⌫',
};
const MAX_LABEL = 32;

const keycap = (key: string): string => `[${KEY_GLYPHS[key] ?? key.toUpperCase()}]`;
const chord = (combo: string): string => combo.split('+').map(keycap).join('|');
const clip = (text: string): string => (text.length > MAX_LABEL ? `${text.slice(0, MAX_LABEL - 1)}…` : text);

/**
 * Real mouse + drawn cursor move together so hovers fire and the viewer sees the pointer.
 * Every action also raises a badge (keycap or "Click · label"); the first time an action
 * appears in a story it is held longer so the viewer learns it before it repeats faster.
 */
export class DemoCursor {
  private readonly seen = new Set<string>();

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
    const label = options.label ?? ('x' in target ? '' : await this.labelOf(target));
    const point = await this.glideTo(target);
    await this.page.waitForTimeout(PACE.beforeClick);
    const isFirst = await this.announce(`click:${label}`, this.clickBadge(label, options));
    await this.page.evaluate(() => window.__demo?.ripple());
    for (const key of options.modifiers ?? []) await this.page.keyboard.down(key);
    await this.page.mouse.click(point.x, point.y, {
      button: options.button ?? 'left',
      clickCount: options.double ? 2 : 1,
    });
    for (const key of options.modifiers ?? []) await this.page.keyboard.up(key);
    await this.page.waitForTimeout(PACE.afterClick + (isFirst ? PACE.firstTime : 0));
  }

  async type(text: string): Promise<void> {
    await this.announce('type', `[⌨]|Type “${clip(text)}”`);
    await this.page.keyboard.type(text, { delay: PACE.typeDelay });
  }

  async press(combo: string): Promise<void> {
    const isFirst = await this.announce(`press:${combo}`, chord(combo));
    await this.page.keyboard.press(combo);
    await this.page.waitForTimeout(PACE.keyHold + (isFirst ? PACE.firstTime : 0));
  }

  /** Headless Chromium ignores the OS paste shortcut, so the paste event the shortcut would raise is dispatched directly. */
  async paste(text: string, targetSelector?: string): Promise<void> {
    const isFirst = await this.announce('paste', `${chord('ControlOrMeta+V')}|Paste`);
    await this.page.evaluate(({ payload, selector }) => {
      const data = new DataTransfer();
      data.setData('text/plain', payload);
      const target = (selector && document.querySelector(selector)) || document.activeElement || document.body;
      target.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, { payload: text, selector: targetSelector });
    await this.page.waitForTimeout(PACE.keyHold + (isFirst ? PACE.firstTime : 0));
  }

  private clickBadge(label: string, options: ClickOptions): string {
    const mods = (options.modifiers ?? []).map(keycap);
    const verb = options.button === 'right' ? 'Right-click' : options.double ? 'Double-click' : 'Click';
    return [...mods, label ? `${verb} · ${clip(label)}` : verb].join('|');
  }

  /** Shows the badge; returns true the first time this action appears in the story. */
  private async announce(id: string, badge: string): Promise<boolean> {
    const isFirst = !this.seen.has(id);
    this.seen.add(id);
    const hold = PACE.actionHold + (isFirst ? PACE.firstTime : 0);
    await this.page.evaluate(([b, h]) => window.__demo?.action(b, h), [badge, hold] as const);
    return isFirst;
  }

  private async labelOf(target: Locator): Promise<string> {
    const label = await target.evaluate((el) => {
      const named = el.closest('[aria-label],[title]');
      const raw = el.getAttribute('aria-label') || el.textContent?.trim() || el.getAttribute('title')
        || named?.getAttribute('aria-label') || named?.getAttribute('title') || '';
      return raw.replace(/\s+/g, ' ').trim();
    });
    return label;
  }

  private async centerOf(target: Locator): Promise<Point> {
    await target.scrollIntoViewIfNeeded();
    const box = await target.boundingBox();
    if (!box) throw new Error(`demo cursor: target has no box — ${target.toString()}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }
}
