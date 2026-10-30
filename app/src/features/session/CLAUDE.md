# features/session/

Crash-recovery session snapshots for the CodeMirror engine. Code copied from `Editor.vue` (Wave 2 PR-5).

| Path | Holds |
|---|---|
| `contracts/session.feature.ts` | `createSessionFeature()`: `session` extension, clean-save watch (clears snapshot when content equals saved), restore on mount/tab switch |
| `contracts/index.ts` | Public surface: factory |
| `internal/restore-session.ts` | `maybeRestoreSession(ctx, view)`: inserts the snapshot only into an empty tab and empty doc |

- Storage is `localStorage` via `lib/cm-session-restore.ts`; tests install an in-memory stub before importing.
