let styleInjected = false;

const CSS = `
.io-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(4px);
  cursor: grab;
  user-select: none;
}
.io-header {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.6), transparent);
  z-index: 1;
  pointer-events: auto;
}
.io-header-title {
  font-family: var(--font-ui, sans-serif);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: calc(100% - 60px);
}
.io-close {
  font-size: 22px;
  line-height: 1;
  color: rgba(255, 255, 255, 0.7);
  background: transparent;
  border: none;
  cursor: pointer;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.io-close:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}
.io-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  /* Disable native pan/zoom so our pointer handlers can do pinch + pan. */
  touch-action: none;
  -webkit-touch-callout: none;
}
.io-viewport {
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  transform-origin: center center;
}
.io-viewport img,
.io-viewport svg {
  display: block;
  user-select: none;
  -webkit-user-select: none;
  -webkit-user-drag: none;
}
.io-viewport--svg svg {
  background: #fff;
  border-radius: 6px;
  padding: 16px;
  box-sizing: content-box;
}
.io-viewport--svg-dark svg {
  background: #1e1e2e;
  border-radius: 6px;
  padding: 16px;
  box-sizing: content-box;
}
.io-footer {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  z-index: 1;
  pointer-events: auto;
}
.io-footer button {
  font-family: var(--font-ui, sans-serif);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  padding: 2px 10px;
  cursor: pointer;
}
.io-footer button:hover {
  background: rgba(255, 255, 255, 0.15);
}
.io-zoom-pct {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  min-width: 48px;
  text-align: center;
}
`;

export function injectStyles(): void {
  if (styleInjected) return;
  const el = document.createElement('style');
  el.textContent = CSS;
  document.head.appendChild(el);
  styleInjected = true;
}
