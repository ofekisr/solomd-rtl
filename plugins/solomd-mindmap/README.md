# solomd-mindmap plugin

Claude Code tools for SoloMD `.mmap` mind maps. Read and edit maps, bind sessions to nodes, manage cross-links and meanings.

## Install

Marketplace (needs Node ≥ 20 only):

```
/plugin marketplace add ofekisr/solomd-rtl
/plugin install solomd-mindmap@solomd-rtl
```

Dev install from a checkout:

```bash
pnpm --dir app install
pnpm --dir plugins/solomd-mindmap/server install
claude --plugin-dir ./plugins/solomd-mindmap
```

Running from source (`--plugin-dir`, `pnpm … test`) needs Node ≥ 22.18 for `--experimental-strip-types`.

After editing `server/src` or `app/src/lib/mindmap/`, run `pnpm --dir plugins/solomd-mindmap/server build` — `verify` fails on a stale bundle.

The workspace is the folder you start `claude` in, like opening a folder in VS Code.

## Configuration

`.mcp.json` configures the MCP server connection:

- `--workspace <dir>`: optional; pin the server to one folder instead of the current one
- `--allow-write`: enables create/edit/remove/mark/legend/bind tools (read-only if omitted)

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

### File (5)
- `mmap_create` – new map from outline or markdown
- `mmap_merge` – new map from several maps, one child per source
- `mmap_graft` – insert a whole map under a node of another
- `mmap_export` – save to outline, markdown, headings, mermaid, or adjacency
- `mmap_reveal` – open the map in SoloMD (requires app running)

## Verify Schema

All 18 tools have valid, combinator-free schemas:

```bash
pnpm --dir plugins/solomd-mindmap/server test
```

`test/schema.test.ts` fails if any tool schema has a top-level `oneOf` / `anyOf` / `allOf`.
