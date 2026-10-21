---
name: mindmap
description: Use when the user mentions a mind map, a .mmap file, a node, gates, or "my map"; or asks to plan, outline or brainstorm into SoloMD; or to bind/find this session's node. Works through the solomd-mindmap MCP tools.
---

# SoloMD mind maps

Maps are `.mmap` files. Never read or write their JSON directly: always use the `mmap_*` tools.

## Start

1. `mmap_session_nodes` with your `claude-session-id` (it's in your context). If a node comes back, that's what this session is about: `mmap_outline` from it.
2. Otherwise `mmap_outline` on the file with `depth: 2`, then drill down by node id.

## Refer to nodes

- By id from an outline: `a1b2` (shown as `[^a1b2]`).
- Or by topic path from the root: `Plan/Phase 2/Tasks`.

## Choose the right operation

| Want | Tool |
| --- | --- |
| New map | `mmap_create` from an outline or markdown |
| Combine maps | `mmap_merge` into a new file, or `mmap_graft` one map under a node |
| Locate a node | `mmap_find` before pulling a full outline |
| Reparent a node | `mmap_move` |
| Text export | `mmap_export` |
| Remove a cross-link | `mmap_gate` action `unlink` with the gate node's id (not the target) |
| New children / subtree | `mmap_add` with "- Topic" lines, 2 spaces per level |
| Rename, note, tags, key/value fields | `mmap_edit` (lists replace, so read first with `mmap_node`) |
| Same idea in two places | `mmap_gate` action `link` (a gate is a cross-link, shown `⇒ Topic → [^target]`) instead of duplicating |
| Found duplicates | `mmap_duplicates` then `mmap_gate` action `merge` with `keep` and `duplicate` |
| Status / meaning (blocked, done, risk) | `mmap_mark`; if the meaning is missing, ask the user before extending `mmap_legend` |
| Tie this conversation to a node | `mmap_bind_session` with your `claude-session-id` |
| Show the user | `mmap_reveal` |

## Rules

- Prefer node ids for writes; paths pick the first matching sibling.
- If no `claude-session-id` is in your context, skip session lookup/binding and tell the user the session hook isn't active.
- Don't style nodes. Appearance changes only through legend meanings.
- Before `mmap_remove` on a node with children, say what will go and confirm.
- Keep topics short (≤ 8 words). Put detail in the note.
- After edits, tell the user the node ids you touched. SoloMD reloads an open map unless the user has unsaved changes there.
