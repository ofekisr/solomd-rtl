# File roles

A file's suffix says what it is allowed to do. An agent reads the name and knows the rules before opening the file.

**Applies to new and moved files only.** Do not rename a file just to add a role. Wave work renames files as it moves them.

## Roles

| Suffix | Contains | Must not contain |
|---|---|---|
| `.port.ts` | One interface + its Zod schemas for inputs and outputs | Implementations, `@tauri-apps/*`, Vue |
| `.adapter.ts` | One implementation of one port (`tauri`, `web`, `canned`) | Business rules; exports beyond the port's shape |
| `.schema.ts` | Zod schemas and inferred types only | Side effects, I/O |
| `.service.ts` | Stateful logic behind a plain TS API | `vue`, `pinia` imports |
| `.feature.ts` | Registers one feature into a host (commands, CM extensions, settings slice, i18n keys) | Logic that belongs in a service |
| `.store.ts` | One Pinia store | Direct IPC (call a port) |
| `.slice.ts` | One settings slice: Zod schema, `defaults()`, optional `normalize` ([ADR 0005](../design/adr/0005-settings-slices.md)) | IPC, Vue, actions |
| `.actions.ts` | Pinia actions for one settings area, spread into the store | IPC (call a port) |
| `.key.ts` | One `InjectionKey` and its entry type, under `features/*/contracts` | Components, logic |
| `.contract.ts` | A re-export surface kept out of the feature barrel (e.g. `.vue` pages) | Logic |
| `.prompt.ts` | One AI prompt template + its input schema | Provider calls |
| `.test.ts` | Unit tests, co-located with the file under test | — |
| `.arch.test.ts` | Architecture specs under `app/arch/` | — |
| `.rule.ts` | One architecture rule under `app/arch/`: `collect…` and `check…` | Assertions, writes |

## Naming

- Base name: kebab-case, then the role: `file-system.port.ts`, `file-system.tauri.adapter.ts`, `git-pane.store.ts`.
- Adapter names put the target before the role: `<port>.<target>.adapter.ts`.
- Tests mirror the file: `file-system.port.ts` → `file-system.port.test.ts`.
- Vue components keep PascalCase `.vue`. They take no role suffix.
- A file with no clear single role is a sign to split it.

## Feature folder

```
app/src/features/<feature>/
├── contracts/   public surface: ports, schemas, the .feature.ts entry
├── internal/    private: services, stores, adapters
├── ui/          Vue components
└── CLAUDE.md    what the feature does, its contracts, its tests
```

- Other code imports a feature only through `contracts/`.
- `internal/` is private. An arch spec enforces this from Wave 0 PR-2.
