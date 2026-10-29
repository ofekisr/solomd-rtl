<script setup lang="ts">
/* Theme Studio — the body of the Theme Studio editor tab. Builds a light+dark
 * theme with colour pickers. The draft drives a miniature app (teleported to
 * the tab's preview pane) and the real app around it (see useThemeStudio), so
 * every pick is visible at once. */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { useToastsStore } from '../stores/toasts';
import { useThemeStore } from '../stores/theme';
import { useI18n } from '../i18n';
import type { Theme } from '../lib/theme/schema';
import { findVariant } from '../lib/theme/slots';
import { paletteOf, studioToTheme } from '../lib/theme/from-studio';
import { flashedPalette, locateToken, useThemeStudio } from '../composables/useThemeStudio';
import ThemeMock from './ThemeMock.vue';
import ThemeTokenRow from './ThemeTokenRow.vue';
import ColorPicker from './ColorPicker.vue';
import {
  DEFAULT_RADIUS,
  MAX_RADIUS,
  MIN_RADIUS,
  READABLE_CONTRAST,
  THEME_TOKEN_GROUPS,
  THEME_TOKEN_PAIRS,
  contrastRatio,
  harmonize,
  mergeKeeping,
  isHexColor,
  newUserThemeId,
  defaultGradient,
  isGradient,
  KEEP_CSS_BACKDROP,
  type Backdrop,
  type BgGradient,
  type Palette,
  toHex6,
  type ThemeMode,
  type ThemeToken,
  type ThemeTokenGroup,
  type UserTheme,
} from '../lib/user-theme';

const props = defineProps<{ previewTarget: string }>();

type PreviewMode = ThemeMode | 'both';
type BackdropKind = 'plain' | 'gradient' | 'layered';
const FULL_TURN = 360;
type TokenRow =
  | { kind: 'single'; token: ThemeToken }
  | { kind: 'pair'; fg: ThemeToken; bg: ThemeToken; label: string };

const RADIUS_STEP = 0.25;
const ERROR_TOAST_MS = 4000;

const settings = useSettingsStore();
const toasts = useToastsStore();
const { t } = useI18n();
const { draft, savedSnapshot, isDirty, previewFamily, registerSave } = useThemeStudio();

const themeStore = useThemeStore();
const previewMode = ref<PreviewMode>(previewFamily.value ?? themeStore.mode);

function savedTheme(id: string): Theme | undefined {
  return themeStore.themes.find((t) => t.id === id);
}

function basePalette(themeId: string, mode: ThemeMode): Palette {
  return paletteOf(findVariant(themeStore.themes, { themeId, variant: mode }, mode).variant);
}

function basesFor(mode: ThemeMode): Theme[] {
  return themeStore.themes.filter((th) => Object.values(th.variants).some((v) => v.mode === mode));
}
const lightBases = computed(() => basesFor('light'));
const darkBases = computed(() => basesFor('dark'));

function initialBase(mode: ThemeMode): string {
  const slot = mode === 'light' ? settings.lightSlot : settings.darkSlot;
  const bases = basesFor(mode);
  return bases.some((th) => th.id === slot.themeId) ? slot.themeId : (bases[0]?.id ?? slot.themeId);
}
const lightBase = ref<string>(initialBase('light'));
const darkBase = ref<string>(initialBase('dark'));
const openGroups = ref<Record<string, boolean>>({ basics: true });

const current = computed(() => draft.value as UserTheme);
const isSaved = computed(() => settings.userThemes.some((ut) => ut.id === current.value.id));
const isInUse = computed(() => settings.lightSlot.themeId === current.value.id || settings.darkSlot.themeId === current.value.id);
const myThemes = computed(() => themeStore.themes
  .filter((th) => th.source === 'mine' && th.origin === 'studio')
  .flatMap((th) => settings.userThemes.filter((ut) => ut.id === th.id)));
const shownModes = computed<ThemeMode[]>(() => (previewMode.value === 'both' ? ['light', 'dark'] : [previewMode.value]));

function rowsOf(group: ThemeTokenGroup): TokenRow[] {
  const byKey = new Map(group.tokens.map((tk) => [tk.key, tk]));
  const paired = new Set<string>();
  const rows: TokenRow[] = [];
  for (const token of group.tokens) {
    if (paired.has(token.key)) continue;
    const pair = THEME_TOKEN_PAIRS.find((p) => p.fg === token.key || p.bg === token.key);
    const fg = pair && byKey.get(pair.fg);
    const bg = pair && byKey.get(pair.bg);
    if (!pair || !fg || !bg) {
      rows.push({ kind: 'single', token });
      continue;
    }
    paired.add(fg.key).add(bg.key);
    rows.push({ kind: 'pair', fg, bg, label: pair.label });
  }
  return rows;
}
const groups = THEME_TOKEN_GROUPS.map((g) => ({ ...g, rows: rowsOf(g) }));

function baseLabel(id: string): string {
  return themeStore.themes.find((th) => th.id === id)?.name ?? id;
}

function freshTheme(): UserTheme {
  return {
    id: newUserThemeId(),
    name: `${t('themeStudio.defaultName')} ${settings.userThemes.length + 1}`,
    light: basePalette(lightBase.value, 'light'),
    dark: basePalette(darkBase.value, 'dark'),
    edited: { light: [], dark: [] },
    radius: DEFAULT_RADIUS,
    gradient: { light: null, dark: null },
  };
}

function backdropKind(mode: ThemeMode): BackdropKind {
  const b = current.value.gradient[mode];
  if (b === KEEP_CSS_BACKDROP) return 'layered';
  return isGradient(b) ? 'gradient' : 'plain';
}

function hasLayeredBackdrop(mode: ThemeMode): boolean {
  return Boolean(savedTheme(current.value.id)?.variants[mode]?.surfaces?.style?.backdrop?.length);
}

function setBackdropKind(mode: ThemeMode, kind: BackdropKind) {
  const next: Record<BackdropKind, () => Backdrop> = {
    plain: () => null,
    gradient: () => defaultGradient(current.value[mode]),
    layered: () => KEEP_CSS_BACKDROP,
  };
  current.value.gradient[mode] = next[kind]();
}

function gradientOf(mode: ThemeMode): BgGradient {
  return current.value.gradient[mode] as BgGradient;
}

function setGradient(mode: ThemeMode, patch: Partial<BgGradient>) {
  current.value.gradient[mode] = { ...gradientOf(mode), ...patch };
}

function baseFor(mode: ThemeMode): string {
  return mode === 'light' ? lightBase.value : darkBase.value;
}

function otherMode(mode: ThemeMode): ThemeMode {
  return mode === 'light' ? 'dark' : 'light';
}

function resetTitle(mode: ThemeMode): string {
  return t('themeStudio.resetToken', { base: baseLabel(baseFor(mode)) });
}

function cloneTheme(theme: UserTheme): UserTheme {
  return {
    ...theme,
    light: { ...theme.light },
    dark: { ...theme.dark },
    edited: { light: [...theme.edited.light], dark: [...theme.edited.dark] },
    gradient: { light: copyBackdrop(theme.gradient.light), dark: copyBackdrop(theme.gradient.dark) },
  };
}

function copyBackdrop(b: Backdrop): Backdrop {
  if (b === KEEP_CSS_BACKDROP) return b;
  return isGradient(b) ? { ...b } : null;
}

/** A fresh theme counts as unchanged until the first edit. */
function startEditing(theme: UserTheme) {
  draft.value = cloneTheme(theme);
  savedSnapshot.value = JSON.stringify(draft.value);
}

function onPickTheme(id: string) {
  const existing = settings.userThemes.find((ut) => ut.id === id);
  startEditing(existing ?? freshTheme());
}

function setPreviewMode(mode: PreviewMode) {
  previewMode.value = mode;
  if (mode !== 'both') previewFamily.value = mode;
}

function setColor(mode: ThemeMode, key: string, value: string) {
  if (!isHexColor(value)) return;
  current.value[mode][key] = toHex6(value);
  if (!current.value.edited[mode].includes(key)) current.value.edited[mode].push(key);
}

/** Back to the base theme's colour, and no longer counted as hand-picked. */
function resetToken(mode: ThemeMode, key: string) {
  current.value[mode][key] = basePalette(baseFor(mode), mode)[key];
  current.value.edited[mode] = current.value.edited[mode].filter((k) => k !== key);
}

function locate(mode: ThemeMode, key: string) {
  if (previewMode.value !== 'both' && previewMode.value !== mode) setPreviewMode(mode);
  locateToken(mode, key, current.value[mode][key] ?? '');
}

function swapPair(mode: ThemeMode, fg: string, bg: string) {
  const [fgColor, bgColor] = [current.value[mode][fg], current.value[mode][bg]];
  setColor(mode, fg, bgColor);
  setColor(mode, bg, fgColor);
}

/** Give the other mode this pair's colours, then show that mode. */
function copyPairToOther(mode: ThemeMode, fg: string, bg: string) {
  const target = otherMode(mode);
  setColor(target, fg, current.value[mode][fg]);
  setColor(target, bg, current.value[mode][bg]);
  if (previewMode.value !== 'both') setPreviewMode(target);
}

function ratio(mode: ThemeMode, fg: string, bg: string): number {
  return contrastRatio(toHex6(current.value[mode][fg] ?? ''), toHex6(current.value[mode][bg] ?? ''));
}

/* Automatic fills only touch the mode(s) on screen, and never a hand-picked colour. */
function resetFromBases() {
  for (const mode of shownModes.value) {
    current.value[mode] = mergeKeeping(current.value[mode], basePalette(baseFor(mode), mode), current.value.edited[mode]);
  }
}

function harmonizeShown() {
  for (const mode of shownModes.value) current.value[mode] = harmonize(current.value[mode], current.value.edited[mode]);
}

async function save(): Promise<boolean> {
  const theme = cloneTheme(current.value);
  theme.name = theme.name.trim() || t('themeStudio.defaultName');
  try {
    await themeStore.save(studioToTheme(theme, savedTheme(theme.id)));
  } catch {
    toasts.error(t('themeStudio.saveFailed'), ERROR_TOAST_MS);
    return false;
  }
  settings.saveUserTheme(theme);
  startEditing(theme);
  toasts.success(t('themeStudio.saved', { name: theme.name }), 2500);
  return true;
}

/** The only action that changes which theme the app uses. */
async function useTheme() {
  if ((isDirty.value || !isSaved.value) && !(await save())) return;
  themeStore.useTheme(current.value.id);
  toasts.success(t('themeStudio.applied', { name: current.value.name }), 2500);
}

function discard() {
  onPickTheme(isSaved.value ? current.value.id : '');
}

async function removeTheme() {
  const { id } = current.value;
  try {
    await themeStore.remove(id);
  } catch {
    toasts.error(t('themeStudio.deleteFailed'), ERROR_TOAST_MS);
    return;
  }
  settings.deleteUserTheme(id);
  startEditing(freshTheme());
}

async function copyJson() {
  try {
    await navigator.clipboard.writeText(JSON.stringify(studioToTheme(current.value, savedTheme(current.value.id)), null, 2));
    toasts.success(t('themeStudio.copied'), 2000);
  } catch {
    toasts.warning(t('themeStudio.copyFailed'), 3000);
  }
}

onMounted(() => {
  if (previewMode.value !== 'both') previewFamily.value = previewMode.value;
  if (draft.value) return;
  const active = settings.userThemes.find((ut) => ut.id === themeStore.active.theme.id);
  startEditing(active ?? freshTheme());
});

const unregisterSave = registerSave(save);
onUnmounted(unregisterSave);
</script>

<template>
  <div v-if="draft" class="studio">
    <div class="row">
      <select :value="isSaved ? current.id : ''" @change="onPickTheme(($event.target as HTMLSelectElement).value)">
        <option value="">{{ t('themeStudio.newTheme') }}</option>
        <option v-for="ut in myThemes" :key="ut.id" :value="ut.id">{{ ut.name }}</option>
      </select>
      <input v-model="current.name" class="name" :placeholder="t('themeStudio.name')" maxlength="80" />
      <span v-if="isDirty" class="dirty" :title="t('themeStudio.unsaved')">● {{ t('themeStudio.unsaved') }}</span>
    </div>

    <Teleport defer :to="'#' + props.previewTarget">
    <div class="stage">
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
      <div class="mocks" :class="{ 'mocks--two': shownModes.length > 1 }">
        <ThemeMock
          v-for="m in shownModes"
          :key="m"
          :palette="flashedPalette(current[m], m)"
          :radius="current.radius"
          :backdrop="current.gradient[m]"
          :label="t(`themeStudio.mode_${m}`)"
        />
      </div>
    </div>
    </Teleport>

    <div class="row">
      <span class="lbl">{{ t('themeStudio.corners') }}</span>
      <span class="hint">{{ t('themeStudio.cornersSquare') }}</span>
      <input
        v-model.number="current.radius"
        type="range"
        class="radius"
        :min="MIN_RADIUS"
        :max="MAX_RADIUS"
        :step="RADIUS_STEP"
        :aria-label="t('themeStudio.corners')"
      />
      <span class="hint">{{ t('themeStudio.cornersRound') }}</span>
      <button v-if="current.radius !== DEFAULT_RADIUS" class="link" @click="current.radius = DEFAULT_RADIUS">↺</button>
    </div>

    <div v-for="m in shownModes" :key="`bg-${m}`" class="row">
      <span class="lbl">{{ t('themeStudio.backdrop', { mode: t(`themeStudio.mode_${m}`) }) }}</span>
      <select
        :value="backdropKind(m)"
        @change="setBackdropKind(m, ($event.target as HTMLSelectElement).value as BackdropKind)"
      >
        <option value="plain">{{ t('themeStudio.backdropPlain') }}</option>
        <option value="gradient">{{ t('themeStudio.backdropGradient') }}</option>
        <option v-if="backdropKind(m) === 'layered' || hasLayeredBackdrop(m)" value="layered">
          {{ t('themeStudio.backdropLayered') }}
        </option>
      </select>
      <template v-if="backdropKind(m) === 'gradient'">
        <ColorPicker
          :model-value="gradientOf(m).from"
          :label="t('themeStudio.gradientFrom')"
          :swatches="Object.values(current[m])"
          @update:model-value="setGradient(m, { from: $event })"
        />
        <span class="hint">→</span>
        <ColorPicker
          :model-value="gradientOf(m).to"
          :label="t('themeStudio.gradientTo')"
          :swatches="Object.values(current[m])"
          @update:model-value="setGradient(m, { to: $event })"
        />
        <input
          type="range"
          class="radius"
          min="0"
          :max="FULL_TURN - 1"
          :value="gradientOf(m).angle"
          :aria-label="t('themeStudio.gradientAngle')"
          @input="setGradient(m, { angle: Number(($event.target as HTMLInputElement).value) })"
        />
        <span class="hint">{{ gradientOf(m).angle }}°</span>
      </template>
    </div>

    <details class="base">
      <summary>{{ t('themeStudio.startFrom') }}</summary>
      <div class="row">
        <span class="lbl">{{ t('themeStudio.mode_light') }}</span>
        <select v-model="lightBase">
          <option v-for="b in lightBases" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
        <span class="lbl">{{ t('themeStudio.mode_dark') }}</span>
        <select v-model="darkBase">
          <option v-for="b in darkBases" :key="b.id" :value="b.id">{{ b.name }}</option>
        </select>
        <button @click="resetFromBases">{{ t('themeStudio.loadBases') }}</button>
      </div>
    </details>

    <div class="row">
      <button :title="t('themeStudio.harmonizeHint')" @click="harmonizeShown">✨ {{ t('themeStudio.harmonize') }}</button>
      <span class="hint">{{ t('themeStudio.locateHint') }}</span>
    </div>
    <p class="hint">{{ t('themeStudio.safetyNote') }}</p>

    <section v-for="g in groups" :key="g.id" class="group">
      <button class="group__head" :aria-expanded="!!openGroups[g.id]" @click="openGroups[g.id] = !openGroups[g.id]">
        <span>{{ openGroups[g.id] ? '▾' : '▸' }}</span> {{ t(`themeStudio.group_${g.id}`) }}
        <span class="group__area">📍 {{ g.area }}</span>
      </button>
      <div v-if="openGroups[g.id]">
        <div v-if="shownModes.length > 1" class="modes-head" :style="{ '--cols': shownModes.length }">
          <span v-for="m in shownModes" :key="m">{{ t(`themeStudio.mode_${m}`) }}</span>
        </div>
        <template v-for="row in g.rows" :key="row.kind === 'pair' ? row.fg.key : row.token.key">
          <ThemeTokenRow
            v-if="row.kind === 'single'"
            :token="row.token"
            :modes="shownModes"
            :theme="current"
            :reset-title="resetTitle"
            @set="setColor"
            @reset="resetToken"
            @locate="locate"
          />
          <div v-else class="pair">
            <div class="pair__title">{{ row.label }}</div>
            <ThemeTokenRow
              v-for="tk in [row.fg, row.bg]"
              :key="tk.key"
              :token="tk"
              :modes="shownModes"
              :theme="current"
              :reset-title="resetTitle"
              @set="setColor"
              @reset="resetToken"
              @locate="locate"
            />
            <div class="pair__bar" :style="{ '--cols': shownModes.length }">
              <div v-for="m in shownModes" :key="m" class="pair__mode">
                <span
                  class="chip"
                  :style="{ color: current[m][row.fg.key], background: current[m][row.bg.key] }"
                >Aa</span>
                <span
                  class="ratio"
                  :class="{ 'ratio--low': ratio(m, row.fg.key, row.bg.key) < READABLE_CONTRAST }"
                  :title="t('themeStudio.contrastHint')"
                >{{ ratio(m, row.fg.key, row.bg.key).toFixed(1) }}:1
                  {{ ratio(m, row.fg.key, row.bg.key) < READABLE_CONTRAST ? '⚠' : '✓' }}</span>
                <span class="pair__acts">
                  <button :title="t('themeStudio.swapHint')" @click="swapPair(m, row.fg.key, row.bg.key)">⇄ {{ t('themeStudio.swap') }}</button>
                  <button
                    :title="t('themeStudio.copyToHint', { mode: t(`themeStudio.mode_${otherMode(m)}`) })"
                    @click="copyPairToOther(m, row.fg.key, row.bg.key)"
                  >→ {{ t(`themeStudio.mode_${otherMode(m)}`) }}</button>
                </span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </section>

    <footer class="foot">
      <button :class="{ primary: isInUse }" @click="save">{{ t('themeStudio.save') }}</button>
      <button v-if="!isInUse" class="primary" :title="t('themeStudio.useHint')" @click="useTheme">{{ t('themeStudio.use') }}</button>
      <span v-else class="hint">✓ {{ t('themeStudio.inUse') }}</span>
      <button v-if="isDirty" @click="discard">{{ t('themeStudio.discard') }}</button>
      <button @click="copyJson">{{ t('themeStudio.copyJson') }}</button>
      <button v-if="isSaved" class="danger" @click="removeTheme">{{ t('themeStudio.delete') }}</button>
    </footer>
  </div>
</template>

<style scoped>
.studio {
  --tok-col: 170px;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  font-size: 12px;
  color: var(--text);
}
.row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-2); }
.lbl { color: var(--text-muted); }
.hint { margin: 0; font-size: 11px; color: var(--text-muted); }
.name { flex: 1; min-width: 120px; }
.dirty { color: var(--accent); font-size: 11px; }
button, select, input:not([type='color']):not([type='range']) {
  font: inherit;
  color: var(--text);
  background: var(--bg);
  border: var(--bd);
  border-radius: var(--r-sm);
  padding: 4px 8px;
  cursor: pointer;
}
input:not([type='color']):not([type='range']) { cursor: text; }
button:hover { background: var(--bg-hover); }
button.primary { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }
button.danger { margin-inline-start: auto; color: var(--danger); }
button.link { border: none; background: transparent; color: var(--accent); padding: 0 4px; }
.seg { display: inline-flex; border: var(--bd); border-radius: var(--r-sm); overflow: hidden; }
.seg button { border: none; border-radius: 0; }
.seg button.on { background: var(--accent); color: var(--accent-fg); }
.stage {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  font-size: 12px;
  color: var(--text);
}
.mocks { display: grid; grid-template-columns: 1fr; gap: var(--sp-2); }
.mocks--two { grid-template-columns: 1fr 1fr; }
.radius { flex: 0 1 180px; accent-color: var(--accent); }
.base summary { cursor: pointer; color: var(--text-muted); margin-bottom: var(--sp-2); }
.group { display: flex; flex-direction: column; }
.group__head {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  width: 100%;
  text-align: start;
  border: none;
  background: transparent;
  font-weight: 600;
  padding: 4px 0;
}
.group__area { font-weight: 400; font-size: 11px; color: var(--text-muted); }
.modes-head, .pair__bar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) repeat(var(--cols), var(--tok-col));
  column-gap: var(--sp-3);
}
.modes-head > :first-child, .pair__bar > :first-child { grid-column: 2; }
.modes-head { color: var(--text-muted); }
.pair {
  margin: 4px 0;
  padding: 4px 8px;
  border: var(--bd);
  border-radius: var(--r-sm);
  box-shadow: inset 3px 0 0 var(--accent);
}
.pair:dir(rtl) { box-shadow: inset -3px 0 0 var(--accent); }
.pair__title { font-weight: 600; font-size: 11px; color: var(--text-muted); }
.pair__bar { padding-top: 2px; }
.pair__mode { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
.chip { padding: 0 8px; border: var(--bd); border-radius: var(--r-sm); font-weight: 700; }
.ratio { font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.ratio--low { color: var(--danger); }
.pair__acts { display: inline-flex; gap: 4px; opacity: 0; transition: opacity 0.12s; }
.pair__acts button { padding: 1px 6px; font-size: 11px; }
.pair:hover .pair__acts, .pair:focus-within .pair__acts { opacity: 1; }
.foot {
  position: sticky;
  bottom: calc(-1 * var(--sp-4));
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) 0;
  background: var(--bg-elev);
  border-top: var(--bd);
}
</style>
