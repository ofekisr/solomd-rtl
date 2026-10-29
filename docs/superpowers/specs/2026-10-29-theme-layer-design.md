# Theme layer — design

Date: 2026-10-29 · Status: implemented (plan 1, v4.39.0); plan 2 UI pending

## Problem

Five mechanisms paint the app today, each owning a different slice:

| Mechanism | Paints | Where |
|---|---|---|
| Built-in theme name | Shell palette (`:root[data-theme]`) + hardcoded CodeMirror chrome | `styles/main.css`, `lib/themes.ts` (`mkTheme`, `cmChromeFor`) |
| Custom CSS file (marketplace) | Anything it targets, unscoped | `lib/custom-theme.ts` |
| Theme Studio user theme | Shell + `--syn-*` via injected `<style>` | `lib/user-theme.ts`, `composables/useThemeStudio.ts` |
| Mermaid | `'dark'` / `'default'` by family | `mermaidThemeFor` |
| Mind map | Light/dark by family | `useMindmapDisplay.ts` |

They override each other (`themeOverride()`), can't be combined, and a CodeMirror theme can't be installed at all.

## Goal

One theme interface for the user. A theme controls the shell, tabs, preview, editor and diagrams. CodeMirror themes are imported from a catalog and converted to app themes behind the scenes. Light/dark behaves the same for every theme.

**Out of scope:** mind map palettes (they keep following light/dark only); npm/URL/VS Code imports; arbitrary CSS.

## Decisions

| Topic | Decision |
|---|---|
| Engine | Everything is CSS variables; CodeMirror and preview read them |
| Extra CSS | Not allowed. Component styling is typed style props |
| Structure | Each section declares its own `colors` and `style` |
| Variants | One theme holds named variants (`light`, `dark`, `dim`…) |
| Light/dark | Two slots (light slot, dark slot) + Appearance: Light / Dark / Follow system |
| Sources | Built-in, Catalog (both bundled, read-only), My themes (files, editable) |
| CM import | Built-in catalog only; converted to a full app theme, app colours derived |
| Marketplace CSS | Converted on install; unmapped rules dropped and reported |

## 1. Theme file format

```ts
Theme {
  id: string
  name: string
  author?: string
  version: 1
  source: 'builtin' | 'catalog' | 'mine'
  origin?: 'studio' | 'json' | 'marketplace' | 'fork'   // mine only; a badge + import report, no branching
  basedOn?: string                                      // set by Customize
  variants: Record<string, Variant>                     // ≥ 1
}

Variant {
  label?: string                                        // picker text: "Dark", "Midnight"
  mode: 'light' | 'dark'                                // which slot it can fill
  app:      { colors: AppColors,      style?: AppStyle }
  surfaces?: { colors?: SurfaceColors, style?: SurfaceStyle }
  markdown?: { colors?: MarkdownColors, style?: MarkdownStyle }
  code?:     { colors?: CodeColors,     style?: CodeStyle }
  editor?:   { colors?: EditorColors,   style?: EditorStyle }
  diagrams?: { colors?: DiagramColors,  style?: DiagramStyle }
}

TextStyle = { italic?: boolean; bold?: boolean; underline?: boolean }
```

| Section | Colours | Style props (what each changes) |
|---|---|---|
| app | bg, text, textMuted, textFaint, accent, accentFg, danger | `radius` 0–2 — corner roundness of buttons, panels, dialogs |
| surfaces | panel, hover, active, soft, border | `backdrop` — list of gradient layers behind the window (`linear {angle, stops}` / `radial {x, y, color, fade}`; empty = none); `panelOpacity` 0–1 — how see-through sidebars/toolbars are; `panelBlur` px — blur behind see-through panels |
| markdown | h1–h6, strong, em, link, url, code, codeBg, quote, list, hr | `heading`, `link`, `quote`: TextStyle |
| code | keyword, string, number, comment, function, variable, type, property, operator, punctuation, tag, attribute, regexp, constant, invalid | `comment`, `keyword`, `function`, `string`: TextStyle |
| editor | background, gutterBg, gutterFg, activeLine, selection, cursor, bracket, search, searchActive | `activeLine` boolean — highlight the cursor's line |
| diagrams | nodeBg, nodeBorder, line, text | `nodeRadius` 0–2 — diagram box roundness |

**Rules**

1. Only `app.colors` is required. Every other value has a fallback (`resolve.ts`), e.g. `editor.background → app.bg`, `diagrams.line → surfaces.border`, `code.constant → code.number`, `surfaces.*` → colour-mix of `app.bg` and `app.text`.
2. Colours accept hex, `rgb()`, `hsl()`, `color-mix()` only. Style values are typed and range-checked. Unknown keys are rejected. A theme cannot carry CSS or code.
3. Built-in and catalog themes are read-only; Customize forks them into My themes.

**Settings**

```ts
appearance: 'light' | 'dark' | 'system'
lightSlot:  { themeId: string; variant: string }   // variant.mode must be 'light'
darkSlot:   { themeId: string; variant: string }   // variant.mode must be 'dark'
```

Picking a theme with both modes fills both slots.

## 2. Theme manager

Module `app/src/lib/theme/` + store `app/src/stores/theme.ts`.

| Unit | Job |
|---|---|
| `schema.ts` | Zod schema for Theme/Variant; every source passes through it |
| `resolve.ts` | Variant → complete token set (applies fallbacks) |
| `sources.ts` | Loads Built-in (bundled JSON), Catalog (bundled JSON), My themes (`<config>/themes/<id>.json`) into one list |
| `apply.ts` | Writes resolved tokens to the DOM, CodeMirror and Mermaid |
| `stores/theme.ts` | Theme list, slots, appearance, active variant, `previewVariant()` |

**Apply pipeline**

1. Appearance + `matchMedia('(prefers-color-scheme: dark)')` picks the slot; a listener follows system switches.
2. Slot → theme + variant → `resolve()` → token set.
3. Tokens go into one `<style id="solomd-theme">` as `:root { --bg: …; --syn-comment-style: italic; … }`. `<html data-mode="light|dark">` is set.
4. Consumers:
   - **Shell, tabs, preview:** existing `--*` variable names, unchanged.
   - **Editor:** one var-based `EditorView.theme` per mode + the unified `HighlightStyle`, which also reads style vars (`fontStyle: var(--syn-comment-style)`). The theme compartment reconfigures only when the mode flips; colour edits repaint without it.
   - **Mermaid:** `base` theme with `themeVariables` from resolved hex values (Mermaid derives shades and can't read CSS vars).
   - **Mind map:** follows `data-mode`.

**Preview:** `previewVariant(draft)` runs the same pipeline without saving; cancel/leave restores the slot.

**Errors:** a file failing validation is skipped with a toast naming the file and field. A slot whose theme or variant is missing falls back to SoloMD · Light / Dark.

**Removed:** `settings.theme`, `customCssPath`, `activeUserThemeId`, `userThemes` (after migration), `themeOverride()`, `cmChromeFor`, `mkTheme` + hardcoded hex, `loadCustomTheme`, `applyUserTheme`, per-theme palettes in `main.css`.

## 3. Converters

Every source converts once to the format above; the app only reads that format.

| Source | Runs | Conversion |
|---|---|---|
| Built-in 8 | One-off script, output committed | `main.css` palettes + `mkTheme` hex → JSON. Pairs merge: Solarized (light+dark), SoloMD (Light + Dark/One Dark) |
| CodeMirror catalog | Build-time script, output committed | Below |
| Theme Studio themes | Migration (section 5) | Palette keys map 1:1 to tokens; `radius → app.style.radius`; `gradient → surfaces.style.backdrop`; light/dark palettes → 2 variants |
| Marketplace CSS | On install | Below |
| Theme JSON | On import | Schema check only |

**CodeMirror catalog**

1. Source: `@uiw/codemirror-themes-all` (MIT, ~40 themes) + `@codemirror/theme-one-dark`. Dev dependencies of the script only.
2. Extraction is generic: a Playwright script mounts an editor per theme, renders a sample with one token per highlight tag, and reads computed colour and font style. Works for any CodeMirror 6 theme extension.
3. Mapping: tag colours/styles → `code`; background, gutter, selection, cursor, active line → `editor`; mode from background luminance.
4. Derived app colours: `bg` = editor background; `text` = foreground; `accent` = cursor colour, or function colour when the cursor is near-grey; `panel/hover/border/textMuted` = colour-mix of bg and fg at fixed ratios; headings from keyword/function/type…; `link` from string; diagrams from accent/border/text.
5. Output: `lib/theme/catalog/<id>.json`. No CodeMirror theme packages ship at runtime.

**Marketplace CSS**

- `:root`, `[data-theme="light"]`, `[data-theme="dark"]` variable blocks → variants.
- Detected patterns → style props: backdrop gradient, see-through panels (rgba + `backdrop-filter`), radius.
- Everything else is dropped; the import report lists each dropped rule.

## 4. Theme page UI

One Theme page in Settings replaces the theme dropdown, custom CSS picker and Theme Studio entry.

- **Top:** Appearance (Light | Dark | Follow system), Light slot picker, Dark slot picker. Pickers list only variants of the matching mode.
- **Gallery:** filters All · Built-in · Catalog · My themes. Card = mini preview (tab bar, markdown line, code line) in the theme's tokens + a dot per variant. Hover = live preview of the whole app; leave restores. Click = set the slot of that mode. Menu: Customize · Duplicate · Export JSON · Delete (My themes only).
- **Actions:** Import JSON… (report of dropped/defaulted values); Browse marketplace (install → CSS converter → report).
- **Customize (Theme Studio reshaped):** left — sections, each with Colours and Style using the plain labels; right — live preview with variant switcher and "+ Add variant". Built-in/catalog themes fork first (`basedOn`). Keeps `locateToken` click-to-jump and Flash. Save writes the file; Cancel restores.

## 5. Migration and testing

**Migration** — first launch on the new version, guarded by `theme.migrated.v1`:

| Old state | New state |
|---|---|
| `theme = 'nord'` etc. | Both slots = that theme's variant(s); appearance = its mode |
| `theme = 'light'` / `'dark'` | SoloMD · Light / Dark; appearance = that mode |
| `activeUserThemeId` | All `userThemes` → files in My themes; both slots = the active one's variants |
| `customCssPath` | Converted to JSON in My themes; both slots = it; report shown once |
| Fresh install | Slots = SoloMD Light/Dark; appearance = system |

Old keys remain readable for one release as rollback, then are removed.

**Tests** (`node --test`; Playwright from `demos/`):

1. Schema: valid/invalid themes; bad colour, out-of-range radius, unknown key rejected with field name.
2. Resolve: each fallback rule.
3. Converters: golden files for Nord, Aurora.css (incl. dropped-rule report), one Theme Studio theme.
4. Derivation: Dracula → expected app tokens; luminance mode detection.
5. Migration: each table row.
6. Playwright (dev app): slot switch changes `--bg`/`--syn-*` on shell, editor and preview; Follow system flips under emulated scheme; Mermaid follows; hover preview restores.

**Done when:** all tests pass, `pnpm --dir app build` is clean, and the 8 built-ins match screenshots captured before the change.
