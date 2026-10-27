<script setup lang="ts">
/* Theme Studio — a non-modal side panel for building a light+dark theme with
 * colour pickers. The draft drives the real app palette while the panel is
 * open (see useThemeStudio), so every pick is visible at once. */
import { computed, onMounted, ref } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';
import { themeFamily, themeLabels } from '../lib/themes';
import { useThemeStudio } from '../composables/useThemeStudio';
import {
  DARK_BASES,
  LIGHT_BASES,
  THEME_TOKEN_GROUPS,
  harmonize,
  isHexColor,
  newUserThemeId,
  CUSTOM_CSS_BASE,
  hasCustomCssLoaded,
  readThemePalette,
  toHex6,
  userThemeCss,
  type Palette,
  type ThemeMode,
  type UserTheme,
} from '../lib/user-theme';
import type { Theme } from '../types';

type PreviewMode = ThemeMode | 'both';

const settings = useSettingsStore();
const toasts = useToastsStore();
const { t } = useI18n();
const { studioOpen, draft } = useThemeStudio();

const themeOnOpen = settings.theme;
const savedSnapshot = ref('');
const previewMode = ref<PreviewMode>(themeFamily(settings.theme));
const customCssName = settings.customCssPath && hasCustomCssLoaded()
  ? (settings.customCssPath.split(/[\\/]/).pop() ?? '').replace(/\.css$/i, '')
  : '';
const lightBases = computed(() => (customCssName ? [CUSTOM_CSS_BASE, ...LIGHT_BASES] : [...LIGHT_BASES]));
const darkBases = computed(() => (customCssName ? [CUSTOM_CSS_BASE, ...DARK_BASES] : [...DARK_BASES]));
function initialBase(bases: readonly string[], fallback: string): string {
  if (customCssName) return CUSTOM_CSS_BASE;
  return bases.includes(settings.theme) ? settings.theme : fallback;
}
const lightBase = ref<string>(initialBase(LIGHT_BASES, 'light'));
const darkBase = ref<string>(initialBase(DARK_BASES, 'dark'));
const openGroups = ref<Record<string, boolean>>({ basics: true });
const confirmingClose = ref(false);

const current = computed(() => draft.value as UserTheme);
const isSaved = computed(() => settings.userThemes.some((ut) => ut.id === current.value.id));
const isDirty = computed(() => JSON.stringify(current.value) !== savedSnapshot.value);
const shownModes = computed<ThemeMode[]>(() => (previewMode.value === 'both' ? ['light', 'dark'] : [previewMode.value]));

function baseLabel(name: string): string {
  if (name === CUSTOM_CSS_BASE) return `${customCssName} (${t('themeStudio.customCss')})`;
  return themeLabels.find((l) => l.value === name)?.label ?? name;
}

function freshTheme(): UserTheme {
  return {
    id: newUserThemeId(),
    name: `${t('themeStudio.defaultName')} ${settings.userThemes.length + 1}`,
    light: readThemePalette(lightBase.value, 'light'),
    dark: readThemePalette(darkBase.value, 'dark'),
  };
}

function cloneTheme(theme: UserTheme): UserTheme {
  return { ...theme, light: { ...theme.light }, dark: { ...theme.dark } };
}

function startEditing(theme: UserTheme) {
  draft.value = cloneTheme(theme);
  savedSnapshot.value = isSaved.value ? JSON.stringify(theme) : '';
  confirmingClose.value = false;
}

function onPickTheme(id: string) {
  const existing = settings.userThemes.find((ut) => ut.id === id);
  startEditing(existing ?? freshTheme());
}

function setPreviewMode(mode: PreviewMode) {
  previewMode.value = mode;
  if (mode !== 'both') settings.setTheme(mode as Theme);
}

function setColor(mode: ThemeMode, key: string, value: string) {
  if (!isHexColor(value)) return;
  current.value[mode][key] = toHex6(value);
}

function resetFromBases() {
  current.value.light = readThemePalette(lightBase.value, 'light');
  current.value.dark = readThemePalette(darkBase.value, 'dark');
}

function harmonizeShown() {
  for (const mode of shownModes.value) current.value[mode] = harmonize(current.value[mode]);
}

function save() {
  const theme = cloneTheme(current.value);
  theme.name = theme.name.trim() || t('themeStudio.defaultName');
  settings.saveUserTheme(theme);
  settings.setActiveUserTheme(theme.id);
  savedSnapshot.value = JSON.stringify(theme);
  draft.value = cloneTheme(theme);
  toasts.success(t('themeStudio.saved', { name: theme.name }), 2500);
}

function removeTheme() {
  settings.deleteUserTheme(current.value.id);
  startEditing(freshTheme());
}

async function copyCss() {
  try {
    await navigator.clipboard.writeText(userThemeCss(current.value));
    toasts.success(t('themeStudio.copied'), 2000);
  } catch {
    toasts.warning(t('themeStudio.copyFailed'), 3000);
  }
}

function close(discard = false) {
  if (isDirty.value && !discard) {
    confirmingClose.value = true;
    return;
  }
  if (discard && !settings.activeUserThemeId) settings.setTheme(themeOnOpen);
  studioOpen.value = false;
  draft.value = null;
}

function saveAndClose() {
  save();
  close(true);
}

function paletteStyle(p: Palette): Record<string, string> {
  return { ...p };
}

onMounted(() => {
  if (draft.value) return;
  const active = settings.userThemes.find((ut) => ut.id === settings.activeUserThemeId);
  startEditing(active ?? freshTheme());
});
</script>

<template>
  <aside v-if="draft" class="studio" role="dialog" :aria-label="t('themeStudio.title')">
    <header class="studio__head">
      <strong>{{ t('themeStudio.title') }}</strong>
      <span v-if="isDirty" class="studio__dirty" :title="t('themeStudio.unsaved')">●</span>
      <button class="studio__x" :title="t('themeStudio.close')" @click="close()">×</button>
    </header>

    <div v-if="confirmingClose" class="studio__confirm">
      <span>{{ t('themeStudio.unsavedPrompt') }}</span>
      <button class="primary" @click="saveAndClose">{{ t('themeStudio.save') }}</button>
      <button @click="close(true)">{{ t('themeStudio.discard') }}</button>
      <button @click="confirmingClose = false">{{ t('themeStudio.keepEditing') }}</button>
    </div>

    <div class="studio__body">
      <div class="row">
        <select :value="isSaved ? current.id : ''" @change="onPickTheme(($event.target as HTMLSelectElement).value)">
          <option value="">{{ t('themeStudio.newTheme') }}</option>
          <option v-for="ut in settings.userThemes" :key="ut.id" :value="ut.id">{{ ut.name }}</option>
        </select>
        <input v-model="current.name" class="name" :placeholder="t('themeStudio.name')" maxlength="80" />
      </div>

      <div class="row">
        <span class="lbl">{{ t('themeStudio.preview') }}</span>
        <div class="seg" role="radiogroup">
          <button
            v-for="m in (['light', 'dark', 'both'] as const)"
            :key="m"
            role="radio"
            :aria-checked="previewMode === m"
            :class="{ on: previewMode === m }"
            @click="setPreviewMode(m)"
          >{{ t(`themeStudio.mode_${m}`) }}</button>
        </div>
      </div>

      <div v-if="previewMode === 'both'" class="minis">
        <div v-for="m in shownModes" :key="m" class="mini" :style="paletteStyle(current[m])">
          <div class="mini__bar">{{ t(`themeStudio.mode_${m}`) }}</div>
          <div class="mini__doc">
            <div class="mini__h1">Heading</div>
            <p>Text with <b>bold</b>, <i>italic</i>, <a>a link</a> and <code>code</code>.</p>
            <p class="mini__muted">Secondary text</p>
            <blockquote>A quote</blockquote>
            <pre><span class="k">const</span> <span class="v">n</span> <span class="o">=</span> <span class="n">42</span>; <span class="c">// note</span>
<span class="f">greet</span>(<span class="s">"hi"</span>)</pre>
            <span class="mini__btn">Accent</span>
          </div>
        </div>
      </div>

      <details class="base">
        <summary>{{ t('themeStudio.startFrom') }}</summary>
        <div class="row">
          <span class="lbl">{{ t('themeStudio.mode_light') }}</span>
          <select v-model="lightBase">
            <option v-for="b in lightBases" :key="b" :value="b">{{ baseLabel(b) }}</option>
          </select>
        </div>
        <div class="row">
          <span class="lbl">{{ t('themeStudio.mode_dark') }}</span>
          <select v-model="darkBase">
            <option v-for="b in darkBases" :key="b" :value="b">{{ baseLabel(b) }}</option>
          </select>
        </div>
        <button @click="resetFromBases">{{ t('themeStudio.loadBases') }}</button>
      </details>

      <button class="harmonize" :title="t('themeStudio.harmonizeHint')" @click="harmonizeShown">
        ✨ {{ t('themeStudio.harmonize') }}
      </button>

      <section v-for="g in THEME_TOKEN_GROUPS" :key="g.id" class="group">
        <button class="group__head" :aria-expanded="!!openGroups[g.id]" @click="openGroups[g.id] = !openGroups[g.id]">
          <span>{{ openGroups[g.id] ? '▾' : '▸' }}</span> {{ t(`themeStudio.group_${g.id}`) }}
        </button>
        <p class="group__area">📍 {{ g.area }}</p>
        <table v-if="openGroups[g.id]" class="tokens">
          <thead v-if="shownModes.length > 1">
            <tr><th></th><th v-for="m in shownModes" :key="m">{{ t(`themeStudio.mode_${m}`) }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="tk in g.tokens" :key="tk.key">
              <td class="tok-label" :title="tk.key">
                {{ tk.label }}
                <span class="tok-hint">{{ tk.hint }}</span>
              </td>
              <td v-for="m in shownModes" :key="m" class="tok-cell">
                <input
                  type="color"
                  :value="toHex6(current[m][tk.key] ?? '#808080')"
                  :aria-label="`${tk.label} (${m})`"
                  @input="setColor(m, tk.key, ($event.target as HTMLInputElement).value)"
                />
                <input
                  class="hex"
                  :value="current[m][tk.key]"
                  spellcheck="false"
                  maxlength="7"
                  @change="setColor(m, tk.key, ($event.target as HTMLInputElement).value)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <footer class="studio__foot">
      <button class="primary" @click="save">{{ t('themeStudio.save') }}</button>
      <button @click="copyCss">{{ t('themeStudio.copyCss') }}</button>
      <button v-if="isSaved" class="danger" @click="removeTheme">{{ t('themeStudio.delete') }}</button>
    </footer>
  </aside>
</template>

<style scoped>
.studio {
  position: fixed;
  top: calc(var(--titlebar-h) + 8px);
  right: 8px;
  bottom: calc(var(--statusbar-h) + 8px);
  width: min(400px, calc(100vw - 16px));
  z-index: var(--z-pop);
  display: flex;
  flex-direction: column;
  background: var(--bg-elev);
  color: var(--text);
  border: var(--bd);
  border-radius: var(--r-lg);
  box-shadow: var(--sh-pop);
  font-size: 12px;
}
.studio__head {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-bottom: var(--bd);
  font-size: 13px;
}
.studio__dirty { color: var(--accent); }
.studio__x { margin-left: auto; font-size: 18px; line-height: 1; }
.studio__confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  background: var(--accent-soft);
  border-bottom: var(--bd);
}
.studio__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--sp-3);
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
}
.studio__foot {
  display: flex;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
  border-top: var(--bd);
}
.row { display: flex; align-items: center; gap: var(--sp-2); }
.lbl { min-width: 56px; color: var(--text-muted); }
.name { flex: 1; min-width: 0; }
button, select, input:not([type='color']) {
  font: inherit;
  color: var(--text);
  background: var(--bg);
  border: var(--bd);
  border-radius: var(--r-sm);
  padding: 4px 8px;
  cursor: pointer;
}
input:not([type='color']) { cursor: text; }
button:hover { background: var(--bg-hover); }
button.primary { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
button.danger { margin-left: auto; color: var(--danger); }
.studio__x { border: none; background: transparent; }
.seg { display: inline-flex; border: var(--bd); border-radius: var(--r-sm); overflow: hidden; }
.seg button { border: none; border-radius: 0; }
.seg button.on { background: var(--accent); color: var(--accent-fg); }
.base summary { cursor: pointer; color: var(--text-muted); margin-bottom: var(--sp-2); }
.base { display: flex; flex-direction: column; gap: var(--sp-2); }
.base .row { margin-bottom: var(--sp-2); }
.harmonize { align-self: flex-start; }
.group__head {
  width: 100%;
  text-align: start;
  border: none;
  background: transparent;
  font-weight: 600;
  padding: 2px 0;
}
.tokens { width: 100%; border-collapse: collapse; }
.tokens th { font-weight: 500; color: var(--text-muted); text-align: start; padding-bottom: 2px; }
.tokens td { padding: 3px 0; }
.tok-label { color: var(--text); padding-inline-end: var(--sp-2); }
.tok-hint { display: block; font-size: 10.5px; color: var(--text-muted); line-height: 1.3; }
.group__area { margin: 0 0 var(--sp-1); font-size: 11px; color: var(--text-muted); }
.tok-cell { white-space: nowrap; }
.tok-cell input[type='color'] {
  width: 28px;
  height: 22px;
  padding: 0;
  border: var(--bd);
  border-radius: var(--r-sm);
  background: none;
  vertical-align: middle;
  cursor: pointer;
}
.hex { width: 74px; margin-inline-start: 4px; font-family: var(--font-mono); font-size: 11px; }
.minis { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
.mini {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow: hidden;
  font-size: 11px;
}
.mini__bar { background: var(--bg-elev); color: var(--text-muted); padding: 3px 8px; border-bottom: 1px solid var(--border); }
.mini__doc { padding: 6px 8px; }
.mini__doc p { margin: 4px 0; }
.mini__h1 { color: var(--md-h1); font-weight: 700; font-size: 14px; }
.mini__doc b { color: var(--md-strong); }
.mini__doc i { color: var(--md-em); }
.mini__doc a { color: var(--md-link); text-decoration: underline; }
.mini__doc code { color: var(--md-code); background: var(--md-code-bg); padding: 0 3px; border-radius: 3px; }
.mini__muted { color: var(--text-muted); }
.mini__doc blockquote { margin: 4px 0; padding-inline-start: 6px; border-inline-start: 2px solid var(--md-hr); color: var(--md-quote); }
.mini__doc pre { margin: 4px 0; padding: 4px 6px; background: var(--md-code-bg); border-radius: 4px; font-size: 10px; white-space: pre-wrap; }
.k { color: var(--syn-keyword); } .v { color: var(--syn-variable); } .o { color: var(--syn-operator); }
.n { color: var(--syn-number); } .c { color: var(--syn-comment); font-style: italic; }
.f { color: var(--syn-function); } .s { color: var(--syn-string); }
.mini__btn { display: inline-block; background: var(--accent); color: var(--accent-fg); border-radius: 4px; padding: 1px 8px; }
</style>
