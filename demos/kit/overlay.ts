export interface DemoOverlayApi {
  caption(text: string): void;
  hideCaption(): void;
  card(title: string, subtitle: string): void;
  hideCard(): void;
  moveCursor(x: number, y: number, durationMs: number): void;
  ripple(): void;
  action(label: string, holdMs: number): void;
}

declare global {
  interface Window {
    __demo?: DemoOverlayApi;
  }
}

/** Runs inside the page via addInitScript — must stay self-contained (no closures over module scope). */
export function installOverlay(): void {
  const CURSOR_KEY = 'demo.cursor';
  const STYLE = `
    #demo-overlay { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;
      font-family: -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; direction: ltr; }
    #demo-caption { position: absolute; left: 50%; bottom: 36px; transform: translate(-50%, 12px);
      max-width: 80%; padding: 12px 22px; border-radius: 12px; background: rgba(17, 24, 39, 0.88);
      color: #fff; font-size: 22px; font-weight: 600; letter-spacing: 0.2px; text-align: center;
      box-shadow: 0 8px 28px rgba(0,0,0,0.28); opacity: 0; transition: opacity 260ms ease, transform 260ms ease; }
    #demo-caption.on { opacity: 1; transform: translate(-50%, 0); }
    #demo-card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 14px; background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
      color: #fff; opacity: 0; transition: opacity 360ms ease; }
    #demo-card.on { opacity: 1; }
    #demo-card h1 { margin: 0; font-size: 52px; font-weight: 800; letter-spacing: -0.5px; }
    #demo-card p { margin: 0; font-size: 24px; opacity: 0.82; }
    #demo-cursor { position: absolute; left: 0; top: 0; width: 26px; height: 26px; margin: -3px 0 0 -4px;
      transition-property: transform; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
      filter: drop-shadow(0 2px 3px rgba(0,0,0,0.35)); }
    #demo-action { position: absolute; right: 28px; top: 84px; display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; border-radius: 12px; background: rgba(255,255,255,0.97); color: #111827;
      font-size: 20px; font-weight: 600; box-shadow: 0 8px 26px rgba(0,0,0,0.22); border: 1px solid #e5e7eb;
      opacity: 0; transform: translateY(-8px); transition: opacity 180ms ease, transform 180ms ease; }
    #demo-action.on { opacity: 1; transform: translateY(0); }
    #demo-action kbd { font: inherit; font-family: ui-monospace, 'SF Mono', Menlo, monospace; padding: 3px 10px;
      border-radius: 7px; background: #f3f4f6; border: 1px solid #d1d5db; border-bottom-width: 3px; }
    .demo-ripple { position: absolute; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%;
      border: 3px solid rgba(37, 99, 235, 0.9); animation: demo-ripple 520ms ease-out forwards; }
    @keyframes demo-ripple { to { transform: scale(3.4); opacity: 0; } }
  `;
  const CURSOR_SVG = `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2 L4 20 L9 15.5 L12.5 22 L15.5 20.6 L12 14 L19 14 Z"
    fill="#111827" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

  let cursorX = 640;
  let cursorY = 360;
  try {
    const saved = JSON.parse(sessionStorage.getItem(CURSOR_KEY) ?? 'null');
    if (saved) ({ x: cursorX, y: cursorY } = saved);
  } catch {}

  const build = (): Record<string, HTMLElement> => {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);
    const root = document.createElement('div');
    root.id = 'demo-overlay';
    root.innerHTML = `<div id="demo-card"><h1></h1><p></p></div><div id="demo-caption"></div><div id="demo-action"></div><div id="demo-cursor">${CURSOR_SVG}</div>`;
    document.body.appendChild(root);
    const cursor = root.querySelector<HTMLElement>('#demo-cursor')!;
    cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
    return {
      root,
      card: root.querySelector<HTMLElement>('#demo-card')!,
      caption: root.querySelector<HTMLElement>('#demo-caption')!,
      action: root.querySelector<HTMLElement>('#demo-action')!,
      cursor,
    };
  };

  let els: Record<string, HTMLElement> | null = null;
  let actionTimer: ReturnType<typeof setTimeout> | undefined;
  const ui = (): Record<string, HTMLElement> => (els ??= build());

  window.__demo = {
    caption(text) {
      const el = ui().caption;
      el.textContent = text;
      el.classList.add('on');
    },
    hideCaption() {
      ui().caption.classList.remove('on');
    },
    card(title, subtitle) {
      const el = ui().card;
      el.querySelector('h1')!.textContent = title;
      el.querySelector('p')!.textContent = subtitle;
      el.classList.add('on');
    },
    hideCard() {
      ui().card.classList.remove('on');
    },
    moveCursor(x, y, durationMs) {
      const el = ui().cursor;
      el.style.transitionDuration = `${durationMs}ms`;
      el.style.transform = `translate(${x}px, ${y}px)`;
      cursorX = x;
      cursorY = y;
      sessionStorage.setItem(CURSOR_KEY, JSON.stringify({ x, y }));
    },
    action(label, holdMs) {
      const el = ui().action;
      el.replaceChildren();
      for (const part of label.split('|')) {
        const isKey = part.startsWith('[') && part.endsWith(']');
        const node = document.createElement(isKey ? 'kbd' : 'span');
        node.textContent = isKey ? part.slice(1, -1) : part;
        el.appendChild(node);
      }
      el.classList.add('on');
      clearTimeout(actionTimer);
      actionTimer = setTimeout(() => el.classList.remove('on'), holdMs);
    },
    ripple() {
      const dot = document.createElement('div');
      dot.className = 'demo-ripple';
      dot.style.left = `${cursorX}px`;
      dot.style.top = `${cursorY}px`;
      ui().root.appendChild(dot);
      setTimeout(() => dot.remove(), 600);
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => ui());
  else ui();
}
