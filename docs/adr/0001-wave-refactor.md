# 0001. Restructure solomd-rtl in waves

**Status**: accepted · **Date**: 2026-10-30

## Context

- The app grew feature-first. God files: `Editor.vue` 5026 lines, `FileTree.vue` 2943, `ai_proxy.rs` 2933, `SettingsPanel.vue` 2614, `App.vue` 2511, `stores/settings.ts` 1793.
- About 250 raw `invoke()` calls sit in 58 files.
- Large files and untyped IPC make every agent edit riskier.
- Full design: [HLD v3.0](../superpowers/specs/2026-10-30-wave-refactor-hld.md).

## Decision

1. Restructure in five waves, each shipped as a release:
   0 Guardrails → 1 Platform → 2 Editor → 3 Settings & shell → 4 AI.
2. Each wave runs two tracks: **Define** (contracts) and **Decompose** (split god files). They meet at an **Integrate** gate.
3. Target layout: `app/src/{platform,ai,features/<f>,shell,lib}`.
4. Platform access goes through TS ports with Zod schemas and two adapters: `tauri` (desktop) and `web`. No mobile adapters.
5. Wiring uses a feature registry plus Vue `provide/inject`. No DI container.
6. The fork is independent of upstream SoloMD. Files move into `features/` freely.
7. File size uses a ratchet: today's oversize files are recorded and may only shrink. Budgets: `.ts` ≤ 400 lines, `.vue` ≤ 500, `.rs` ≤ 600 by the end of Wave 4.
8. AI is last, because AI features are not in use yet. `ai-rewrite` stays behind a thin shim from Wave 2 to Wave 4.

## Consequences

- Easier: small files an agent can hold whole; typed IPC; one place to swap providers.
- Harder: two waves of shim code for AI; many file moves in review diffs.
- Must: keep the test count from dropping; keep each PR diff ≤ ~500 lines excluding moves.
