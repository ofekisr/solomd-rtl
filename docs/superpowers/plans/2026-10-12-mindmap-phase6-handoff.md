# Mindmap Phase 6 — AI md→mindmap: Handoff

Self-contained start prompt for a fresh session. Read the spec first: `docs/superpowers/specs/2026-10-11-mindmap-design.md` (Guiding rule, Phase 5, Phase 6).

## Context

| Item | Value |
|---|---|
| Repo / app | `/Users/ofeki/repos/solomd-rtl`, app in `app/` |
| Branch | `feat/mindmap` (stay on it; no worktree; never push) |
| Version | `4.15.0` (Phase 6 bumps to `4.15.1`) |
| Done | Phase 1 `.mmap`, 2 XMind, 3 fences, 4 Map UI, 5 structural convert |
| Plans | `docs/superpowers/plans/2026-10-11-mindmap-phase{1-mmap,2-xmind,3-fence,4-map-ui}.md`, `2026-10-12-mindmap-phase5-convert.md` |
| Phase 5 Status | Read its Deviations and Open items before planning |

## Phase 6 scope (from spec)

- AI conversion of a selection, section, document, or folder, reusing the ebook-to-mindmap plaintext prompt (summaries `}:N`, arrows, quotes node).
- Stream the answer with a 500 ms partial render of the map.
- Provenance in the `.mmap`: source hash, model, prompt, language. A mismatch on open offers Regenerate.
- Commands in `useCommands.ts`, i18n under `cmd.*`; strings under `mindmap`.
- Not adopted: hosted paid model, login and wallet, fiction character graphs, "open in Mind Elixir desktop", cache-manager page.

## Reuse list (do not rebuild)

| Asset | Contract |
|---|---|
| Scopes and output | `composables/useMindmapConvert.ts` (`convert(tab, scope, output, selection)`, `MINDMAP_CONVERT_EVENT`), `Editor.getLineSelection()`, flush via `solomd:flush-content-sync` before reading `tab.content` |
| Range helpers | `lib/mindmap-convert.ts`: `sectionRange`, `sliceLines`, `SELECTION_ROOT_TOPIC`; `markdownToMindmap` (structural fallback) |
| Scanner | `lib/mindmap-md-scan.ts`: `scanMarkdown`, `linesOutsideFences`, `plainInline` |
| Merge | `lib/mindmap-merge.ts`: `prefixMindmapIds`, `mergeMindmaps` (rewrites arrows, summaries, refIds, gate targets) |
| Folder | `lib/mindmap-folder.ts`, `composables/useMindmapFolderFiles.ts`, `components/MindmapConvertFolder.vue` (picker, skip keywords, epub skip, grouping, limits) |
| Fence | `lib/mindmap-fence.ts`: `buildMindmapFence`, `insertBlockAfterLine`, `safeInsertLine`, `parseMindmapFence` (plaintext grammar + gates) |
| Source / jump | `metadata.source = { path?, line }` (workspace-relative path), `lib/mindmap-source.ts` (`toWorkspaceRelative`, `isSafeSourcePath`, `isMarkdownSourcePath`), `composables/useMindmapJump.ts` |
| Format | `lib/mindmap-format.ts`: envelope `{ format, version, data }`, `sanitizeMindmapData`, `serializeMindmap`, `parseMindmap`, `mmapPathFor` |
| Commands | Actions in `lib/keybindings.ts` with `category: 'tools'` (global); `MINDMAP_CONVERT_ACTIONS` in `useCommands.ts`; routed by `useShortcuts.ts` `runById` |
| AI streaming | Tauri `ai_rewrite(request)` returns a request id before streaming; events `solomd://ai-chunk` `{request_id, chunk}`, `solomd://ai-done` `{request_id, full_text}`, `solomd://ai-error` `{request_id, error}`; pass your own `request_id` so listeners attach first; `ai_cancel(requestId)`. Request fields: `provider`, `api_format?`, `model`, `system`, `user`, `selection`, `base_url?`, `request_id?` (`src-tauri/src/ai_proxy.rs` ~160-196, 900) |
| AI settings | `stores/settings.ts`: `aiEnabled`, `aiProvider`, `aiModel` (empty → provider `defaultModel`), `aiBaseUrl`; providers in `lib/ai-providers.ts` (17; `ollama`, `openai-compat` keyless); keys in keychain via `ai_set_key` / `ai_has_key` |
| AI UI reference | `components/AIRewriteOverlay.vue` (listener setup, model fallback ~253, cancel ~271-281, cleanup on unmount ~319-340) |
| Core grammar | `mind-elixir` 5.15.1 `plaintextConverter` (`plaintextToMindElixir`, `mindElixirToPlaintext`) |

## Open decisions (brainstorm first)

1. Prompt source: fetch ebook-to-mindmap's prompt, check its license, decide vendor vs rewrite; language handling (answer in the source language, Hebrew RTL).
2. Provider UX: use the settings provider and model only, or a per-run picker; behavior when AI is disabled or no key (offer structural fallback?).
3. Chunking: per-file requests for folders (then `mergeMindmaps`), size cap per request, token or cost guard, concurrency.
4. Partial render: parse truncated plaintext every 500 ms (drop the last incomplete line), render into a new tab or a preview overlay; cancel mid-stream.
5. Provenance: where it lives (envelope field vs `data` metadata); must survive `parseMindmap` validation and `sanitizeMindmapData`; hash algorithm (`crypto.subtle` SHA-256 is unused so far) and what is hashed (raw source vs normalized).
6. Regenerate: when to check (on open, on focus), how to locate the source (`metadata.source.path` / a provenance path), what Regenerate replaces (whole map vs keep manual edits).
7. Source stamping for AI nodes: AI output has no line numbers; map topics back to headings (scanner) or stamp file-level path only.
8. Outputs: fence output for AI maps (fence grammar drops notes and provenance); `.mmap` only?
9. Notes display: Phase 5 stores paragraph notes the canvas does not show; decide whether Phase 6 adds a note UI or leaves it.

## Risks to spike before the plan

- Partial plaintext parsing: does `plaintextToMindElixir` throw or misplace nodes on a truncated last line or an unclosed arrow/summary block?
- AI output safety: model text reaches the map; it must pass `sanitizeMindmapData`, and gate/ref syntax (`=> x`, `[^x]`) from the model must not create gates or refIds unless intended.
- Event listener lifecycle across tab switches and cancel (no leaked listeners, no writes to a closed tab).
- Envelope change: older builds must still open a `.mmap` with provenance (unknown field tolerated?).

## Carry-overs from Phase 5 (decide per item)

- Desktop (Tauri) check of Phases 1-5 is still PENDING; run it before or with Phase 6 (checklist in the Phase 5 Status).
- Folder dialog: `pendingLargeCount` not reset on folder change; `convertDone` toast wording for `.mmap` output.
- Pre-existing: Cmd+Shift+K also runs CodeMirror `deleteLine` (separate task; not mindmap).

## Process

1. Brainstorm the open decisions (`superpowers:brainstorming`; route per `~/.claude/docs/skill-routing-override.md`).
2. Spike the risks above before writing the plan.
3. Write `docs/superpowers/plans/2026-10-<DD>-mindmap-phase6-ai-convert.md` (`superpowers:writing-plans`) with a Status section shaped like Phase 5's.
4. Execute with `superpowers:subagent-driven-development`: per-task implement, review, fix rounds; browser check per task; final whole-branch review before the docs/bump task.
5. Last task: full test sweep, `pnpm build`, browser and desktop checks (record pending if not runnable), bump `4.15.0` → `4.15.1` in `app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/tauri.conf.json`, and the `solomd` entry of `app/src-tauri/Cargo.lock`; update spec Status row 6.

## Global Constraints

- Branch `feat/mindmap`; no worktree; never push.
- pnpm in `app/`, exact version pins, commit `app/pnpm-lock.yaml` with any dependency change.
- TypeScript: no `any`, no zod, constants for every literal value, functions ≤ ~20 lines, early returns, no comments except non-obvious "why".
- node `--experimental-strip-types` forbids TS parameter properties and enums.
- `src/lib` imports between lib files use the `.ts` extension.
- Unit tests: `cd app && node --test --experimental-strip-types src/lib/<file>.test.ts`; sweep: `src/lib/mindmap-*.test.ts src/lib/fence-scan.test.ts src/lib/fence-languages.test.ts src/lib/keybindings.test.ts` (196 at `4.15.0`).
- Build: `cd app && pnpm build` must pass at the end of every task that touches `.vue` or composables.
- Known pre-existing failures, out of scope: 12 `src/lib/*.test.ts` files with extensionless imports; one Rust assertion in `detect_language_from_extension`.
- Every map payload passes through `sanitizeMindmapData` before it is exported or rendered.
- Files are written through Tauri (`invoke('write_file' | 'write_binary_file')`), never browser downloads.
- Gate data lives in `node.metadata.gate`; always merge into `metadata`, never replace it (core stores `metadata.refId`).
- Styles use the app theme variables (`--bg-elev`, `--border`, `--text`, `--text-faint`, `--sh-pop`, `--r-lg`, `--z-modal`); `--bg-primary` does not exist.
- New user-facing strings in `app/src/i18n/en.ts` (`mindmap` for map UI, `cmd.*` for commands). Other locales fall back.
- Commit trailer: `Co-Authored-By: Claude <model> 5.5 <noreply@anthropic.com>` (use the implementer's model name).
