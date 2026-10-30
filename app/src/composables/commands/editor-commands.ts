import { capturePort, clipboardPort, dialogPort } from '../../platform/index.ts';
import { FORMAT_KINDS } from '../../lib/md-format';
import { cleanAIArtifacts, stripMarkdownToPlain } from '../../lib/clean-ai';
import { formatMarkdown } from '../../lib/markdown/format';
import type { Command, CommandCtx } from './command-types.ts';

// opencc-js + pinyin-pro are dictionaries, not code; loading them at startup
// cost every launch for a command most users never run.
const loadChineseConvert = () => import('../../lib/chinese-convert');

export function editorCommands(ctx: CommandCtx): Command[] {
  const { files, kb, tabs, tiles, toasts } = ctx;

  /** Heading folding runs inside the editor component; the focused pane picks
   *  the event up (same routing as find). */
  function dispatchFold(action: 'toggle' | 'all' | 'none' | 'level', level?: number) {
    window.dispatchEvent(
      new CustomEvent('solomd:fold', {
        detail: { action, level, paneId: tiles.focusedPaneId },
      }),
    );
  }

  /** Replace the active editor's content (used for the Chinese conversion commands). */
  function transformActive(fn: (s: string) => string, successMsg: string) {
    const t = tabs.activeTab;
    if (!t) {
      toasts.warning('No active document');
      return;
    }
    const next = fn(t.content);
    tabs.setContent(t.id, next);
    toasts.success(successMsg);
  }

  /** Same, for the transforms whose dictionaries are loaded on demand. */
  async function transformActiveLazy(
    pick: (m: typeof import('../../lib/chinese-convert')) => (s: string) => string,
    successMsg: string,
  ) {
    transformActive(pick(await loadChineseConvert()), successMsg);
  }

  return [
    {
      id: 'search.global',
      title: 'Search in Folder…',
      shortcut: kb('search.global'),
      hint: 'Search across all .md / .txt files in the open folder',
      run: () => window.dispatchEvent(new CustomEvent('solomd:open-global-search')),
    },

    {
      id: 'cn.s2t',
      title: 'Chinese: Simplified → Traditional',
      hint: 'Convert document content',
      run: () => transformActiveLazy((m) => m.simplifiedToTraditional, 'Converted to Traditional'),
    },
    {
      id: 'cn.t2s',
      title: 'Chinese: Traditional → Simplified',
      run: () => transformActiveLazy((m) => m.traditionalToSimplified, 'Converted to Simplified'),
    },
    {
      id: 'cn.copyPinyin',
      title: 'Chinese: Copy Active Document as Pinyin',
      run: async () => {
        const t = tabs.activeTab;
        if (!t) {
          toasts.warning('No active document');
          return;
        }
        await clipboardPort.writeText((await loadChineseConvert()).pinyin(t.content));
        toasts.success('Pinyin copied to clipboard');
      },
    },

    // v2.5 F6: CJK proofread — flag common Chinese typos in the
    // active doc. The actual panel is owned by App.vue; we dispatch
    // a custom event because useCommands has no DOM/component
    // handles (same pattern as `help.markdown` and `search.global`).
    {
      id: 'proofread.cjk',
      title: 'CJK Proofread — flag Chinese typos',
      shortcut: kb('proofread.cjk'),
      hint: 'Half-/full-width punctuation, de-particle misuse, repeats, spacing',
      run: () => window.dispatchEvent(new CustomEvent('solomd:open-cjk-proofread')),
    },

    {
      id: 'editor.find',
      title: 'Find / Replace in note…',
      shortcut: kb('editor.find'),
      hint: 'Open the find & replace bar in the current editor',
      run: () =>
        window.dispatchEvent(
          new CustomEvent('solomd:editor-find', { detail: { paneId: tiles.focusedPaneId } }),
        ),
    },

    {
      id: 'file.import',
      title: 'Import Documents…',
      shortcut: kb('file.import'),
      hint: 'Convert Word / PDF / HTML / spreadsheets / slides / EPUB into Markdown notes in this workspace',
      run: () => void files.importDocuments(),
    },

    {
      id: 'capture.quick',
      title: 'Quick Capture…',
      hint: 'Open the small capture box and file a note straight into the Inbox',
      run: async () => {
        try {
          await capturePort.quickCaptureOpen();
        } catch (e) {
          toasts.error(`Quick capture failed: ${e}`);
        }
      },
    },

    {
      id: 'editor.formulaEditor',
      title: 'Edit Formula…',
      shortcut: kb('editor.formulaEditor'),
      hint: 'Edit the LaTeX under the cursor with a live preview and a symbol palette, or insert a new formula',
      run: () =>
        window.dispatchEvent(
          new CustomEvent('solomd:edit-formula', { detail: { paneId: tiles.focusedPaneId } }),
        ),
    },

    {
      id: 'editor.tableEditor',
      title: 'Edit Table…',
      shortcut: kb('editor.tableEditor'),
      hint: 'Edit the table under the cursor as a grid — add / move / delete rows and columns, set alignment',
      run: () =>
        window.dispatchEvent(
          new CustomEvent('solomd:edit-table', { detail: { paneId: tiles.focusedPaneId } }),
        ),
    },

    {
      id: 'fold.toggle',
      title: 'Fold: Toggle Section at Cursor',
      shortcut: kb('fold.toggle'),
      hint: 'Collapse (or expand) the heading section the cursor is in',
      run: () => dispatchFold('toggle'),
    },
    {
      id: 'fold.all',
      title: 'Fold: Collapse All Sections',
      shortcut: kb('fold.all'),
      hint: 'Collapse every heading section in this note',
      run: () => dispatchFold('all'),
    },
    {
      id: 'fold.none',
      title: 'Fold: Expand All',
      shortcut: kb('fold.none'),
      hint: 'Expand everything that is folded, including code blocks and tables',
      run: () => dispatchFold('none'),
    },
    ...[1, 2, 3, 4, 5, 6].map((level) => ({
      id: `fold.level${level}`,
      title: `Fold: Show Down to Level ${level}`,
      hint:
        level === 1
          ? 'Collapse the whole outline — only H1 headings stay visible'
          : `Keep headings H1–H${level} visible and fold everything under them`,
      run: () => dispatchFold('level', level),
    })),

    {
      id: 'editor.insertImage',
      title: 'Insert image…',
      hint: 'Pick an image — it is copied into the note’s attachments folder and a Markdown image link is inserted',
      run: async () => {
        if (!tabs.activeTab) {
          toasts.warning('No active document');
          return;
        }
        const sel = await dialogPort.open({
          multiple: false,
          defaultPath: await files.filePickerStartDir(),
          filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'tiff'] }],
        });
        if (typeof sel !== 'string') return;
        window.dispatchEvent(
          new CustomEvent('solomd:insert-image-path', {
            detail: { path: sel, paneId: tiles.focusedPaneId },
          }),
        );
      },
    },

    // #296 / #274 — every formatting command, so they are discoverable from
    // the palette and not only by knowing the chord. Titles come from
    // `cmd.fmt.<kind>` in the locale files.
    ...FORMAT_KINDS.map((kind) => ({
      id: `fmt.${kind}`,
      title: `Format: ${kind}`,
      hint: 'Selection, or the word under the cursor. Run again to remove.',
      shortcut: kb(`fmt.${kind}`),
      run: () => window.dispatchEvent(new CustomEvent('solomd:format-markdown', { detail: { kind } })),
    })),

    // Gitee IK8QG3. Acts on the selection, or the word under the caret when
    // there is nothing selected. Shift+F3 cycles lower → UPPER → Title, which
    // is the Word convention most writers already have in their fingers.
    {
      id: 'editor.caseCycle',
      title: 'Cycle Case (lower / UPPER / Title)',
      hint: 'Selection, or the word under the cursor',
      shortcut: kb('editor.caseCycle'),
      run: () => window.dispatchEvent(new CustomEvent('solomd:transform-case', { detail: { mode: 'cycle' } })),
    },
    {
      id: 'editor.caseUpper',
      title: 'UPPERCASE',
      hint: 'Selection, or the word under the cursor',
      run: () => window.dispatchEvent(new CustomEvent('solomd:transform-case', { detail: { mode: 'upper' } })),
    },
    {
      id: 'editor.caseLower',
      title: 'lowercase',
      hint: 'Selection, or the word under the cursor',
      run: () => window.dispatchEvent(new CustomEvent('solomd:transform-case', { detail: { mode: 'lower' } })),
    },
    {
      id: 'editor.caseTitle',
      title: 'Title Case',
      hint: 'Selection, or the word under the cursor',
      run: () => window.dispatchEvent(new CustomEvent('solomd:transform-case', { detail: { mode: 'title' } })),
    },

    {
      id: 'editor.insertImageUrl',
      title: 'Image from URL…',
      hint: 'Insert a Markdown image link for an external image URL (image host)',
      run: () => window.dispatchEvent(new CustomEvent('solomd:open-image-url-dialog')),
    },

    {
      id: 'image.uploadLocalImages',
      title: 'Upload local images to image host…',
      hint: 'Upload every local image in this note to the configured image host and rewrite the links',
      run: () => {
        if (!tabs.activeTab) {
          toasts.warning('No active document');
          return;
        }
        window.dispatchEvent(
          new CustomEvent('solomd:upload-local-images', {
            detail: { paneId: tiles.focusedPaneId },
          }),
        );
      },
    },

    {
      id: 'format.markdown',
      title: 'Format Markdown (Prettier)',
      shortcut: kb('format.markdown'),
      hint: 'Reformat the active document — normalize lists, tables, spacing',
      run: async () => {
        const t = tabs.activeTab;
        if (!t) {
          toasts.warning('No active document');
          return;
        }
        if (t.language !== 'markdown') {
          toasts.warning('Format works on Markdown files only');
          return;
        }
        try {
          const next = await formatMarkdown(t.content);
          if (next === t.content) {
            toasts.info('Already formatted');
            return;
          }
          tabs.setContent(t.id, next);
          toasts.success('Formatted');
        } catch (e) {
          console.error('format failed', e);
          toasts.warning('Format failed — check syntax');
        }
      },
    },

    // ---- AI text cleanup ----
    {
      id: 'clean.aiArtifacts',
      title: 'Clean AI Artifacts (smart quotes, em-dashes, invisible chars)',
      hint: 'Strip junk Unicode that LLM chat interfaces leak into copied text',
      run: () => transformActive(cleanAIArtifacts, 'AI artifacts cleaned'),
    },
    {
      id: 'clean.stripMarkdown',
      title: 'Strip All Markdown to Plain Text',
      hint: 'Remove headings, bold, lists, code fences — leave only prose',
      run: () => transformActive(stripMarkdownToPlain, 'Stripped to plain text'),
    },
  ];
}
