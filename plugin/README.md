# solomd-mindmap plugin

Claude Code tools for SoloMD `.mmap` maps.

```bash
pnpm --dir app install
pnpm --dir mcp-mindmap install
claude --plugin-dir ./plugin
```

Set `SOLOMD_WORKSPACE` to your notes folder (default: the project dir). Needs Node ≥ 22.18.

`.mcp.json` references `../mcp-mindmap`, so the plugin works from this repo checkout (`--plugin-dir`), not from a copied marketplace install.
