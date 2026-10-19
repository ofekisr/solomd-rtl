# solomd-mindmap plugin

Claude Code tools for SoloMD `.mmap` mind maps. Read and edit maps, bind sessions to nodes, manage cross-links and meanings.

## Install

```bash
pnpm --dir app install
pnpm --dir mcp-mindmap install
claude --plugin-dir ./plugin
```

Requires Node ≥ 22.18. The workspace is the folder you start `claude` in, like opening a folder in VS Code.

## Configuration

`.mcp.json` configures the MCP server connection:

- `--workspace <dir>`: optional; pin the server to one folder instead of the current one
- `--allow-write`: enables create/edit/remove/mark/legend/bind tools (read-only if omitted)

The plugin works from this repo checkout (`--plugin-dir`), not from a copied marketplace install, because `.mcp.json` references `../mcp-mindmap`.

## Tools

### Read (5)
- `mmap_outline` – tree view of a map, optionally from a node
- `mmap_node` – details of a single node (topic, note, tags, fields)
- `mmap_find` – search nodes by topic or fields
- `mmap_session_nodes` – nodes bound to this session ID
- `mmap_duplicates` – find duplicate topics in a map

### Write (5)
- `mmap_add` – new children or subtree
- `mmap_edit` – rename, note, tags, key/value fields
- `mmap_remove` – delete a node and its children
- `mmap_move` – relocate a node under a new parent
- `mmap_gate` – cross-links (link, unlink, merge duplicates)

### Meaning (2)
- `mmap_legend` – list or extend node meanings (e.g. "blocked", "done", "risk")
- `mmap_mark` – assign a meaning to a node

### Session (1)
- `mmap_bind_session` – tie this conversation to a node (stores session ID)

### File (3)
- `mmap_create` – new map from outline or markdown
- `mmap_export` – save to outline, markdown, headings, mermaid, or adjacency
- `mmap_reveal` – open the map in SoloMD (requires app running)

## Verify Schema

All 16 tools have valid, combinator-free schemas:

```bash
pnpm --dir mcp-mindmap test
```

`test/schema.test.ts` fails if any tool schema has a top-level `oneOf` / `anyOf` / `allOf`.
