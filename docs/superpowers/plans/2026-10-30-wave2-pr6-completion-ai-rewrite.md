# Wave 2 PR-6 — `completion`, `ai-rewrite` features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two `EditorFeature`s from the CodeMirror branch of `components/Editor.vue` — markdown autocompletion (+ slash commands + citation loading) and the AI-rewrite chord / AI lock behind a legacy shim — pinned by characterization tests, no caller yet.

**Architecture:** Each feature = `app/src/features/<f>/contracts/<f>.feature.ts` (`create<F>Feature(): EditorFeature`) + `contracts/index.ts` + `internal/` + `CLAUDE.md`. `ai-rewrite` reaches today's AI code only through `AiRewritePort` + `ai-rewrite.legacy.adapter.ts` (deleted in Wave 4, LLD E10).

**Tech Stack:** TypeScript, CodeMirror 6 (`@codemirror/autocomplete`), Vue 3 (only in `useCitations.ts`), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-30-wave2-editor-lld.md` §PR-4…PR-7, E10; ADR 0004. Contract: `app/src/features/editor/contracts/editor-feature.port.ts`.

## Global Constraints

- No behavior change. Copy code from `Editor.vue`; only replace `props`/`settings`/`t`/`view` access with `ctx`.
- Never edit `components/Editor.vue`, `lib/cm-live-blocks.ts`, `lib/live-blocks/`, `features/editor/**`, `shell/editor-registry.service.ts`. Own only the folders below.
- `.feature.ts` and pure internal files import no `vue`/`pinia`. The one Vue file is `features/completion/internal/useCitations.ts`.
- Import other features only via `contracts/index.ts`. Keep importing today's `lib/` modules from `lib/`.
- Each `.ts` ≤ 400 lines; local imports end in `.ts`; no `any`.
- Manifest test per feature: `settingsKeys` ⊆ keys of `defaults()` (`app/src/stores/settings.ts`); `i18nKeys` resolve in `app/src/i18n/en.ts` (a key ending `.*` must resolve to an object).
- Test helpers: `stateWith`, `fakeView`, `fakeContext` from `app/src/features/editor/internal/cm-probe.ts`.
- Workers never commit. `pnpm --dir app guard` green at the end (other workers' in-progress files may break guard — report, don't touch).

---

### Task 1: `completion`

**Files:** `app/src/features/completion/{contracts/completion.feature.ts, contracts/index.ts, contracts/citations.ts, internal/slash.ts, internal/useCitations.ts, *.test.ts, CLAUDE.md}`.

**Interfaces — Produces:**

```ts
// internal/slash.ts — Editor.vue 2888-2902
export function slashExt(ctx: EditorFeatureContext): Extension;

// internal/useCitations.ts — Vue; Editor.vue 181-190 (host calls it; PR-8 wires ctx.citations to it)
export function useCitations(): () => CitationEntry[];   // loads once, reloads on settings.workspaceBibliography change (same invalidate + load), returns a getter of the cached list

// contracts/citations.ts — second public entry so non-Vue importers of index.ts never pull Vue
export { useCitations } from '../internal/useCitations.ts';

// contracts/completion.feature.ts
export function createCompletionFeature(): EditorFeature {
  return {
    id: 'completion',
    settingsKeys: ['slashCommandsEnabled', 'workspaceBibliography'],
    i18nKeys: ['slashCommands.labels.*', 'slashCommands.hints.*', 'slashCommands.empty'],
    extensions: {
      'md-completion': (ctx) => ctx.tab().language !== 'markdown' ? [] : [
        wikilinkExtension(), tagAutocompleteExtension(), citationsExtension(() => ctx.citations()),
        fenceLanguageExtension(), directiveCompletionExtension(),
        autocompletion({
          override: [wikilinkComplete, tagComplete, citationCompleteSource(() => ctx.citations()), fenceLanguageComplete, directiveCompletionSource],
          defaultKeymap: true,
          activateOnTyping: false,
        }),
      ],
    },
    slots: [{
      slot: 'slash',
      when: (ctx) => ctx.tab().language === 'markdown',
      deps: (ctx) => ctx.settings.slashCommandsEnabled,
      build: (ctx) => slashExt(ctx),
    }],
  };
}
```

Keep the comments of Editor.vue 3082-3106 (#297, single `autocompletion` config, `activateOnTyping` rationale) beside the code.

- [ ] **Tests:** `md-completion` → `[]` for `ts`; for markdown, `stateWith(ext)` builds and the `autocompletion` config has `activateOnTyping === false` (read it via `state.facet(…)` if exported, otherwise assert the state builds and `completionStatus(state) === null`); `slashExt` → `[]` when `slashCommandsEnabled` is false; `labelFor` returns `undefined` when `t` echoes the key back (fake `t` returning the key) and the translated text otherwise (call it through the options: extract the options builder `slashOptions(ctx)` from `slashExt` so it is testable); `when` false for non-markdown. `useCitations`: skip unit tests (Vue + Pinia + IPC); covered in PR-8 browser check — say so in `CLAUDE.md`.

### Task 2: `ai-rewrite`

**Files:** `app/src/features/ai-rewrite/{contracts/ai-rewrite.port.ts, contracts/ai-rewrite.feature.ts, contracts/index.ts, internal/ai-rewrite.legacy.adapter.ts, internal/rewrite-key.ts, *.test.ts, CLAUDE.md}`.

```ts
// contracts/ai-rewrite.port.ts
export interface AiRewritePort {
  extension(cmKey: string): Extension;          // lib/cm-ai-rewrite aiRewriteExtension
  isLocked(filePath: string | undefined): boolean;   // lib/ai-activity isAiWorking
}

// internal/ai-rewrite.legacy.adapter.ts — Wave 2 shim, deleted in Wave 4 (LLD E10). Header comment says so.
export const legacyAiRewriteAdapter: AiRewritePort = {
  extension: (cmKey) => aiRewriteExtension(cmKey),
  isLocked: (filePath) => isAiWorking(filePath),
};

// internal/rewrite-key.ts — Editor.vue 2904-2910, 3768-3770
export const UNBOUND_CM_KEY = 'F24';
export function currentAiRewriteKey(keybindings: SettingsStore['keybindings']): string;
export function aiLockExtension(isLocked: boolean): Extension;

// contracts/ai-rewrite.feature.ts
export function createAiRewriteFeature(port: AiRewritePort = legacyAiRewriteAdapter): EditorFeature {
  return {
    id: 'ai-rewrite', settingsKeys: ['keybindings'], i18nKeys: [],
    slots: [
      { slot: 'ai-lock', deps: (ctx) => port.isLocked(ctx.tab().filePath), build: (ctx) => aiLockExtension(port.isLocked(ctx.tab().filePath)) },
      {
        slot: 'ai-key',
        when: (ctx) => !IS_APP_STORE_BUILD && ctx.tab().language === 'markdown',
        deps: (ctx) => currentAiRewriteKey(ctx.settings.keybindings),
        build: (ctx) => port.extension(currentAiRewriteKey(ctx.settings.keybindings)),
      },
    ],
  };
}
```

Keep the #180 comments (3758-3759) and the "unbound → F24" comment.

- [ ] **Tests:** `currentAiRewriteKey` with a binding (`Mod-j`-style chord from `lib/keybindings` defaults) → CM spelling; with the action unbound → `'F24'`. `aiLockExtension(true)` → `state.readOnly === true` and `state.facet(EditorView.editable) === false`; `false` → both default. Feature with a fake port: `ai-lock.deps` returns the port's value; `ai-key.build` calls `port.extension` with the computed key; `when` false for non-markdown.

### Task 3: Register (controller, after PR-4…PR-7 all land)

- [ ] Controller adds `createAiRewriteFeature`, `createCompletionFeature` to `EDITOR_FEATURE_FACTORIES` in LLD order.
