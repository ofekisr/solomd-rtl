# Mindmap Phase 5 — Convert md→mindmap: Handoff

> **Status (12-10-26):** 5a (structural convert) is done in `4.14.13`; plan `docs/superpowers/plans/2026-10-12-mindmap-phase5a-convert.md`. Next: 5b (AI, provenance, Regenerate) as `4.14.14`. The Phase 4 carry-overs listed below are done, except the desktop (Tauri) check, which is still PENDING.

Self-contained continuation prompt for a fresh session. Read the spec first: `docs/superpowers/specs/2026-10-11-mindmap-design.md` (Phase 5 section, Guiding rule).

## Context

| Item | Value |
|---|---|
| Repo / app | `/Users/ofeki/repos/solomd-rtl`, app in `app/` |
| Branch | `feat/mindmap` (stay on it; no worktree; never push) |
| Version | `4.14.12` (Phase 5 bumps to `4.14.13`) |
| Done | Phase 1 `.mmap`, 2 XMind, 3 fences, 4 Map UI |
| Plans | `docs/superpowers/plans/2026-10-11-mindmap-phase{1-mmap,2-xmind,3-fence,4-map-ui}.md` |
| Phase 4 Status | Lists deviations and Open items; read its Open items before planning |

## Reuse list (do not rebuild)

| Asset | Contract |
|---|---|
| `metadata.source` | `{ path?, line }`, line 1-based, read by `readNodeSource` (`lib/mindmap-source.ts`). Phase 5 converters MUST stamp it on every node so Jump to Source works |
| `mapToHeadingsMarkdown` | `lib/mindmap-headings.ts`, map→headings (inverse of structural conversion) |
| Gate syntax | `- => <id>` in fences (`lib/mindmap-gate-plaintext.ts`); data in `node.metadata.gate`; merge into `metadata`, never replace (`refId` lives there) |
| `mindmap-active` registry | `lib/mindmap-active.ts`; new palette commands reach the focused map through it |
| `useMindmapExport` | `composables/useMindmapExport.ts`; Tauri-written exports, no browser downloads |
| Fence codec | `lib/mindmap-fence.ts`: `findMindmapFences`, guarded `replaceMindmapFence`; `fence-scan.ts` |
| `mindmap-format.ts` | `.mmap` envelope, `sanitizeMindmapData`, `mmapCodec` |
| Canvas | `MindmapCanvas.vue`, `MindmapFenceOverlay.vue`; `useMindmapCanvasActions`, `useMindmapJump` |
| Outline / AI | `extractOutline()`; `ai-providers.ts`, keychain keys, streaming `ai_rewrite` |

## Phase 5 scope (from spec)

| ebook-to-mindmap | SoloMD |
|---|---|
| Book | Folder of `.md` files |
| Chapter | `.md` file or heading section |
| TOC | `extractOutline()` |
| AI provider | Existing `ai-providers.ts`, keychain keys, streaming `ai_rewrite` |

- Structural conversion: headings become branches, lists become leaves; offline and instant.
- AI conversion: reuse the ebook-to-mindmap plaintext prompt (summaries `}:N`, arrows, quotes node); stream with a 500 ms partial render.
- Scope: selection, section, document, folder. Folder maps merge per-file maps under one root, prefixing ids per file and keeping arrows.
- Folder options: chapter picker, whole-word skip keywords, grouping files into one unit.
- Output: a new `.mmap` or an inserted fence. The `.mmap` stores a source hash plus model, prompt, and language; a mismatch offers Regenerate.
- Commands registered in `useCommands.ts` with i18n keys under `cmd.*`.
- Action `mindmap.convertDocument`, default Mod+Shift+M (markdown tabs only; reassign if it clashes and record it).
- Not adopted: hosted paid model, login and wallet, fiction character graphs, "open in Mind Elixir desktop", cache-manager page.

## Phase 4 carry-overs (fold into Phase 5)

- Harden `metadata.source.path`: restrict to workspace-relative paths (it comes from untrusted `.mmap`).
- Validate orphaned-gate fallback `gate.target` against `[\w-]+` (newline injection into copy-as-plaintext).
- Jump: `jumpTo` should not dispatch goto when `openPath` fails or spawns an aux window; pathless source from `MindmapView` goes to a hidden editor until converters stamp paths.
- Add tests: gate-controller (needs a `MindElixirInstance` fake), capture-phase key dispatch.
- Desktop (Tauri) check of Phases 1-4 is still PENDING; run it before or with Phase 5.
- Source-line mapping limitation: topics starting with `}` or `> ` are not mapped.

## Process

1. Brainstorm the open decisions with the user (`superpowers:brainstorming`; design-shaped, route per `~/.claude/docs/skill-routing-override.md`): AI prompt and provider UX, `.mmap` provenance fields, folder merge id scheme, regenerate flow, structural rules for mixed lists and code blocks.
2. Spike risky facts (AI streaming partial render, id prefixing with arrows and gates) before writing the plan.
3. Write the plan `docs/superpowers/plans/2026-10-<DD>-mindmap-phase5-convert.md` (`superpowers:writing-plans`) with a Status section shaped like Phase 4's.
4. Execute with `superpowers:subagent-driven-development`: per-task implement, review, fix rounds; browser check per task; final whole-branch review before the docs/bump task.
5. Last task: full test sweep, `pnpm build`, browser and desktop checks (record pending if not runnable), bump `4.14.12` → `4.14.13` in `app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/tauri.conf.json`, and the `solomd` entry of `app/src-tauri/Cargo.lock`; update spec Status row 5.

## Global Constraints

- Branch `feat/mindmap`; no worktree; never push.
- pnpm in `app/`, exact version pins, commit `app/pnpm-lock.yaml` with any dependency change.
- TypeScript: no `any`, no zod, constants for every literal value, functions ≤ ~20 lines, early returns, no comments except non-obvious "why".
- `src/lib` imports between lib files use the `.ts` extension (node test runner requirement).
- Unit tests: `cd app && node --test --experimental-strip-types src/lib/<file>.test.ts`.
- Build: `cd app && pnpm build` (runs `vue-tsc` + `vite build`) must pass at the end of every task that touches `.vue` or composables.
- Known pre-existing failures, out of scope: 12 `src/lib/*.test.ts` files with extensionless imports; one Rust assertion in `detect_language_from_extension`.
- Every map payload passes through `sanitizeMindmapData` before it is exported or rendered.
- Files are written through Tauri (`invoke('write_file' | 'write_binary_file')`), never browser downloads. Never call the package's `download*` functions.
- PNG export passes `watermarkEnabled: false`.
- Gate data lives in `node.metadata.gate`. Core stores `metadata.refId`, so always merge into `metadata`, never replace it.
- New user-facing strings go in `app/src/i18n/en.ts` (`mindmap` for map UI, `cmd.*` for commands). Other locales fall back.
- New keybinding actions: `category: 'mindmap', scope: 'mindmap'`. Palette-only actions use `defaults: []`.
- Commit trailer: `Co-Authored-By: Claude <model> 5.5 <noreply@anthropic.com>` (use the implementer's model name).
