import { Vim } from '@replit/codemirror-vim';

export interface VimExHost {
  defineEx(name: string, prefix: string, fn: () => void): void;
  target: Pick<Window, 'dispatchEvent' | 'addEventListener' | 'removeEventListener' | 'setTimeout'>;
  clearTimeout(id: number): void;
  flags: { __solomdVimEx?: boolean };
}

export const VIM_SAVE_TIMEOUT_MS = 10000;

// #222 — Vim's `:w` / `:wq` / `:q` were dead: @replit/codemirror-vim ships no
// Ex-command handlers (there is no file system in the browser), so typing `:w`
// just cleared the command line without saving. Route them through the same
// `solomd:menu-action` bus the menu bar and Ctrl+S use, so save / save-and-close
// / close honour the app's real save + unsaved-tab flow. Registered once on the
// global Vim singleton (idempotent guard — defineEx would otherwise stack).
export function registerVimEx(host: VimExHost): void {
  if (host.flags.__solomdVimEx) return;
  host.flags.__solomdVimEx = true;
  const menu = (id: string) =>
    host.target.dispatchEvent(new CustomEvent('solomd:menu-action', { detail: id }));
  // `:w` / `:write` — save the active tab.
  host.defineEx('write', 'w', () => menu('file.save'));
  // `:wq` / `:x` / `:xit` — save, then close only once the save actually lands.
  // saveActive() is async, so closing synchronously would hit a still-dirty tab
  // and pop the unsaved-changes dialog; wait for the one-shot `solomd:saved`.
  const saveThenClose = () => {
    let timer = 0;
    const onSaved = () => {
      host.clearTimeout(timer);
      host.target.removeEventListener('solomd:saved', onSaved);
      menu('file.closeTab');
    };
    host.target.addEventListener('solomd:saved', onSaved);
    // If the save is cancelled (e.g. the Save-As dialog on an untitled buffer)
    // the `solomd:saved` never fires; drop the listener so it can't later close
    // an unrelated tab on the next save. 10s comfortably covers a real write.
    timer = host.target.setTimeout(() => host.target.removeEventListener('solomd:saved', onSaved), VIM_SAVE_TIMEOUT_MS);
    menu('file.save');
  };
  host.defineEx('wq', 'wq', saveThenClose);
  host.defineEx('xit', 'x', saveThenClose);
  // `:q` / `:quit` — close the tab (unsaved changes trigger the confirm dialog).
  host.defineEx('quit', 'q', () => menu('file.closeTab'));
}

export function registerVimExOnce(): void {
  registerVimEx({
    defineEx: Vim.defineEx.bind(Vim),
    target: window,
    clearTimeout: (id) => clearTimeout(id),
    flags: globalThis as { __solomdVimEx?: boolean },
  });
}
