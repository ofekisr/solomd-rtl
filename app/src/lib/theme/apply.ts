import type { ResolvedVariant } from './resolve.ts';
import { themeCss } from './css.ts';

const STYLE_ID = 'solomd-theme';

function styleElement(): HTMLStyleElement {
  const existing = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (existing) return existing;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  document.head.appendChild(el);
  return el;
}

export function applyTheme(r: ResolvedVariant): void {
  styleElement().textContent = themeCss(r);
  const root = document.documentElement;
  root.setAttribute('data-mode', r.mode);
  root.setAttribute('data-theme', r.mode);
}
