import type { EditorFeature, EditorFeatureContext } from '../../editor/contracts/index.ts';
import { cmDocAccess, formatMarkdownInView, FORMAT_KINDS, transformCaseInView } from '../internal/cm-format.ts';
import type { CaseMode, FormatKind } from '../internal/cm-format.ts';
import { openFormulaWith, openTableWith } from '../internal/doc-commands.ts';
import { insertMarkdownInView } from '../internal/insert-markdown.ts';

const TRANSFORM_CASE_EVENT = 'solomd:transform-case';
const FORMAT_MARKDOWN_EVENT = 'solomd:format-markdown';

function isActiveTab(ctx: EditorFeatureContext): boolean {
  return ctx.tab().id === ctx.activeTabId();
}

function onTransformCase(ctx: EditorFeatureContext, e: Event): void {
  const detail = ((e as CustomEvent).detail || {}) as { mode?: CaseMode | 'cycle' };
  const mode: CaseMode | 'cycle' = detail.mode || 'cycle';
  if (!isActiveTab(ctx)) return;
  const view = ctx.view();
  if (!view) return;
  transformCaseInView(view, mode);
}

function onFormatMarkdown(ctx: EditorFeatureContext, e: Event): void {
  const kind = (((e as CustomEvent).detail || {}) as { kind?: FormatKind }).kind as FormatKind;
  if (!FORMAT_KINDS.includes(kind)) return;
  if (!isActiveTab(ctx)) return;
  if (ctx.tab().language !== 'markdown') return;
  const view = ctx.view();
  if (!view) return;
  formatMarkdownInView(view, kind);
}

export function createFormatFeature(): EditorFeature {
  return {
    id: 'format',
    settingsKeys: [],
    i18nKeys: ['tableEditor.notInTable'],
    setup: (ctx) => {
      const caseListener = (e: Event): void => onTransformCase(ctx, e);
      const formatListener = (e: Event): void => onFormatMarkdown(ctx, e);
      window.addEventListener(TRANSFORM_CASE_EVENT, caseListener);
      window.addEventListener(FORMAT_MARKDOWN_EVENT, formatListener);
      return () => {
        window.removeEventListener(TRANSFORM_CASE_EVENT, caseListener);
        window.removeEventListener(FORMAT_MARKDOWN_EVENT, formatListener);
      };
    },
    commands: {
      openTableAtCursor: (ctx) => {
        openTableWith(cmDocAccess(() => ctx.view()), ctx.toast, (k) => ctx.t(k));
      },
      openFormulaAtCursor: (ctx) => {
        openFormulaWith(cmDocAccess(() => ctx.view()));
      },
      insertMarkdown: (ctx, snippet) => {
        const view = ctx.view();
        if (!view) return;
        insertMarkdownInView(view, String(snippet));
      },
    },
  };
}
