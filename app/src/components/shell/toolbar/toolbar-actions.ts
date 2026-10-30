import { EditorView } from '@codemirror/view';
import { cleanAIArtifacts } from '../../../lib/clean-ai.ts';
import { getPlainSelection } from '../../../lib/plain-selection.ts';
import { shortcutLabel } from '../../../lib/keybindings.ts';
import { isIOS, isMacOS } from '../../../lib/platform.ts';
import type { DialogPort } from '../../../platform/dialog/dialog.port.ts';
import type { OpenerPort } from '../../../platform/opener/opener.port.ts';

export interface ToastsLike {
  warning(message: string): unknown;
  info(message: string): unknown;
  success(message: string): unknown;
}

export interface ActiveTabLike {
  id: string;
  content: string;
  filePath?: string | null;
}

export interface TabsLike {
  activeTab: ActiveTabLike | null | undefined;
  setContent(id: string, content: string): void;
}

export interface SelectionPick {
  selection: string;
  from: number;
  to: number;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'tiff'];
const SELECT_FIRST_CHORD_FALLBACK = '—';

export function shortPath(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

export function openCjkProofread(): void {
  window.dispatchEvent(new CustomEvent('solomd:open-cjk-proofread'));
}

export function cleanAI(tabs: TabsLike, toasts: ToastsLike): void {
  const active = tabs.activeTab;
  if (!active) {
    toasts.warning('No active document');
    return;
  }
  const cleaned = cleanAIArtifacts(active.content);
  if (cleaned === active.content) {
    toasts.info('No AI artifacts found');
    return;
  }
  tabs.setContent(active.id, cleaned);
  toasts.success('AI artifacts cleaned');
}

function readCodeMirrorSelection(): SelectionPick | null {
  const editors = [
    document.querySelector<HTMLElement>('.cm-editor.cm-focused'),
    ...Array.from(document.querySelectorAll<HTMLElement>('.cm-editor')),
  ].filter((e): e is HTMLElement => e != null);
  for (const el of editors) {
    const view = EditorView.findFromDOM(el);
    if (!view) continue;
    const main = view.state.selection.main;
    if (main.empty) continue;
    const text = view.state.sliceDoc(main.from, main.to);
    if (text.trim()) return { selection: text, from: main.from, to: main.to };
  }
  return null;
}

export interface AiRewriteDeps {
  tabs: TabsLike;
  toasts: ToastsLike;
  isAiEnabled: boolean;
  keybindings: Parameters<typeof shortcutLabel>[1];
}

/**
 * Mirrors the Cmd+J binding: builds the `solomd:ai-rewrite-open` event from the
 * editor selection. Never falls back to the whole document. The selection is
 * read from CodeMirror state (the DOM Selection is empty on Windows WebView2),
 * without requiring `.cm-focused` (#95), then from the plain editor (#126).
 */
export function aiRewrite(deps: AiRewriteDeps): void {
  if (!deps.tabs.activeTab) {
    deps.toasts.warning('No active document');
    return;
  }
  if (!deps.isAiEnabled) {
    deps.toasts.info('Enable AI rewrite in Settings first (⌘,)');
    window.dispatchEvent(
      new CustomEvent('solomd:open-settings', { detail: { section: 'integrations' } }),
    );
    return;
  }
  const picked = readCodeMirrorSelection() ?? getPlainSelection();
  if (!picked) {
    const jChord =
      shortcutLabel('editor.aiRewrite', deps.keybindings, isMacOS()) || SELECT_FIRST_CHORD_FALLBACK;
    deps.toasts.info(`Select some text first, then click AI rewrite (or press ${jChord}).`);
    return;
  }
  window.dispatchEvent(new CustomEvent('solomd:ai-rewrite-open', { detail: picked }));
}

type ShareNavigator = Navigator & { canShare?: (d: ShareData) => boolean };

function shareMimeFor(fileName: string): string {
  return fileName.endsWith('.md') || fileName.endsWith('.markdown') ? 'text/markdown' : 'text/plain';
}

async function shareFileOrText(fileName: string, content: string): Promise<boolean> {
  if (navigator.share && typeof File === 'function') {
    const file = new File([content], fileName, { type: shareMimeFor(fileName) });
    const data: ShareData = { title: fileName, files: [file] };
    const nav = navigator as ShareNavigator;
    if (!nav.canShare || nav.canShare(data)) {
      await navigator.share(data);
      return true;
    }
  }
  if (navigator.share) {
    await navigator.share({ title: fileName, text: content });
    return true;
  }
  return false;
}

async function shareOnIOS(path: string, content: string, toasts: ToastsLike): Promise<void> {
  const fileName = path.split(/[\\/]/).pop() ?? 'note.md';
  try {
    if (await shareFileOrText(fileName, content)) return;
  } catch (e) {
    if ((e as { name?: string }).name === 'AbortError') return;
    toasts.warning(`Share failed: ${e}`);
    return;
  }
  toasts.info('Sharing not supported on this iOS version');
}

export interface OpenExternalDeps {
  tabs: TabsLike;
  toasts: ToastsLike;
  opener: OpenerPort;
  noFileMessage: string;
}

/** iOS cannot open `file://` through the opener plugin; it goes through the share sheet instead. */
export async function openExternal(deps: OpenExternalDeps): Promise<void> {
  const active = deps.tabs.activeTab;
  const path = active?.filePath;
  if (!path) {
    deps.toasts.warning(deps.noFileMessage);
    return;
  }
  if (isIOS()) {
    await shareOnIOS(path, active?.content ?? '', deps.toasts);
    return;
  }
  try {
    await deps.opener.openPath(path);
  } catch (e) {
    deps.toasts.warning(`Failed: ${e}`);
  }
}

/** #296 — runs the same toggle the shortcut does, so it wraps the selection. */
export function dispatchFormat(kind: string): void {
  window.dispatchEvent(new CustomEvent('solomd:format-markdown', { detail: { kind } }));
}

export function dispatchInsert(snippet: string, paneId: string | null | undefined): void {
  window.dispatchEvent(
    new CustomEvent('solomd:insert-markdown', { detail: { snippet, paneId } }),
  );
}

export interface PickImageDeps {
  dialog: DialogPort;
  startDir: () => Promise<string | undefined>;
  paneId: string | null | undefined;
}

export async function pickAndInsertImage(deps: PickImageDeps): Promise<void> {
  const sel = await deps.dialog.open({
    multiple: false,
    defaultPath: await deps.startDir(),
    filters: [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
  });
  if (typeof sel !== 'string') return;
  window.dispatchEvent(
    new CustomEvent('solomd:insert-image-path', { detail: { path: sel, paneId: deps.paneId } }),
  );
}

export function openImageUrlDialog(): void {
  window.dispatchEvent(new CustomEvent('solomd:open-image-url-dialog'));
}
