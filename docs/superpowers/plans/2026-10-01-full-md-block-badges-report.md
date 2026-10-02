# `.full.md` block badge implementation report

Plan: `docs/superpowers/plans/2026-10-01-full-md-block-badges.md`

## Changes

Added `markdown-block-badges.ts`, nine tests, and the self-test loader. Extended `renderMarkdown` with explicit `blockNumbers`; preserved default rendering and final sanitizer. Updated `Preview.vue` with reactive filename matching, logical CSS pseudo badges, and copy-time wrapper removal before existing table styling. Preserved pre-existing Editor/cm-bidi changes. No dependencies, settings, Explorer filter, commits, worktrees, merge or push.

## Red/green evidence

Before production edits, the test against existing `renderMarkdown(source, { blockNumbers: true })` failed with `ERR_ASSERTION`: actual `[]`, expected `[1, 2, 3]`. An earlier runner creation used the wrong working directory and failed; corrected it, then observed the actual assertion. Module-not-found output was not treated as red evidence. Core implementation passed 7/7, expanded fixtures passed 9/9. UI/copy DOM behavior has no executed browser assertion yet; this red/green evidence covers renderer behavior.

## Commands

Run from `app/` under Node v22.22.0 unless stated otherwise.

| Command | Result |
|---|---|
| `node --experimental-strip-types src/lib/markdown-block-badges.selftest.mjs` before implementation | 0/1; missing-badge assertion |
| Same command after implementation, final run | 9/9 pass |
| `node --experimental-strip-types src/lib/markdown-tables.selftest.mjs` | 23/23 pass |
| `node --experimental-strip-types src/lib/code-block-fidelity.selftest.mjs` | 10/10 pass |
| `npx vue-tsc --noEmit` | exit 0 |
| `git diff --check` (repository root) | exit 0 |

Some shell startups printed `pyenv: cannot rehash: /Users/ofeki/.pyenv/shims isn't writable`; tests and typecheck succeeded. No remaining failures in these checks.

## Rulings

- Keep shared checkout, omit commits and skill workspaces: explicit parent instruction; no isolated commit rollback history.
- Omit `display: flow-root`: it prevents existing paragraph margin collapse and doubles sibling spacing; browser layout verification remains needed.
- Reserve 4.5rem logical start gutter after skin/narrow rules: wider badge space wins over skin padding; very large numbers still need visual verification.
- Parent performs final review; no additional agents: explicit dispatch instruction; review results are separate unless parent appends them.

## Verification and limits

Tests cover basename/case matching; H1/divider exclusion; H2–H6; multi-line paragraphs; whole table/list/quote/callout; fenced/indented code including internal blanks; math/source HTML; frontmatter/TOC/footnote exclusion; document restart; source lines; alternating default/numbered render; automatic renumbering from new source; retained diagram/task/math markup. Removing only generated wrappers reproduces identical ordinary output for a mixed fixture.

Read-only inspection confirms HTML (`html-export.ts:197`), PDF (`pdf-export.ts:361`), image (`image-export.ts:137`), and clipboard HTML export (`useExport.ts:525`) rerender source without badge options. DOCX uses its separate token export path. Actual exports were not run. No source/store/save mutation was introduced; save output itself was not exercised.

Outstanding browser/macOS matrix: split/reading mode, rename/document switching, real clipboard HTML/plain text inside/across blocks and tables, browser-DOM sanitizer, RTL/narrow viewport/200% zoom/multi-digit appearance, diagrams/tasks/math interaction, scroll synchronization and outline following.

Status at initial handoff: code and automated renderer/regression/type verification complete; parent review and UI smoke checks remained.

## Parent Verification

Parent review found that numbered wrappers and the preview article inherited LTR despite Hebrew inner blocks.
The implementer added failing RTL assertions and corrected numbered article/wrapper direction while keeping outer and nested fenced code LTR.
Final parent reruns pass: badge tests 11/11, tables 23/23, code fidelity 10/10, and frontend type checking.

A temporary local Vite fixture mounted the actual `Preview.vue` component in three simultaneous views: `.full.md`, ordinary `.md`, and Hebrew `.full.md` reading mode.
All 11 browser assertions passed: complete-block counts, ordinary Markdown with no badges, RTL article direction, LTR code within RTL, CSS badge rendering, copy-event handling, HTML copy without decoration metadata, plain-text copy without generated numbers, selection wholly inside a block, and rename transitions in both directions.
The copy assertions exercised the production handler using synthetic browser ClipboardEvents and DataTransfer objects, not the native macOS pasteboard.
Screenshot inspection confirmed left-side badges in LTR and right-side badges in Hebrew reading mode, with content unobscured at the fixture viewport.
The temporary fixture was removed after verification.

The feature is implemented and verified in source.
The desktop application has not been rebuilt or installed, and actual native clipboard, file-save/export operations, zoom extremes, and full desktop scroll synchronization have not been exercised.
No commit, merge, or push was performed.

## Parent review RTL fix

Parent found missing direction on the wrappers/article. Observed a new Hebrew wrapper assertion fail (9/10 passing), then added document direction to numbered wrappers and only numbered Preview articles. A second assertion exposed missing LTR direction on nested fences (10/11 passing). Added per-render `env.solomdBlockNumbers` and explicit fence `pre dir=ltr` only when numbering is enabled, covering outer and nested fences without singleton rule changes. Ordinary renders retain their existing behavior. Final badges: 11/11 passing; table regressions: 23/23; code fidelity: 10/10; `npx vue-tsc --noEmit`: exit 0; `git diff --check`: exit 0. Visual RTL placement remains for parent browser verification.
