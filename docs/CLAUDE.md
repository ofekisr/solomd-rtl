# docs — where new documents go

These paths override any skill's default output path (e.g. `docs/superpowers/specs/`).

| Writing a… | Put it in | Name |
|---|---|---|
| Design / spec / HLD / LLD | `design/` (or `design/<topic>/` once a topic has 3+ docs) | `YYYY-MM-DD-<topic>-design.md` |
| Architecture decision | `design/adr/` — follow its README | `NNNN-kebab-title.md` |
| Implementation plan | `plans/` (or `plans/<topic>/`, e.g. `plans/wave-refactor/wave4/`) | `YYYY-MM-DD-<topic>.md` |
| How-to guide | `guides/` | `<topic>.md` |
| Audit, investigation, bug report | `reports/` | `<topic>.md` or `<topic>/` |
| Manual test document | `fixtures/` | `<what-it-tests>-test.md` |

## Rules

- Add a row to `design/README.md` or `plans/README.md` when you add a file there.
- A design that stops describing the code gets its status changed in `design/README.md`, not deleted.
- `archive/` takes no new files except upstream-era material.
- After a move, run the root greenness ladder and fix every reference in the same commit (root invariant 6).
