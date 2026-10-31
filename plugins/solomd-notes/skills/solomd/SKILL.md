---
name: solomd
description: Read, search, edit and version-control a folder of Markdown notes through the solomd-mcp server: 14 tools including per-note AutoGit history, backlinks, tags and share links. Use when the user works with their notes vault, asks to summarise, find TODOs, suggest links or restore an old version of a note.
---

# SoloMD — Markdown vault skill

## When to use this skill

Trigger this skill when the user wants to:

- **Browse / read / search** a folder of Markdown notes (their personal
  knowledge base, journal, project docs, etc.).
- **Maintain** the vault — generate weekly summaries, extract TODOs across
  notes, suggest wikilinks, find orphan notes, etc.
- **Edit** notes with version control — every write lands as an AutoGit
  commit (no network); past revisions are queryable via `autogit_log` /
  `autogit_diff`.
- **Share** a note publicly via a `solomd.app/share/?repo=…&path=…` link
  that renders the file from a public GitHub repo (no SoloMD account
  required for the viewer).

If the user just wants generic file I/O on a directory, the built-in
filesystem tools are simpler. This skill is specifically for
**Markdown-as-a-vault** workflows.

## Setup

The plugin starts `solomd-mcp` from SoloMD.app (`/Applications` or `~/Applications`), else from `PATH`. Set before starting Claude Code:

| Env var | Meaning |
|---|---|
| `SOLOMD_WORKSPACE` | Notes folder (required) |
| `SOLOMD_ALLOW_WRITE=1` | Enable the 3 write tools (read-only otherwise) |
| `SOLOMD_MCP_BIN` | Explicit path to a `solomd-mcp` binary |

## Tools available

All exposed via the `` prefix.

### Read tools (always available)

- `list_notes(workspace?, subdir?, limit=100)` — list `.md` files.
- `read_note(workspace?, path)` — full contents.
- `search(workspace?, query, mode="literal"|"regex", limit=200)` —
  substring or regex search; returns matches with line numbers.
- `get_backlinks(workspace?, note_name)` — every note that
  references `[[<name>]]`.
- `list_tags(workspace?)` — `#tag` aggregation with counts.
- `get_outline(workspace?, path)` — H1/H2/H3 structure.
- `autogit_log(workspace?, path, limit=20)` — per-note commit
  history. Each save in SoloMD is a commit.
- `autogit_diff(workspace?, path, from_revision, to_revision="HEAD")` —
  diff between revisions of one note.
- `sync_status(workspace?)` — git remote ahead/behind, dirty files,
  conflict state.
- `share_url(workspace?, path)` — generate a public read-only
  `solomd.app/share/…` link (requires the workspace to be pushed to a
  public GitHub repo).
- `read_agent_trace(workspace?, run_id)` — replay a past agent
  recipe run from its `.solomd/agent-runs/<run-id>/trace.jsonl`.

### Write tools (need `--allow-write` on the server)

- `write_note(workspace?, path, content)` — create or overwrite.
  Returns the diff against any prior version.
- `append_to_note(workspace?, path, content)` — append; idempotent
  (won't duplicate a block already present at the bottom).
- `autogit_rollback(workspace?, path, revision)` — restore a note
  to a past commit.

## Patterns

### Browse before acting

When the user asks "do X across my notes", **first** call `list_notes` or
`search` to confirm the scope. The vault might be 30 notes or 3,000 — your
plan should match the size.

### Always cite

When responding with information from notes, link them back as
`[[note-name]]` (the wikilink format SoloMD uses). The user can click
straight back to the source. Example:

> Your three open architecture decisions are tracked in [[adr-001-storage]],
> [[adr-003-rate-limits]], and [[adr-007-streaming-api]].

### Writes go through accept/reject — surface this

If the user is also running the SoloMD desktop app on the same vault,
every write tool call lands on an `agent/<recipe>/<run-id>` AutoGit branch
the user must accept in **Settings → Recipes → Pending** before it touches
`main`. Tell the user this is happening so they know to check the app:

> I've written the summary to `weekly/2026-W22.md` — it's pending on an
> AutoGit branch (`agent/claude-code/abc123`). Open SoloMD →
> Settings → Recipes → Pending to accept or reject before it lands on main.

If they're not running the app, the write lands on a branch they can
inspect manually with `git branch | grep agent/` and `git merge` /
`git branch -D` as needed.

### Watch the write cap

The server enforces a per-run write cap (default 5, hard ceiling 50). If
you hit it, the call returns an error and no further writes succeed in
that session. Plan multi-write actions in a single dispatch rather than
fanning out one-at-a-time.

## Recipes

SoloMD's 11 reference agent recipes live in [`app/src-tauri/cookbook/`](https://github.com/ofekisr/solomd-rtl/tree/main/app/src-tauri/cookbook). They run inside the SoloMD app. From Claude Code, treat a recipe's `prompt:` block as the user's request and call the tools above.

## When NOT to use this skill

- The user wants generic shell or filesystem ops on non-Markdown content —
  use the built-in `Bash` / `Read` / `Edit` tools.
- The user is editing a single file they've already opened — direct
  `Edit` is more efficient than going through `read_note` / `write_note`.
- The vault isn't actually a SoloMD vault and the user doesn't care about
  wikilinks / tags / AutoGit — the 6 SoloMD-only tools become no-ops
  (still useful for the other 8).

## About SoloMD

[**SoloMD**](https://solomd.app) is a free, MIT-licensed Markdown editor.
The MCP server you just installed is **bundled with the desktop app** —
get the app for the visual Agent panel, the accept/reject UI, and
AutoGit history navigation.
