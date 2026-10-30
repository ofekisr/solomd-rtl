# app/arch/

Architecture specs. They run with `node --test` and fail with `[arch:<rule>]` messages. Decision: [ADR 0002](../../docs/adr/0002-arch-specs-not-eslint.md).

## Rules

| Rule | Guards | Fails when | Baseline key |
|---|---|---|---|
| `file-size` | `app/src` `.ts` ≤ 400, `.vue` ≤ 500; `app/src-tauri/src` `.rs` ≤ 600; `mcp-mindmap/src` `.ts` ≤ 400 | A file not in the baseline is over budget, or a baselined file grows past its recorded size | `fileSize` |
| `raw-ipc` | `app/src` (`platform/` exempt) | A file not in the baseline imports any `@tauri-apps/*` module outside `app/src/platform/` (root Invariant 3). | `rawIpc` |
| `lib-purity` | `app/src/lib` | A file not in the baseline imports `vue`, `vue/*`, `pinia` or `@tauri-apps/*` | `libPurity` |
| `feature-purity` | `app/src/features` | A file not in the baseline imports `vue`, `vue/*` or `pinia` and is not under `ui/` or `__fixtures__/`, not named `use[A-Z]*.ts` and not `*.store.ts` | `featurePurity` |
| `feature-boundary` | `app/src` | A relative import (`./`, `../`) reaches another feature's `features/<f>/internal/`. The repo has no import alias; if one is added, extend this rule. | none — no exceptions |

`raw-ipc` exempts `app/src/platform/`: the only place allowed to import `@tauri-apps/*`.

Never scanned: tests (`*.test.ts`), `i18n/`, `node_modules/`, `dist/`, `target/`. `.d.ts` files count as `.ts`.

## When a spec fails

1. Read the `[arch:…]` line. It names the file and the fix.
2. Fix the code: split the file, or move the import. Never edit `baseline.json` by hand to make it pass.
3. Baseline entries never grow. A new violation is not an option.

## Moving a baselined file

`git mv` it, then in the same commit rename its key in `baseline.json` (`fileSize`, `rawIpc`, `libPurity`, `featurePurity`) to the new path. Keep the value; never raise it. This is the only allowed hand edit.

## Shrinking the baseline

After you make a baselined file smaller or remove its violation:

```bash
pnpm --dir app arch:rebaseline
```

It lowers or drops entries and commits nothing. It exits 1 and changes nothing if any value would go up. `--init` only creates a missing `baseline.json`; it exits 1 if `baseline.json` already exists. Commit the rebaselined file in the same commit as the shrink; a shrink left unrebaselined lets the file grow back. `pnpm --dir app arch:tight` (`rebaseline.ts --check`) fails on any slack without writing; it runs in `verify` and in CI.

## Files

| File | Role |
|---|---|
| `scan.ts` | File walker, import extractor (TypeScript pre-processor; .vue files: `<script>` blocks only), line counter |
| `<rule>.rule.ts` | `collect…` measures the repo; `check…` compares to the baseline |
| `<rule>.arch.test.ts` | The spec: collect, check, assert no failures |
| `baseline.schema.ts`, `baseline-file.ts` | Baseline shape (Zod) and I/O |
| `baseline.json` | Frozen violations; shrink-only |
| `rebaseline.ts` | Shrink-only baseline update |
| `fixture-tree.ts` | `withFixtureTree` helper for rule tests |

## Run

```bash
pnpm --dir app arch         # all arch tests
pnpm --dir app arch:tight   # fail if baseline.json has slack
```

Adding a rule: write `<rule>.rule.ts` + its unit test with `withFixtureTree`, then a thin `<rule>.arch.test.ts`. If the rule needs a baseline, add its key to `baseline.schema.ts`, to `serializeBaseline` in `baseline-file.ts`, and to `measure` / `rebaseline` in `rebaseline.ts`.
