import { Decoration, EditorView, WidgetType } from '@codemirror/view';
import { copyPlainText, dedentFenced, dedentIndented } from '../code-copy.ts';
import { fenceModeToolbar, type FenceViewMode } from './fence-modes.ts';
import { isTerminalLang, terminalCommands } from '../terminal-block.ts';

// Minimal structural view of a lezer `SyntaxNode`. `@lezer/common` is only a
// transitive dependency (not in our package.json), so we describe just the
// tree-walk fields we touch rather than importing the real type.
export interface MdSyntaxNode {
  name: string;
  parent: MdSyntaxNode | null;
  firstChild: MdSyntaxNode | null;
  nextSibling: MdSyntaxNode | null;
}

// ---------------------------------------------------------------------------
// List + horizontal-rule rendering (v4.7.1). Off the caret line we render
// the markdown the way a preview would; on the caret line the raw source is
// revealed so it stays editable — same model as the inline marks above.
//   - `- item` / `* item` / `+ item` → the marker becomes a • bullet glyph.
//   - `1. item`                       → number kept (it IS the visual), just
//                                       styled; not replaced.
//   - `- [ ] item`                    → the dash is hidden so the checkbox
//                                       (rendered by cm-task-list.ts) leads.
//   - `---` / `***` / `___`           → a real <hr> rule.
// ---------------------------------------------------------------------------
// Widgets carry their own inline styling so they render correctly under BOTH
// the liveEdit theme (here) and the edit-mode livePreview extension
// (cm-live-preview.ts), which reuses these via the exports below.
export class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-md-bullet';
    span.textContent = '•';
    span.style.color = 'var(--md-list)';
    span.style.fontWeight = '700';
    span.setAttribute('aria-hidden', 'true');
    return span;
  }
  ignoreEvent() {
    return false;
  }
}

export class HrWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const hr = document.createElement('hr');
    hr.className = 'cm-md-hr';
    hr.style.display = 'inline-block';
    hr.style.width = '100%';
    hr.style.height = '0';
    hr.style.margin = '0.2em 0';
    hr.style.border = 'none';
    hr.style.borderTop = '1px solid var(--border)';
    hr.style.verticalAlign = 'middle';
    return hr;
  }
}

export const bulletDeco = Decoration.replace({ widget: new BulletWidget() });
export const hrDeco = Decoration.replace({ widget: new HrWidget() });

// Does the `ListMark`'s ListItem hold a GFM TaskMarker (`[ ]` / `[x]`)?
// Those are already rendered as a checkbox by cm-task-list.ts, so we hide the
// leading dash instead of swapping in a bullet.
export function listItemHasTask(listMark: MdSyntaxNode): boolean {
  const item = listMark.parent; // ListItem
  if (!item) return false;
  for (let child = item.firstChild; child; child = child.nextSibling) {
    if (child.name === 'TaskMarker' || child.name === 'Task') return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Code-block mode toggle (edit / split / preview) per-block widget. Shown on
// a diagram fence while its source is visible; the mode itself lives in
// `fenceModeField` (cm-fence-modes.ts), which cm-live-blocks reads to decide
// what to render.
// ---------------------------------------------------------------------------

export class CodeModeWidget extends WidgetType {
  constructor(readonly linePos: number, readonly active: FenceViewMode) {
    super();
  }

  eq(other: CodeModeWidget) {
    return other.linePos === this.linePos && other.active === this.active;
  }

  toDOM(view: EditorView) {
    return fenceModeToolbar(view, this.linePos, this.active);
  }

  ignoreEvent() {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Code-block copy button (v4.11.18)
//
// Live-edit renders a fenced block like a preview would — the ``` lines are
// hidden — but a drag-select still yields the *source*: the fence lines and,
// for a block nested in a list, the container's leading indentation. Users
// copying a snippet into a terminal had to strip that by hand. So the block
// gets the same one-click copy button the preview pane has had since #195,
// and it copies the code the way a renderer would: fences dropped, the
// block's own indentation removed, code-relative indentation kept.
// ---------------------------------------------------------------------------

/** Label getter, installed by Editor.vue so the button follows the UI
 *  language without this module importing the i18n store. */
let copyLabelGetter: () => string = () => 'Copy';

export function setLiveEditCopyLabel(getter: () => string): void {
  copyLabelGetter = getter;
}

export class CodeCopyWidget extends WidgetType {
  constructor(readonly code: string) {
    super();
  }

  eq(other: CodeCopyWidget) {
    return other.code === this.code;
  }

  toDOM() {
    const label = copyLabelGetter();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cm-md-code-copy';
    btn.textContent = label;
    btn.title = label;
    btn.setAttribute('aria-label', label);
    // Inside `.cm-content` (contenteditable) a plain button still steals the
    // selection on mousedown — cancel that so clicking Copy never moves the
    // caret or scrolls the block.
    btn.contentEditable = 'false';
    btn.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        await copyPlainText(this.code);
        btn.textContent = '✓';
        window.setTimeout(() => {
          if (btn.isConnected) btn.textContent = copyLabelGetter();
        }, 1200);
      } catch {
        /* clipboard denied — leave the label alone rather than toast from
           inside a CM widget. */
      }
    });
    return btn;
  }

  ignoreEvent() {
    return true;
  }
}

/**
 * The text a copy button should put on the clipboard for the code block
 * spanning `startLine`..`endLine` (1-indexed, inclusive).
 *
 * Fenced blocks: drop the opening line and the closing fence (an
 * unterminated block at EOF has none), then strip at most the opening
 * fence's own indentation from each body line — CommonMark's rule, so a
 * fence nested in a list loses the list indent while a Python body keeps
 * its own. Indented (4-space) blocks: strip the whitespace prefix common
 * to every line, which is exactly the indentation that made it a block.
 *
 * Exported for the self-test harness.
 */
export function codeBlockClipboardText(
  doc: { line(n: number): { text: string } },
  isFenced: boolean,
  startLine: number,
  endLine: number,
): string {
  let bodyStart = startLine;
  let bodyEnd = endLine;
  if (isFenced) {
    bodyStart = startLine + 1;
    if (endLine > startLine && /^[ \t]*(`{3,}|~{3,})[ \t]*$/.test(doc.line(endLine).text)) {
      bodyEnd = endLine - 1;
    }
  }
  if (bodyEnd < bodyStart) return '';
  const lines: string[] = [];
  for (let n = bodyStart; n <= bodyEnd; n += 1) lines.push(doc.line(n).text);
  const text = lines.join('\n');
  if (!isFenced) return dedentIndented(text);
  const opening = doc.line(startLine).text;
  const fenceIndent = /^[ \t]*/.exec(opening)?.[0] ?? '';
  const body = dedentFenced(text, fenceIndent);
  const lang = /^[ \t]*(?:`{3,}|~{3,})\s*(\S*)/.exec(opening)?.[1] ?? '';
  return isTerminalLang(lang) ? terminalCommands(body) : body;
}

// Heading nodes 1..6 → level
