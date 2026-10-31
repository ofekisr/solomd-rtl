# docs

Everything written about solomd-rtl that is not code. Each folder holds one kind of document.

| Folder | Holds | Current? |
|---|---|---|
| [`design/`](design/README.md) | Designs: the wave-refactor HLD and LLDs, feature specs, and [`adr/`](design/adr/README.md) (settled decisions) | Yes — the spec wins over code |
| [`conventions/`](conventions/file-roles.md) | Rules every new file follows (file roles) | Yes |
| [`guides/`](guides/) | How-to references: [writing agent recipes](guides/agents.md), [GitHub stats on a static page](guides/github-stats-pattern.md) | Yes |
| [`plans/`](plans/README.md) | Step-by-step implementation plans, one per PR or phase | No — history, not kept up to date |
| [`reports/`](reports/) | Findings at a point in time: [tree-folding audit](reports/tree-folding-audit.md), [WebView2 IME bug report](reports/webview2-ime/REPORT.md) | Dated snapshot |
| [`fixtures/`](fixtures/) | Markdown files you open in the app to test rendering by hand | Yes |
| [`archive/`](archive/README.md) | Upstream SoloMD plans and marketing (Chinese, pre-fork) | No — do not follow |

`solomd-rtl.mmap` is the repo mind map. It is untracked on purpose.

## Start here

- **How is the code structured, and why?** → [wave-refactor HLD](design/wave-refactor/2026-10-30-wave-refactor-hld.md), then the [ADRs](design/adr/README.md).
- **How does feature X work?** → its row in [design/README.md](design/README.md).
- **Where do I put a new doc?** → [CLAUDE.md](CLAUDE.md).
