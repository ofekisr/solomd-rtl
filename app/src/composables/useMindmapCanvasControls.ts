const PACKAGE_ZOOM_BAR = '.mind-elixir-toolbar.rb';
const CONTROL_CLASS = 'mm-canvas-control';
const ACTIVATION_KEYS: readonly string[] = ['Enter', ' '];

export interface CanvasControl {
  readonly glyph: string;
  readonly label: string;
  readonly run: () => void;
}

function controlElement(control: CanvasControl): HTMLElement {
  const el = document.createElement('span');
  el.className = CONTROL_CLASS;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', control.label);
  el.tabIndex = 0;
  el.title = control.label;
  el.textContent = control.glyph;
  el.addEventListener('click', control.run);
  el.addEventListener('keydown', (event) => {
    if (!ACTIVATION_KEYS.includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    control.run();
  });
  return el;
}

export function appendCanvasControls(root: HTMLElement, controls: readonly CanvasControl[]): void {
  const bar = root.querySelector(PACKAGE_ZOOM_BAR);
  if (!bar || bar.querySelector(`.${CONTROL_CLASS}`)) return;
  for (const control of controls) bar.appendChild(controlElement(control));
}
