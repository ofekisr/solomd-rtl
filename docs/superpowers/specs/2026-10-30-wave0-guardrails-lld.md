## LLD: Wave 0 — Guardrails

**Status**: Draft | **Version**: v1.0 | **Date**: 30-10-26 | **HLD**: `2026-10-30-wave-refactor-hld.md` v3.1

Wave 0 adds rules and checks only. No runtime code changes, so no app behavior can regress.

### Baseline (measured 30-10-26)

| Fact | Value | Source |
|---|---|---|
| Unit tests | 1153 pass, 3s | `node --test "src/**/*.test.ts"` (`app/package.json` `test`) |
| Typecheck | exit 0, 8s | `vue-tsc --noEmit` (`app/package.json` `build`) |
| ESLint | none installed | `app/package.json` devDependencies |
| CI | release-only, no PR checks | `.github/workflows/` (`release.yml`, `indexnow.yml`, `linux-2404-test.yml`, `mirror-gitee.yml`) |
| Over budget | 22 `.ts` > 400, 26 `.vue` > 500, 23 `.rs` > 600 | `wc -l`, excl. tests + `i18n/` |
| Raw IPC | ~250 `invoke(` sites, 58 files import `@tauri-apps/api/core` | HLD §1 |

### Key decisions (LLD-level)

| Decision | Options | Choice | Rationale |
|---|---|---|---|
| Rule engine | ESLint + plugins / custom `node --test` arch specs | Arch specs | Zero new deps; same runner as the existing 1153 tests; therapy-os precedent (`tools/architecture/*` guard specs) |
| Existing violations | Fix now / allowlist | Ratchet baseline JSON | Wave 0 must not touch runtime code; baseline numbers may only shrink |
| Guard trigger | Agent hook after every edit / script the agent runs | Script + `CLAUDE.md` instruction | Hook adds ~11s to every edit; revisit after Wave 1 |

---

### PR graph

```yaml
prs:
  - id: pr-1
    name: "docs: conventions, ADR log, CLAUDE.md layering"
    depends_on: []
    parallel_with: [pr-2]
    location: "docs/, CLAUDE.md, app/CLAUDE.md"
    generator: null
  - id: pr-2
    name: "test(arch): ratcheted architecture specs"
    depends_on: []
    parallel_with: [pr-1]
    location: "app/arch/"
    generator: null
  - id: pr-3
    name: "chore: greenness ladder scripts + PR CI"
    depends_on: [pr-2]
    location: "app/package.json, .github/workflows/ci.yml"
    generator: null
execution_order: [pr-1, pr-2, pr-3]
```

---

### PR-1 — Conventions, ADR log, CLAUDE.md layering

**Pattern**: Layered agent docs — invariants at root, routers per area (therapy-os root/`server`/`client` `CLAUDE.md` split).

| File | Content |
|---|---|
| `docs/conventions/file-roles.md` | Role suffix table: `.port.ts` (interface + Zod), `.adapter.ts` (implements a port), `.schema.ts` (Zod only), `.service.ts` (stateful logic, no Vue), `.feature.ts` (registers into a host), `.store.ts` (Pinia), `.prompt.ts` (AI template), `.test.ts`, `.arch.test.ts`. Applies to new/moved files only. Feature folder shape `features/<f>/{contracts,internal,ui,CLAUDE.md}` |
| `docs/adr/README.md` | ADR format: number, title, status (accepted/superseded), context, decision, consequences; "Accepted ADRs are settled — don't re-derive" |
| `docs/adr/0001-wave-refactor.md` | Accepts HLD v3.0: wave order, ports-in-TS, registry DI, ratchet |
| `docs/adr/0002-arch-specs-not-eslint.md` | Records the rule-engine decision above |
| `CLAUDE.md` (root) | Add §Invariants (spec wins; ratchets only shrink; no raw `invoke` outside `platform/` once it exists; doc-sync rule: change code ⇒ update nearest `CLAUDE.md`) and §Greenness ladder (filled by PR-3). Keep the existing Layout table |
| `app/CLAUDE.md` | Router: folder map of `app/src`, where tests live, which `CLAUDE.md` to read per area |

**Tests**: none (docs). Reviewer checks reading time ≤ 5 min per file.

---

### PR-2 — Ratcheted architecture specs

**Pattern**: Architecture fitness functions with a ratchet baseline (therapy-os `tools/architecture/` guard specs; baseline file = allowlist that can only shrink).

**File tree**

```
app/arch/
├── CLAUDE.md                     # what each spec guards, how to shrink a baseline
├── scan.ts                       # file walker + import extractor (shared by specs)
├── baseline.schema.ts            # Zod schema for baseline.json
├── baseline.json                 # current violations (generated once, hand-shrunk later)
├── rebaseline.ts                 # rewrites baseline.json, refuses any increase
├── file-size.arch.test.ts
├── raw-ipc.arch.test.ts
├── lib-purity.arch.test.ts
└── feature-boundary.arch.test.ts
```

**Contracts (shapes, not code)**

```typescript
// baseline.schema.ts
Baseline = {
  version: 1,
  fileSize: Record<repoRelativePath, maxLines>,     // only files over budget today
  rawIpc: repoRelativePath[],                       // files allowed to import @tauri-apps/api/core
  libPurity: repoRelativePath[],                    // lib/ files allowed to import vue / pinia / @tauri-apps
}

// scan.ts
listSourceFiles(roots: string[], exts: string[]): string[]          // skips node_modules, target, dist, *.test.ts, i18n/
extractImports(filePath: string): string[]                          // static + dynamic import specifiers
countLines(filePath: string): number
```

**Rules**

| Spec | Scope | Fails when |
|---|---|---|
| `file-size` | `app/src` `.ts` ≤ 400, `.vue` ≤ 500; `app/src-tauri/src` `.rs` ≤ 600; `mcp-mindmap/src` `.ts` ≤ 400 | A file not in baseline exceeds budget, or a baselined file grows above its recorded max |
| `raw-ipc` | `app/src` | A file not in `rawIpc` imports `@tauri-apps/api/core` |
| `lib-purity` | `app/src/lib/**` | A file not in `libPurity` imports `vue`, `pinia` or `@tauri-apps/*` |
| `feature-boundary` | `app/src/**` | A file outside `features/<f>/` imports `features/<f>/internal/**`. Passes vacuously until Wave 1 creates `features/` |

**Failure message format** (the agent's only diagnostic, so it must be self-explaining):
`[arch:file-size] app/src/components/Editor.vue has 5031 lines; baseline 5026. Shrink it, or split before adding. See app/arch/CLAUDE.md.`

**`rebaseline.ts`**: recompute the violations; write only entries whose value went down or that disappeared; exit 1 and print the offenders if any value would go up.

**Test surface**

```yaml
tests:
  unit:
    location: "app/arch/scan.test.ts"
    coverage:
      - "extractImports: static, dynamic import(), type-only, side-effect imports"
      - "listSourceFiles: excludes node_modules, dist, target, tests, i18n"
      - "baseline.schema rejects negative line counts and absolute paths"
      - "rebaseline refuses an increase (fixture baseline + fixture file)"
  arch:
    location: "app/arch/*.arch.test.ts"
    coverage:
      - "Each spec passes against the committed baseline on a clean checkout"
    new_helpers:
      - name: "withFixtureTree"
        signature: "(files: Record<string, string>, run: (root: string) => void) => void"
        file: "app/arch/scan.test.ts (local helper)"
```

---

### PR-3 — Greenness ladder + PR CI

**Pattern**: Tiered verification ladder, exit code is the only signal (therapy-os `_shared/greenness-ladder.md`).

| Script (`app/package.json`) | Runs | Budget |
|---|---|---|
| `arch` | `node --test "arch/**/*.test.ts"` | ~1s |
| `guard` | `arch` → `test` → `vue-tsc --noEmit` | ≤ 15s (today ~12s) — after every edit |
| `verify` | `guard` → `vite build` → `cargo check --manifest-path src-tauri/Cargo.toml` → `pnpm --dir ../mcp-mindmap test` | before each commit |
| `full` | `verify` → `cargo test` → `playwright test --config e2e/playwright.config.ts` | before each wave's Integrate gate; macOS only (e2e baselines) |
| `arch:rebaseline` | `node arch/rebaseline.ts` | after shrinking a file |

**CI** `.github/workflows/ci.yml`: on `pull_request` + push to `main`, ubuntu, run `pnpm --dir app guard` then `vite build`. No cargo (Linux Tauri deps are heavy; `linux-2404-test.yml` already covers that), no e2e (macOS baselines).

Root `CLAUDE.md` §Greenness ladder gets the table above in 5 lines.

**Test surface**: `guard`, `verify` exit 0 on the branch; deliberately grow a baselined file by one line locally → `guard` exits non-zero with the arch message.

---

### Observability

N/A at runtime. Signal = script exit code + `[arch:<rule>]` prefixed messages.

### Commit seams

| Seam | Files | Why green |
|---|---|---|
| 1 (PR-1) | `docs/conventions/`, `docs/adr/`, `CLAUDE.md`, `app/CLAUDE.md` | Docs only |
| 2 (PR-2) | `scan.ts`, `baseline.schema.ts`, `scan.test.ts` | Pure helpers + their tests; no spec consumes them yet |
| 3 (PR-2) | 4 `*.arch.test.ts`, `baseline.json`, `rebaseline.ts`, `app/arch/CLAUDE.md` | Specs pass against generated baseline |
| 4 (PR-3) | `app/package.json` scripts, `ci.yml`, root `CLAUDE.md` ladder section | Ladder runs green locally; CI runs on the PR itself |

### Conventions check

**Honored**
- `node --test` runner and co-located `*.test.ts` (`app/package.json` `test`)
- Zod for schemas (`app/src/lib/theme/schema.ts` precedent)
- Commands documented in root `CLAUDE.md` §Commands
- Specs under `docs/superpowers/specs/` with date prefix

<conventions-check explicit_deviations="0" implicit_deviations="1">
- (implicit) `app/arch/` — new top-level test folder outside `app/src/`, against co-located `src/**/*.test.ts`. Rationale: arch specs scan the whole app and `src-tauri`, not one module; keeping them out of `src/` also keeps them out of `vue-tsc`'s include (`app/tsconfig.json` `include`).
</conventions-check>

### Deferred

- Agent hook that runs `guard` after edits — revisit after Wave 1 when timing is known.
- Rust-side lint (`clippy` in CI) — Wave 3 when `commands.rs` is split.

---

### LLD AI Context YAML

```yaml
lld_version: v1.0
feature: "Wave 0 — Guardrails"
hld_version: v3.1
status: draft
pr_count: 3
execution_order: [pr-1, pr-2, pr-3]
open_items: []
conventions_check:
  explicit_deviations: 0
  implicit_deviations: 1
dev_ready: false
```
