# features/vim/

Vim mode and `:w` `:wq` `:x` `:q` Ex commands (#222). Copied from `Editor.vue`.

| Item | Value |
|---|---|
| Slot `vim` | reconfigurable; `vim()` when `settings.vimMode` |
| `setup` | `registerVimExOnce()` (guarded by `globalThis.__solomdVimEx`) |
| Settings | `vimMode` |

## Files

- `contracts/vim.feature.ts` — `createVimFeature()`
- `internal/vim-ex.ts` — `registerVimEx(host)` (injectable), `registerVimExOnce()`, `VIM_SAVE_TIMEOUT_MS`

Ex commands route through the `solomd:menu-action` window event; `:wq` waits for `solomd:saved`, else drops its listener after the timeout.

## Tests

`internal/vim-ex.test.ts` (fake host), `contracts/vim.feature.test.ts` (manifest, slot).
