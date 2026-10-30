<script setup lang="ts">
import { computed, ref } from 'vue';
import { activeKeyActions, combosFor, filterKeyActions, formatCombo, type KeyActionDef } from '../lib/keybindings';
import { useI18n } from '../i18n';
import { isMacOS } from '../lib/platform';
import { useSettingsStore } from '../stores/settings';
import { DsModal, DsTabs, DsInput } from '../ui';
import { SYNTAX_ITEMS } from './markdown-help-items.ts';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

type Tab = 'syntax' | 'shortcuts' | 'cli';
const activeTab = ref<Tab>('syntax');
const helpTabs = [
  { value: 'syntax', label: 'Markdown syntax' },
  { value: 'shortcuts', label: 'Shortcuts' },
  { value: 'cli', label: 'CLI' },
];
const query = ref('');
const today = new Date().toISOString().slice(0, 10);
const cliExampleNew = `solomd new "daily-${today}" "Today's to-dos:"`;

interface Shortcut {
  keys: string;
  en: string;
}
const macChord = isMacOS();
const kbSettings = useSettingsStore();

/**
 * The shortcuts tab is generated from the binding table, not written by hand.
 * The hand-written list below went stale the way every such list does — it
 * was missing a third of the commands, and the welcome note that mirrored it
 * told new users the wrong key for the command palette. Only rows that are
 * NOT bindable actions (⌘-click a wikilink, Tab in a table) still come from
 * the literal list, because there is no table to read them from.
 */
const { t } = useI18n();
function actionName(a: KeyActionDef): string {
  const key = `cmd.${a.id}`;
  const translated = t(key);
  return translated && translated !== key ? translated : a.label;
}
const CATEGORY_ORDER: KeyActionDef['category'][] = ['file', 'edit', 'view', 'navigate', 'tools', 'mindmap'];
const liveGroups = computed(() => {
  const hits = filterKeyActions(activeKeyActions(), query.value, actionName, kbSettings.keybindings, macChord);
  return CATEGORY_ORDER.map((cat) => ({
    cat,
    title: t('settings.keysCat' + cat.charAt(0).toUpperCase() + cat.slice(1)),
    items: hits.filter((a) => a.category === cat),
  })).filter((g) => g.items.length);
});
function liveKeys(a: KeyActionDef): string {
  const combos = combosFor(a.id, kbSettings.keybindings);
  return combos.length ? combos.map((c) => formatCombo(c, macChord)).join(' / ') : '—';
}
const builtinRows = computed(() => {
  const q = query.value.trim().toLowerCase();
  return BUILTIN_KEYS
    .filter((it) => !q || `${it.keys} ${it.en}`.toLowerCase().includes(q));
});
function changeShortcuts(): void {
  emit('close');
  window.dispatchEvent(new CustomEvent('solomd:open-settings', { detail: { section: 'keys' } }));
}

/** Keys that are not bindable actions, so no table knows about them. */
const BUILTIN_KEYS: Shortcut[] = [
  { keys: 'Cmd/Ctrl + click [[link]]', en: 'Open the target of a [[wikilink]]' },
  { keys: 'Tab', en: 'Indent / table column nav' },
  { keys: 'Shift+Tab', en: 'Outdent' },
];

const categories = computed(() => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of filtered.value) {
    if (!seen.has(it.category)) {
      seen.add(it.category);
      out.push(it.category);
    }
  }
  return out;
});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return SYNTAX_ITEMS;
  return SYNTAX_ITEMS.filter((it) => {
    const hay = `${it.category} ${it.syntax} ${it.example} ${it.en}`.toLowerCase();
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  });
});

function itemsOf(cat: string) {
  return filtered.value.filter((it) => it.category === cat);
}

async function copyExample(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {}
}
</script>

<template>
  <DsModal
    :model-value="props.open"
    width="820px"
    @update:model-value="emit('close')"
  >
    <template #header>
      <div class="help__hdr">
        <DsTabs
          :model-value="activeTab"
          :tabs="helpTabs"
          class="help__tabs"
          @update:model-value="activeTab = ($event as Tab)"
        />
        <DsInput
          v-if="activeTab !== 'cli'"
          :model-value="query"
          size="sm"
          class="help__search"
          :placeholder="activeTab === 'syntax' ? 'Search syntax…' : t('settings.keysSearch')"
          @update:model-value="query = $event"
        />
      </div>
    </template>
      <div class="help__body">
        <template v-if="activeTab === 'syntax'">
          <section v-for="cat in categories" :key="cat" class="help__section">
            <h3>{{ cat }}</h3>
            <div class="help__grid">
              <div v-for="(it, i) in itemsOf(cat)" :key="i" class="help__item">
                <div class="help__syntax">{{ it.syntax }}</div>
                <div class="help__desc help__desc--en">{{ it.en }}</div>
                <pre
                  class="help__example"
                  @click="copyExample(it.example)"
                  title="Click to copy"
                >{{ it.example }}</pre>
              </div>
            </div>
          </section>
          <p v-if="!filtered.length" class="help__empty">No matching syntax</p>
        </template>

        <template v-if="activeTab === 'shortcuts'">
          <p class="help__lead">
            {{ t('settings.keysHelpLead') }}
            <button class="help__link" @click="changeShortcuts()">{{ t('settings.keysHelpChange') }}</button>
          </p>
          <section v-for="g in liveGroups" :key="g.cat" class="help__section">
            <h3>{{ g.title }}</h3>
            <table class="help__keys">
              <tbody>
              <tr v-for="a in g.items" :key="a.id">
                <td class="help__keys-key"><kbd>{{ liveKeys(a) }}</kbd></td>
                <td class="help__keys-desc">
                  <div>{{ actionName(a) }}</div>
                  <div v-if="actionName(a) !== a.label" class="help__keys-en">{{ a.label }}</div>
                </td>
              </tr>
              </tbody>
            </table>
          </section>
          <section v-if="builtinRows.length" class="help__section">
            <h3>{{ t('settings.keysBuiltin') }}</h3>
            <table class="help__keys">
              <tbody>
              <tr v-for="(s, i) in builtinRows" :key="i">
                <td class="help__keys-key"><kbd>{{ s.keys }}</kbd></td>
                <td class="help__keys-desc">
                  <div>{{ s.en }}</div>
                </td>
              </tr>
              </tbody>
            </table>
          </section>
          <p v-if="!liveGroups.length && !builtinRows.length" class="help__lead">{{ t('settings.keysNoMatch') }}</p>
        </template>

        <template v-if="activeTab === 'cli'">
          <p class="help__lead">
            SoloMD ships with a <code>solomd</code> command-line tool for opening, creating and searching notes from the terminal.
          </p>
          <section class="help__section">
            <h3>Install</h3>
            <pre class="help__code" @click="copyExample('curl -fsSL https://raw.githubusercontent.com/zhitongblog/solomd/main/scripts/install-cli.sh | bash')" title="Click to copy">curl -fsSL https://raw.githubusercontent.com/zhitongblog/solomd/main/scripts/install-cli.sh | bash</pre>
            <p class="help__hint">
              The script installs to <code>/usr/local/bin/solomd</code> (or <code>~/.local/bin</code>). Then run <code>solomd help</code>.
            </p>
          </section>
          <section class="help__section">
            <h3>Commands</h3>
            <table class="help__keys">
              <tbody>
              <tr><td class="help__keys-key"><code>solomd open &lt;title|path&gt;</code></td><td class="help__keys-desc"><div>Open note in SoloMD</div></td></tr>
              <tr><td class="help__keys-key"><code>solomd new &lt;title&gt; [text]</code></td><td class="help__keys-desc"><div>Create + open new note</div></td></tr>
              <tr><td class="help__keys-key"><code>solomd list [folder]</code></td><td class="help__keys-desc"><div>List markdown files in a folder</div></td></tr>
              <tr><td class="help__keys-key"><code>solomd search &lt;query&gt;</code></td><td class="help__keys-desc"><div>Search markdown content (uses ripgrep if available)</div></td></tr>
              <tr><td class="help__keys-key"><code>solomd cat &lt;title|path&gt;</code></td><td class="help__keys-desc"><div>Print note content to stdout</div></td></tr>
              <tr><td class="help__keys-key"><code>solomd help</code></td><td class="help__keys-desc"><div>Show help</div></td></tr>
              </tbody>
            </table>
          </section>
          <section class="help__section">
            <h3>Notes directory</h3>
            <p class="help__hint">
              Defaults to <code>~/Documents/SoloMD</code>. Change it with the <code>SOLOMD_NOTES</code> environment variable:
            </p>
            <pre class="help__code" @click="copyExample('export SOLOMD_NOTES=$HOME/Notes')" title="Click to copy">export SOLOMD_NOTES=$HOME/Notes</pre>
            <p class="help__hint">
              A <code>title</code> argument resolves to <code>$SOLOMD_NOTES/&lt;title&gt;.md</code>; if it contains <code>/</code> or ends in <code>.md</code>/<code>.txt</code>, it is treated as a path.
            </p>
          </section>
          <section class="help__section">
            <h3>Examples</h3>
            <pre class="help__code" @click="copyExample(cliExampleNew)" title="Click to copy">{{ cliExampleNew }}</pre>
            <pre class="help__code" @click="copyExample('solomd search important')" title="Click to copy">solomd search important</pre>
            <pre class="help__code" @click="copyExample('solomd open ./my-doc.md')" title="Click to copy">solomd open ./my-doc.md</pre>
          </section>
        </template>
      </div>
    <template #footer>
      <div class="help__footer">
        Click any code block to copy · Press <kbd>Esc</kbd> or click outside to close
      </div>
    </template>
  </DsModal>
</template>

<style scoped>
/* Header row inside DsModal's header slot: tab strip on the left, the
   syntax search box on the right. */
.help__hdr {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.help__tabs {
  flex-shrink: 0;
}
/* DsTabs always renders a (here empty) panel under the tablist — collapse it
   since we host the real content in the modal body. */
.help__tabs :deep(.ds-tabs__panel) {
  display: none;
}
.help__tabs :deep(.ds-tabs__list) {
  border-bottom: none;
}
.help__search {
  flex: 1;
  min-width: 0;
  max-width: 320px;
}
.help__body {
  /* DsModal body already provides padding + scroll; just trim the top so the
     first section sits closer to the header. */
  margin: -4px 0 0;
}
.help__section {
  margin-bottom: 22px;
}
.help__section h3 {
  margin: 0 0 10px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
}
.help__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}
.help__item {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.help__syntax {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--accent);
  font-weight: 600;
}
.help__desc {
  font-size: 11px;
  line-height: 1.4;
}
.help__desc--en {
  color: var(--text-muted);
  font-style: italic;
}
.help__example {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--bg-hover);
  border-radius: 4px;
  padding: 6px 8px;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  cursor: pointer;
  color: var(--text);
  transition: background 0.12s;
}
.help__example:hover {
  background: var(--bg-active);
}
.help__empty {
  padding: 20px;
  color: var(--text-faint);
  text-align: center;
  font-size: 13px;
}
.help__footer {
  padding: 10px 18px;
  font-size: 11px;
  color: var(--text-faint);
  border-top: 1px solid var(--border);
  text-align: center;
}
.help__footer kbd {
  background: var(--bg-active);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 1px 5px;
  font-family: var(--font-mono);
  font-size: 10px;
}

.help__tabs {
  display: flex;
  gap: 4px;
}
.help__tabs button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-muted);
  font: 12px var(--font-ui);
  cursor: pointer;
  transition: all 0.12s;
}
.help__tabs button:hover {
  color: var(--text);
  background: var(--bg-hover);
}
.help__tabs button.active {
  color: var(--text);
  background: var(--bg-elev);
  border-color: var(--border);
  font-weight: 600;
}
.help__lead {
  margin: 0 0 16px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
}
.help__lead code,
.help__hint code {
  background: var(--bg-hover);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text);
}
.help__keys {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.help__keys tr {
  border-bottom: 1px solid var(--border);
}
.help__keys tr:last-child { border-bottom: 0; }
.help__keys td {
  padding: 8px 4px;
  vertical-align: top;
}
.help__keys-key {
  white-space: nowrap;
  width: 40%;
}
.help__keys-key kbd {
  background: var(--bg-hover);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 2px 8px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text);
}
.help__keys-key code {
  background: var(--bg-hover);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
}
.help__keys-desc div {
  font-size: 12px;
  color: var(--text);
  line-height: 1.4;
}
.help__keys-en {
  color: var(--text-muted) !important;
  font-style: italic;
  font-size: 11px !important;
}
.help__hint {
  margin: 6px 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}
.help__code {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--bg-hover);
  border-radius: 4px;
  padding: 8px 10px;
  margin: 6px 0;
  white-space: pre-wrap;
  word-break: break-word;
  cursor: pointer;
  color: var(--text);
  transition: background 0.12s;
}
.help__code:hover {
  background: var(--bg-active);
}
.help__link {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  color: var(--accent);
  cursor: pointer;
  text-decoration: underline;
}
</style>
