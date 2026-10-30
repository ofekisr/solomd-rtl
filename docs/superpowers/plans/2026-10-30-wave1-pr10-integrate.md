# Wave 1 PR-10 — Integrate gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "only `app/src/platform/` imports `@tauri-apps/*`" a failing arch rule, with `rawIpc` at 0.

**Architecture:** Widen `raw-ipc.rule.ts` from the single `@tauri-apps/api/core` specifier to any `@tauri-apps/` specifier (R7). Every non-platform importer was migrated by PR-2…PR-9, so the widened rule passes with an empty baseline.

**Tech Stack:** `app/arch/` node specs, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-30-wave1-platform-lld.md` §PR-10.

## Global Constraints

- Ratchets only shrink: `rawIpc` becomes `[]`; `libPurity`, `fileSize` may only drop.
- Rule failure message starts `[arch:raw-ipc]` and tells the reader to call a port from `app/src/platform/index.ts`.
- Never edit root `CLAUDE.md` §Invariants.

### Task 1: Widen the raw-ipc rule

**Files:** Modify `app/arch/raw-ipc.rule.ts`, `app/arch/raw-ipc.rule.test.ts`, `app/arch/CLAUDE.md`.

- [ ] **Step 1: Failing test.** In `raw-ipc.rule.test.ts`, change the first test's expectation so `'app/src/c.ts'` (imports `@tauri-apps/plugin-dialog`) **is** collected: expected `['app/src/a.ts', 'app/src/b.vue', 'app/src/c.ts']`; keep the platform/ fixture excluded. Update the message test to the new text below.
- [ ] **Step 2:** Run `cd app && node --test arch/raw-ipc.rule.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
```ts
export const RAW_IPC_PREFIX = '@tauri-apps/';
// collectRawIpc: .filter((path) => extractImports(…).some((specifier) => specifier.startsWith(RAW_IPC_PREFIX)))
function rawIpcMessage(path: string): string {
  return `[arch:raw-ipc] ${path} imports ${RAW_IPC_PREFIX}*. Only app/src/platform/ may import Tauri: call a port from app/src/platform/index.ts instead. See app/src/platform/CLAUDE.md.`;
}
```
Remove `RAW_IPC_MODULE` if nothing else uses it (`grep -rn RAW_IPC_MODULE app/arch`).
- [ ] **Step 4:** `node --test arch/raw-ipc.rule.test.ts` → PASS; `pnpm --dir app arch` → PASS (requires every migration PR merged).
- [ ] **Step 5:** `app/arch/CLAUDE.md` rule row: guards any `@tauri-apps/*` import outside `app/src/platform/`; drop the "Other `@tauri-apps/*` imports are not checked yet" sentence.

### Task 2: Close the wave (controller)

- [ ] `pnpm --dir app arch:rebaseline`; confirm `rawIpc: []`.
- [ ] `app/CLAUDE.md` map reflects `platform/`, `shell/`; LLD status → Done with an "As shipped" note.
- [ ] `pnpm --dir app full` exit 0 (macOS).
- [ ] Commit; `git push origin main`; watch the CI run to green (`gh run watch`).
