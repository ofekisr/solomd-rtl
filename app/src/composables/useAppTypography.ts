/**
 * Typography settings → root CSS variables and markdown-it flags (Wave 1b).
 * Each effect re-runs on its setting; called once from `App.vue` setup.
 */
import { watchEffect } from 'vue';
import { useSettingsStore, buildEditorFontStack } from '../stores/settings';
import { setMarkdownHardBreaks, setMarkdownAutoNumberHeadings, setMarkdownSmartQuotes } from '../lib/markdown';

const DEFAULT_PREVIEW_FONT_SIZE = 15;
const MONO_FALLBACK = '"JetBrains Mono", "SF Mono", "Cascadia Code", Menlo, Consolas, monospace';

/** Quote a single multi-word family name; leave stacks and quoted names alone. */
function quoteFontFamily(family: string): string {
  const needsQuotes = /\s/.test(family) && !/^["']/.test(family) && !family.includes(',');
  return needsQuotes ? `"${family}"` : family;
}

function setOrRemove(name: string, value: string | null): void {
  const style = document.documentElement.style;
  if (value) style.setProperty(name, value);
  else style.removeProperty(name);
}

export function useAppTypography(): void {
  const settings = useSettingsStore();

  watchEffect(() => setOrRemove('--ui-font-size', `${settings.uiFontSize}px`));

  // #190 — dedicated code font; empty keeps the tokens.css monospace stack.
  watchEffect(() => {
    const family = (settings.codeFontFamily || '').trim();
    setOrRemove('--font-mono', family ? `${quoteFontFamily(family)}, ${MONO_FALLBACK}` : null);
  });

  // v4.3.0 (PR #74) — preview font size, read by Preview.vue without re-rendering.
  watchEffect(() =>
    setOrRemove('--content-font-size', `${settings.previewFontSize || DEFAULT_PREVIEW_FONT_SIZE}px`),
  );

  // #141 / #216 — markdown-it singleton flags track their settings.
  watchEffect(() => setMarkdownHardBreaks(settings.markdownHardBreaks));
  watchEffect(() => setMarkdownAutoNumberHeadings(settings.markdownAutoNumberHeadings));
  watchEffect(() => setMarkdownSmartQuotes(settings.smartQuotes));

  // #133 — preview and reading view use the editor font. Gitee IK9BBG — reading
  // mode keeps its serif stack unless the user picked a face, hence the second var.
  watchEffect(() => {
    const family = settings.fontFamily;
    setOrRemove('--content-font-family', buildEditorFontStack(family));
    setOrRemove('--content-font-user', family.trim() ? buildEditorFontStack(family) : null);
  });
}
