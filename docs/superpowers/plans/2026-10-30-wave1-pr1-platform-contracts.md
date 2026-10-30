# Wave 1 PR-1 — Platform Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `app/src/platform/` — every port, its Zod catalog, a tauri and a web adapter, contract tests — with no callers yet.

**Architecture:** Command ports are derived from Zod catalogs (`{ snake_cmd: { args?, result } }`) and built by two generic adapters. Non-command Tauri APIs (events, dialog, clipboard, opener, path, window) get hand-written ports that mirror the Tauri signatures callers use today, so later migrations are import swaps. `platform/index.ts` picks the adapter with `isTauri()`.

**Tech Stack:** TypeScript 5.6, Zod 4, Vue 3 app, Tauri 2, `node --test` with type stripping.

**Spec:** `docs/superpowers/specs/2026-10-30-wave1-platform-lld.md` (§PR-1, Rulings R1–R5, R7, R10) · ADR `docs/adr/0003-platform-ports.md`

## Global Constraints

- Behavior unchanged. Adapters return the **raw** IPC result and never wrap IPC errors.
- No `any`. Explicit return types on exported functions. Constants for magic values.
- Imports between local files use the `.ts` extension (`app/CLAUDE.md` §Tests).
- Files ≤ 400 lines (`.ts`). Split a port rather than exceed it.
- File roles: `.port.ts` = interface/types + Zod only, no `@tauri-apps/*`; `.tauri.adapter.ts` / `.web.adapter.ts` = one implementation; tests `<file>.test.ts` beside the file (`docs/conventions/file-roles.md`).
- Only `app/src/platform/**` may import `@tauri-apps/*`.
- Tests must not import `node:*` from non-test files (vue-tsc has no `@types/node`).
- Workers never commit. After each task, run `pnpm --dir app guard`; vue-tsc errors in files other than yours are another worker's — ignore them, report them.
- Run one test file: `cd app && node --test src/platform/<path>.test.ts`.

---

## Layer 1 — core (1 task)

### Task 1: IPC core + raw-ipc exemption

**Files:**
- Create: `app/src/platform/ipc/command.port.ts`, `validation.service.ts`, `command.tauri.adapter.ts`, `command.web.adapter.ts`, `catalog-fixtures.ts`
- Test: `app/src/platform/ipc/command.port.test.ts`, `validation.service.test.ts`, `command.tauri.adapter.test.ts`, `command.web.adapter.test.ts`, `catalog-fixtures.test.ts`
- Modify: `app/arch/raw-ipc.rule.ts`, `app/arch/raw-ipc.rule.test.ts`

**Interfaces:**
- Produces: `CommandSpec`, `CommandCatalog`, `CommandPort<C>`, `SnakeToCamel<S>`, `InvokeFn`, `snakeToCamel()`, `PlatformUnsupportedError`; `ValidationMode`, `Validation`, `createValidation(mode, report?)`; `createTauriPort(catalog, invoke, validation)`; `createWebPort(catalog, overrides?)`; `catalogFixtureProblems(catalog, fixtures)`, `CatalogFixtures`.

- [ ] **Step 1: Write failing tests**

`app/src/platform/ipc/command.port.test.ts`
```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError, snakeToCamel } from './command.port.ts';

test('snakeToCamel converts command names', () => {
  assert.equal(snakeToCamel('read_file'), 'readFile');
  assert.equal(snakeToCamel('ai_list_models'), 'aiListModels');
  assert.equal(snakeToCamel('cjk_proofread'), 'cjkProofread');
  assert.equal(snakeToCamel('open_devtools'), 'openDevtools');
  assert.equal(snakeToCamel('list'), 'list');
});

test('PlatformUnsupportedError names the operation', () => {
  const error = new PlatformUnsupportedError('read_file');
  assert.equal(error.operation, 'read_file');
  assert.equal(error.name, 'PlatformUnsupportedError');
  assert.match(error.message, /read_file/);
  assert.ok(error instanceof Error);
});
```

`app/src/platform/ipc/validation.service.test.ts`
```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { createValidation } from './validation.service.ts';

const schema = z.object({ path: z.string() });

test('off never reports or throws', () => {
  const seen: string[] = [];
  createValidation('off', (m) => seen.push(m)).check('read_file', 'args', schema, { path: 1 });
  assert.deepEqual(seen, []);
});

test('report logs drift with command, part and path', () => {
  const seen: string[] = [];
  createValidation('report', (m) => seen.push(m)).check('read_file', 'args', schema, { path: 1 });
  assert.equal(seen.length, 1);
  assert.match(seen[0], /^\[platform:drift\] read_file args: path /);
});

test('strict throws on drift', () => {
  assert.throws(() => createValidation('strict').check('read_file', 'result', z.string(), 3), /\[platform:drift\] read_file result/);
});

test('missing schema is skipped in every mode', () => {
  createValidation('strict').check('x', 'args', undefined, { anything: true });
});

test('valid values pass silently', () => {
  const seen: string[] = [];
  createValidation('report', (m) => seen.push(m)).check('read_file', 'args', schema, { path: '/a' });
  assert.deepEqual(seen, []);
});
```

`app/src/platform/ipc/command.tauri.adapter.test.ts`
```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import type { CommandCatalog } from './command.port.ts';
import { createTauriPort } from './command.tauri.adapter.ts';
import { createValidation } from './validation.service.ts';

const catalog = {
  read_file: { args: z.object({ path: z.string() }), result: z.string() },
  list_things: { result: z.array(z.object({ name: z.string() })) },
} satisfies CommandCatalog;

type Call = { cmd: string; args: unknown; arity: number };

function fakeInvoke(result: unknown, calls: Call[]) {
  return (...params: [string, Record<string, unknown>?]): Promise<unknown> => {
    calls.push({ cmd: params[0], args: params[1], arity: params.length });
    return Promise.resolve(result);
  };
}

test('calls invoke with the snake command and args', async () => {
  const calls: Call[] = [];
  const port = createTauriPort(catalog, fakeInvoke('# hi', calls), createValidation('strict'));
  assert.equal(await port.readFile({ path: '/a.md' }), '# hi');
  assert.deepEqual(calls, [{ cmd: 'read_file', args: { path: '/a.md' }, arity: 2 }]);
});

test('no-arg commands call invoke with the command only', async () => {
  const calls: Call[] = [];
  const port = createTauriPort(catalog, fakeInvoke([], calls), createValidation('strict'));
  await port.listThings();
  assert.deepEqual(calls, [{ cmd: 'list_things', args: undefined, arity: 1 }]);
});

test('returns the raw result, not the parsed one', async () => {
  const raw = [{ name: 'a', extra: 1 }];
  const port = createTauriPort(catalog, fakeInvoke(raw, []), createValidation('strict'));
  assert.equal(await port.listThings(), raw);
});

test('passes invoke rejections through unchanged', async () => {
  const failure = 'No such file';
  const port = createTauriPort(catalog, () => Promise.reject(failure), createValidation('strict'));
  await assert.rejects(port.readFile({ path: '/x' }), (e: unknown) => e === failure);
});

test('report mode logs drift and still returns raw', async () => {
  const seen: string[] = [];
  const port = createTauriPort(catalog, fakeInvoke(42, []), createValidation('report', (m) => seen.push(m)));
  assert.equal(await port.readFile({ path: '/a' }), 42);
  assert.equal(seen.length, 1);
});

test('strict mode rejects on result drift', async () => {
  const port = createTauriPort(catalog, fakeInvoke(42, []), createValidation('strict'));
  await assert.rejects(port.readFile({ path: '/a' }), /\[platform:drift\] read_file result/);
});
```

`app/src/platform/ipc/command.web.adapter.test.ts`
```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { PlatformUnsupportedError, type CommandCatalog } from './command.port.ts';
import { createWebPort } from './command.web.adapter.ts';

const catalog = {
  read_file: { args: z.object({ path: z.string() }), result: z.string() },
  list_things: { result: z.array(z.string()) },
} satisfies CommandCatalog;

test('every command rejects PlatformUnsupportedError naming the command', async () => {
  const port = createWebPort(catalog);
  await assert.rejects(port.readFile({ path: '/a' }), (e: unknown) => e instanceof PlatformUnsupportedError && e.operation === 'read_file');
  await assert.rejects(port.listThings(), PlatformUnsupportedError);
});

test('overrides win', async () => {
  const port = createWebPort(catalog, { listThings: () => Promise.resolve(['web']) });
  assert.deepEqual(await port.listThings(), ['web']);
});
```

`app/src/platform/ipc/catalog-fixtures.test.ts`
```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import type { CommandCatalog } from './command.port.ts';
import { catalogFixtureProblems } from './catalog-fixtures.ts';

const catalog = {
  read_file: { args: z.object({ path: z.string() }), result: z.string() },
  list_things: { result: z.array(z.string()) },
} satisfies CommandCatalog;

test('clean fixtures produce no problems', () => {
  assert.deepEqual(catalogFixtureProblems(catalog, {
    read_file: { args: { path: '/a' }, result: 'x' },
    list_things: { result: ['a'] },
  }), []);
});

test('reports missing, unknown and failing fixtures', () => {
  assert.deepEqual(catalogFixtureProblems(catalog, {
    read_file: { args: { path: 1 }, result: 'x' },
    nope: { result: 1 },
  }), [
    'list_things: no fixture',
    'nope: fixture for unknown command',
    'read_file args: path Invalid input: expected string, received number',
  ]);
});
```
(If Zod 4's message text differs, keep the test's structure and copy the actual message once — the first two lines are the contract.)

- [ ] **Step 2: Run tests — expect FAIL (modules missing)**

Run: `cd app && node --test src/platform/ipc/*.test.ts`

- [ ] **Step 3: Implement**

`app/src/platform/ipc/command.port.ts`
```ts
import type { z } from 'zod';

export interface CommandSpec {
  readonly args?: z.ZodType;
  readonly result: z.ZodType;
}

export type CommandCatalog = Readonly<Record<string, CommandSpec>>;

export type SnakeToCamel<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
  : S;

type CommandMethod<S extends CommandSpec> = S extends { readonly args: infer A extends z.ZodType }
  ? (args: z.input<A>) => Promise<z.output<S['result']>>
  : () => Promise<z.output<S['result']>>;

export type CommandPort<C extends CommandCatalog> = {
  readonly [K in keyof C & string as SnakeToCamel<K>]: CommandMethod<C[K]>;
};

export type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

const SNAKE_SEGMENT = /_([a-z0-9])/g;

export function snakeToCamel(name: string): string {
  return name.replace(SNAKE_SEGMENT, (_match, letter: string) => letter.toUpperCase());
}

export class PlatformUnsupportedError extends Error {
  readonly operation: string;

  constructor(operation: string) {
    super(`[platform] ${operation} is not supported on this platform`);
    this.name = 'PlatformUnsupportedError';
    this.operation = operation;
  }
}
```

`app/src/platform/ipc/validation.service.ts`
```ts
import type { z } from 'zod';

export type ValidationMode = 'off' | 'report' | 'strict';
export type ValidationPart = 'args' | 'result';
export type DriftReporter = (message: string) => void;

export interface Validation {
  readonly mode: ValidationMode;
  check(operation: string, part: ValidationPart, schema: z.ZodType | undefined, value: unknown): void;
}

const ROOT_PATH = '(root)';

export function createValidation(mode: ValidationMode, report: DriftReporter = (message) => console.warn(message)): Validation {
  return {
    mode,
    check(operation, part, schema, value) {
      if (mode === 'off' || !schema) return;
      const parsed = schema.safeParse(value);
      if (parsed.success) return;
      const message = driftMessage(operation, part, parsed.error);
      if (mode === 'strict') throw new Error(message);
      report(message);
    },
  };
}

export function driftMessage(operation: string, part: ValidationPart, error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue && issue.path.length > 0 ? issue.path.join('.') : ROOT_PATH;
  return `[platform:drift] ${operation} ${part}: ${path} ${issue?.message ?? 'invalid'}`;
}
```

`app/src/platform/ipc/command.tauri.adapter.ts`
```ts
import { snakeToCamel, type CommandCatalog, type CommandPort, type CommandSpec, type InvokeFn } from './command.port.ts';
import type { Validation } from './validation.service.ts';

type RawMethod = (args?: Record<string, unknown>) => Promise<unknown>;

export function createTauriPort<C extends CommandCatalog>(catalog: C, invoke: InvokeFn, validation: Validation): CommandPort<C> {
  const port: Record<string, RawMethod> = {};
  for (const [command, spec] of Object.entries(catalog)) {
    port[snakeToCamel(command)] = (args) => callCommand(command, spec, args, invoke, validation);
  }
  return port as unknown as CommandPort<C>;
}

async function callCommand(
  command: string,
  spec: CommandSpec,
  args: Record<string, unknown> | undefined,
  invoke: InvokeFn,
  validation: Validation,
): Promise<unknown> {
  validation.check(command, 'args', spec.args, args);
  const raw = args === undefined ? await invoke(command) : await invoke(command, args);
  validation.check(command, 'result', spec.result, raw);
  return raw;
}
```

`app/src/platform/ipc/command.web.adapter.ts`
```ts
import { PlatformUnsupportedError, snakeToCamel, type CommandCatalog, type CommandPort } from './command.port.ts';

export function createWebPort<C extends CommandCatalog>(catalog: C, overrides: Partial<CommandPort<C>> = {}): CommandPort<C> {
  const port: Record<string, () => Promise<never>> = {};
  for (const command of Object.keys(catalog)) {
    port[snakeToCamel(command)] = () => Promise.reject(new PlatformUnsupportedError(command));
  }
  return { ...port, ...overrides } as unknown as CommandPort<C>;
}
```

`app/src/platform/ipc/catalog-fixtures.ts`
```ts
import type { CommandCatalog } from './command.port.ts';
import { driftMessage } from './validation.service.ts';

export interface CommandFixture {
  readonly args?: unknown;
  readonly result: unknown;
}

export type CatalogFixtures = Readonly<Record<string, CommandFixture>>;

export function catalogFixtureProblems(catalog: CommandCatalog, fixtures: CatalogFixtures): string[] {
  const missing = Object.keys(catalog).filter((command) => !(command in fixtures)).map((command) => `${command}: no fixture`);
  const unknown = Object.keys(fixtures).filter((command) => !(command in catalog)).map((command) => `${command}: fixture for unknown command`);
  const failing = Object.entries(fixtures).filter(([command]) => command in catalog).flatMap(([command, fixture]) => fixtureFailures(catalog, command, fixture));
  return [...missing, ...unknown, ...failing];
}

function fixtureFailures(catalog: CommandCatalog, command: string, fixture: CommandFixture): string[] {
  const spec = catalog[command];
  const failures: string[] = [];
  if (spec.args) {
    const parsed = spec.args.safeParse(fixture.args);
    if (!parsed.success) failures.push(stripPrefix(driftMessage(command, 'args', parsed.error)));
  }
  const result = spec.result.safeParse(fixture.result);
  if (!result.success) failures.push(stripPrefix(driftMessage(command, 'result', result.error)));
  return failures;
}

const DRIFT_PREFIX = '[platform:drift] ';

function stripPrefix(message: string): string {
  return message.slice(DRIFT_PREFIX.length);
}
```

`app/arch/raw-ipc.rule.ts` — add the platform exemption (R7):
```ts
const PLATFORM_DIR = 'app/src/platform/';
// in collectRawIpc, before the import check:
.filter((path) => !path.startsWith(PLATFORM_DIR))
```
`app/arch/raw-ipc.rule.test.ts` — add to the first test's fixture tree `'app/src/platform/ipc/x.tauri.adapter.ts': "import { invoke } from '@tauri-apps/api/core';"` and keep the expected result `['app/src/a.ts', 'app/src/b.vue']`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd app && node --test src/platform/ipc/*.test.ts && node --test arch/raw-ipc.rule.test.ts && pnpm --dir app guard`

- [ ] **Step 5: Hand back** (controller commits: `feat(platform): IPC core — catalog types, generic adapters, validation`)

---

## Layer 2 — ports (8 parallel tasks, disjoint directories)

### Shared recipe for command-port tasks (T2–T6)

For each domain `<d>` with catalog name `<d>Commands` (camelCase of the dir, e.g. `gitSyncCommands`):

Files: `app/src/platform/<d>/<d>.port.ts`, `<d>.tauri.adapter.ts`, `<d>.web.adapter.ts`, `<d>.port.test.ts`.

`<d>.port.ts` shape (fs example):
```ts
import { z } from 'zod';
import type { CommandCatalog, CommandPort } from '../ipc/command.port.ts';

export const fsCommands = {
  read_file: { args: z.object({ path: z.string() }), result: z.string() },
  // … one entry per command listed in the task
} satisfies CommandCatalog;

export type FsPort = CommandPort<typeof fsCommands>;
```

`<d>.tauri.adapter.ts`:
```ts
import type { InvokeFn } from '../ipc/command.port.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import type { Validation } from '../ipc/validation.service.ts';
import { fsCommands, type FsPort } from './fs.port.ts';

export function createTauriFsPort(invoke: InvokeFn, validation: Validation): FsPort {
  return createTauriPort(fsCommands, invoke, validation);
}
```

`<d>.web.adapter.ts`:
```ts
import { createWebPort } from '../ipc/command.web.adapter.ts';
import { fsCommands, type FsPort } from './fs.port.ts';

export function createWebFsPort(): FsPort {
  return createWebPort(fsCommands);
}
```

`<d>.port.test.ts`:
```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import { catalogFixtureProblems, type CatalogFixtures } from '../ipc/catalog-fixtures.ts';
import { createTauriPort } from '../ipc/command.tauri.adapter.ts';
import { createValidation } from '../ipc/validation.service.ts';
import { fsCommands } from './fs.port.ts';
import { createWebFsPort } from './fs.web.adapter.ts';

const fixtures: CatalogFixtures = {
  read_file: { args: { path: '/notes/a.md' }, result: '# A' },
  // … one realistic fixture per command, shaped like the Rust serde output
};

test('fs catalog: every command has a fixture that parses', () => {
  assert.deepEqual(catalogFixtureProblems(fsCommands, fixtures), []);
});

test('fs tauri adapter: every fixture round-trips in strict mode', async () => {
  for (const [command, fixture] of Object.entries(fixtures)) {
    const port = createTauriPort({ [command]: fsCommands[command as keyof typeof fsCommands] }, () => Promise.resolve(fixture.result), createValidation('strict'));
    const method = Object.values(port)[0] as (args?: unknown) => Promise<unknown>;
    assert.equal(await method(fixture.args), fixture.result);
  }
});

test('fs web adapter rejects PlatformUnsupportedError', async () => {
  await assert.rejects(createWebFsPort().readFile({ path: '/a' }), PlatformUnsupportedError);
});
```

**How to write each schema (the important part):**
1. Find every call site: `grep -rn "'<cmd>'" app/src --include='*.ts' --include='*.vue'`. The **args keys are exactly what callers pass today** (Tauri maps Rust `snake_case` params to `camelCase` keys). Optional args at any call site → `.optional()`.
2. Read the Rust fn: `grep -rn "fn <cmd>" app/src-tauri/src`. Result = the `Ok` type of `Result<T, String>` serialized by serde (respect `#[serde(rename_all = …)]`, `Option` → `.nullable()`, skipped fields → `.optional()`). `()` → `z.null()`. `Vec<u8>` → `z.array(z.number())`.
3. Callers that type the result (`invoke<Foo>`) must still type-check after migration: the schema's `z.output` must be assignable to `Foo`. If a TS type already exists in `stores/` or `lib/`, mirror it field for field; do not import it into the port (ports stay self-contained).
4. Objects use `z.object` (unknown keys are fine — adapters return raw data). Unsure numeric/string → follow the Rust type.
5. A port file over 400 lines → split into `<d>-<sub>.port.ts` with its own adapters and test; tell the controller.

### Task 2: `fs` port

Dir `app/src/platform/fs/`, catalog `fsCommands`, port `FsPort`, factories `createTauriFsPort` / `createWebFsPort`.
Commands (23): `copy_file delete_frontmatter_property fs_create_dir fs_create_file fs_delete fs_dir_exists fs_dirs_with_extensions fs_file_exists fs_list_dirs fs_list_extensions fs_move fs_rename list_dir read_binary_file read_file update_frontmatter_property write_binary_file write_file watch_file unwatch_file search_in_dir replace_in_dir replace_in_text`
Rust: `commands.rs`, `watcher.rs`, `search.rs`, `replace.rs`.

### Task 3: `android`, `cloud`, `convert` ports

- `app/src/platform/android/` — `androidCommands` / `AndroidPort`: `saf_create saf_list saf_persisted_trees saf_pick_folder saf_poll_picked saf_read saf_tree_name saf_tree_root saf_write android_request_all_files_access android_restart_app android_system_insets` (Rust `saf_android.rs`, `storage_android.rs`; these are `cfg(target_os = "android")` — read both cfg branches).
- `app/src/platform/cloud/` — `cloudCommands` / `CloudPort`: `cloud_folder_detect device_id_get_or_create session_list_others session_load session_save` (`cloud_folder.rs`).
- `app/src/platform/convert/` — `convertCommands` / `ConvertPort`: `convert_file_to_markdown pandoc_detect pandoc_export upload_image print_webview` (`convert.rs`, `pandoc.rs`, `image_upload.rs`, `commands.rs`).

### Task 4: `git-sync`, `git-history` ports

- `app/src/platform/git-sync/` — `gitSyncCommands` / `GitSyncPort` (29): `gitea_clear_token gitea_create_vault_repo gitea_get_url gitea_has_token gitea_list_repos gitea_set_token gitea_set_url gitea_user gitea_validate_url github_clear_token github_create_vault_repo github_enable_encryption github_has_token github_link_workspace github_list_repos github_pull github_push github_resolve_conflict github_set_config github_set_token github_sync_status github_unlink_workspace github_user proxy_get proxy_set crypto_clear_passphrase crypto_decrypt_after_pull crypto_set_passphrase crypto_status` (`github_sync.rs`, `crypto.rs`; caller `stores/githubSync.ts` uses a local `invoke` wrapper — read its call sites).
- `app/src/platform/git-history/` — `gitHistoryCommands` / `GitHistoryPort`: `git_auto_commit git_file_at_version git_file_diff git_file_history git_init_workspace git_rollback_file git_workspace_status` (`git_history.rs`).

### Task 5: `ai`, `ai-tools` ports

- `app/src/platform/ai/` — `aiCommands` / `AiPort`: `ai_cancel ai_chat ai_clear_key ai_has_key ai_list_models ai_rewrite ai_set_key ai_verify_key ollama_cancel_pull ollama_detect ollama_pull open_ollama_install_page agent_list_runs agent_trace_list agent_trace_read agent_trace_replay_from cost_meter_get cost_meter_reset cost_meter_set_enabled cjk_proofread` (`ai_proxy.rs`, `ollama.rs`, `agent_tools.rs`, `agent_trace.rs`, `cost_meter.rs`, `cjk_proofread.rs`).
- `app/src/platform/ai-tools/` — `aiToolsCommands` / `AiToolsPort`: `recipes_accept_run recipes_delete recipes_get recipes_history recipes_list recipes_pending_runs recipes_read_run_md recipes_read_trace recipes_reject_run recipes_run_diff recipes_run_now recipes_save cookbook_install cookbook_list mcp_profiles_delete mcp_profiles_export_config mcp_profiles_list mcp_profiles_save cli_status detect_ai_clients inject_mcp mcp_path remove_mcp` (`recipe_runner.rs`, `cookbook.rs`, `mcp_profiles.rs`, `integrations.rs`).

### Task 6: `rag`, `settings`, `capture`, `window-commands` ports

- `app/src/platform/rag/` — `ragCommands` / `RagPort`: `rag_index_status rag_reindex rag_reindex_file rag_search rag_set_enabled workspace_index_backlinks workspace_index_files workspace_index_init workspace_index_referenced_by workspace_index_rescan workspace_index_resolve workspace_index_tags` (`rag.rs`, `workspace_index.rs`).
- `app/src/platform/settings/` — `settingsCommands` / `SettingsPort`: `theme_install theme_json_list theme_json_remove theme_json_save theme_list_installed theme_uninstall spellcheck_check spellcheck_dicts_dir spellcheck_init spellcheck_list_dicts directive_completions_load directive_completions_open_folder save_language_preference set_as_default_markdown_editor` (`themes.rs`, `spellcheck.rs`, `directive_completions.rs`, `runner.rs`/`set_default.rs`).
- `app/src/platform/capture/` — `captureCommands` / `CapturePort`: `capture_get_state capture_regenerate_token capture_set_enabled capture_set_inbox_folder capture_set_workspace rest_get_state rest_regenerate_token rest_set_allow_write rest_set_enabled rest_set_workspace quick_capture_close quick_capture_open quick_capture_set_shortcut quick_capture_write` (`capture_endpoint.rs`, `rest_api.rs`, `quick_capture.rs`).
- `app/src/platform/window/window-commands.port.ts` (+ `window-commands.tauri.adapter.ts`, `window-commands.web.adapter.ts`, test) — `windowCommands` / `WindowCommandsPort`: `set_menu_config force_close_window drain_pending_opens set_max_button_rect open_devtools` (`runner.rs`, `devtools.rs`, `win_chrome.rs`). Only these four files in `window/`; Task 9 owns the rest of that dir.

### Shared recipe for hand-written ports (T7–T9)

The port mirrors the **Tauri signatures callers use today** so a migration only swaps the import. List exactly the functions callers use: `grep -rn "@tauri-apps/<module>" app/src` then read each call.

- `<x>.port.ts`: an interface + plain TS types (no `@tauri-apps/*` imports; copy the needed option/event types as local types).
- `<x>.tauri.adapter.ts`: `createTauri<X>Port(mod = <real module>): <X>Port`. Static `import * as m from '@tauri-apps/…'` when callers import it statically today; `load = () => import('@tauri-apps/…')` inside the method when callers import it lazily today (`plugin-deep-link`, `plugin-fs`, `api/image`, the `plugin-opener` use in `GitEmptyState.vue`).
- `<x>.web.adapter.ts`: `createWeb<X>Port(): <X>Port` — async functions reject `new PlatformUnsupportedError('<module>.<fn>')`; sync functions throw it. Exception: if today's web build gets a real value from the Tauri function without IPC (check the `@tauri-apps` source under `app/node_modules/@tauri-apps/`), return the same value.
- Test: tauri adapter forwards each function's arguments to an injected fake module and returns its value unchanged; web adapter rejects/throws `PlatformUnsupportedError` for each function.

### Task 7: `events`, `dialog`, `opener` ports

- `platform/events/` — `EventsPort { listen<T>(event: string, handler: (event: PlatformEvent<T>) => void): Promise<UnlistenFn>; }` plus `emit` if any caller uses it. `PlatformEvent<T> = { event: string; id: number; payload: T }`, `UnlistenFn = () => void` (export both types; callers import `UnlistenFn` from here instead of `@tauri-apps/api/event`).
- `platform/dialog/` — `DialogPort` with `open` and `save` (types: copy the option fields callers pass; return `Promise<string | string[] | null>` / `Promise<string | null>` exactly as plugin-dialog v2 types them).
- `platform/opener/` — `OpenerPort { openUrl(url: string): Promise<void>; openPath(path: string): Promise<void>; revealItemInDir(path: string): Promise<void> }` (match plugin-opener's optional second params if any caller passes them). `openUrlLazy` is not needed — the adapter itself loads the module lazily for every call, which covers `GitEmptyState.vue`.

### Task 8: `clipboard`, `path` ports

- `platform/clipboard/` — `ClipboardPort { readText(); writeText(text); writeHtml(html, altText?); writeImage(image); imageFromBytes(bytes) }` covering `plugin-clipboard-manager` and the `api/image` `Image.fromBytes` used with `writeImage` (`Preview.vue`, `useExport.ts`). Opaque image handle type `ClipboardImage` (port-local).
- `platform/path/` — `PathPort { sep(): string; join(...parts: string[]): Promise<string>; tempDir(); documentDir(); desktopDir(); homeDir(); readFile(path): Promise<Uint8Array>; exists(path): Promise<boolean>; writeTextFile(path, contents): Promise<void> }` — `api/path` statically, `plugin-fs` lazily. Check how `sep` is used today (function in Tauri v2) and mirror it.

### Task 9: `window` hand port

- `platform/window/window.port.ts` (+ adapters + test; Task 6 owns `window-commands.*` in the same dir — do not touch them).
- Cover every use of `api/window` (`getCurrentWindow()` → `currentWindow(): PlatformWindow` with only the methods used: e.g. `setTitle`, `close`, `label`, fullscreen/maximize/minimize/drag calls in `Toolbar.vue`, `Slideshow.vue`, `ReadingView.vue`, `useShortcuts.ts`, `App.vue`), `api/webview` (`currentWebview()` → `setZoom`, `onDragDropEvent`), `api/webviewWindow` (`createWebviewWindow(label, options)` and any static lookups used in `lib/new-window.ts`, `useCommands.ts`, `useFiles.ts`), `plugin-deep-link` (`deepLink.onOpenUrl`, `deepLink.getCurrent`, lazy), `api/app` (`getVersion`).
- `currentWindow()` / `currentWebview()` stay **synchronous** (they are today); the web adapter throws `PlatformUnsupportedError` synchronously.

---

## Layer 3 — composition + docs (1 task)

### Task 10: `platform/index.ts`, `platform/CLAUDE.md`, `app/CLAUDE.md`

**Files:** Create `app/src/platform/index.ts`, `app/src/platform/index.test.ts`, `app/src/platform/CLAUDE.md`; Modify `app/CLAUDE.md`.

`index.ts`:
```ts
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../lib/platform.ts';
import { createValidation, type ValidationMode } from './ipc/validation.service.ts';
// one import pair per port …

export type { UnlistenFn, PlatformEvent } from './events/events.port.ts';
export { PlatformUnsupportedError } from './ipc/command.port.ts';

const isDesktop = isTauri();
const validation = createValidation(resolveValidationMode());

function resolveValidationMode(): ValidationMode {
  return import.meta.env?.DEV ? 'report' : 'off';
}

export const fsPort: FsPort = isDesktop ? createTauriFsPort(invoke, validation) : createWebFsPort();
// … one export per port: fsPort androidPort cloudPort convertPort gitSyncPort gitHistoryPort aiPort aiToolsPort
//     ragPort settingsPort capturePort windowCommandsPort eventsPort dialogPort openerPort clipboardPort pathPort windowPort
```

`index.test.ts`: in Node, `isTauri()` is false → assert every exported `*Port` rejects/throws `PlatformUnsupportedError` for one representative method (e.g. `fsPort.readFile`, `eventsPort.listen`, `windowPort.currentWindow` throws).

`platform/CLAUDE.md` (≤ 60 lines): what lives here (table: dir → port → Rust module), rules (only place for `@tauri-apps/*`; adapters return raw results and never wrap errors; sync stays sync), validation modes (`report` dev / `off` prod / `strict` tests), how to add a command (catalog entry + fixture), how to add a domain (4 files + `index.ts` line), how callers import (`../platform/index.ts`), link ADR 0003 and the LLD.

`app/CLAUDE.md`: map row for `src/platform/` (“Typed ports over Tauri; only importer of `@tauri-apps/*`”), remove `src/platform/` from "Planned folders", "Which CLAUDE.md to read" row `src/platform/` → `src/platform/CLAUDE.md`.

Run: `pnpm --dir app guard` → PASS. Hand back (controller commits `feat(platform): compose ports in platform/index.ts` + docs).

---

## Closing

- [ ] `pnpm --dir app verify` exit 0
- [ ] `pnpm --dir app arch:rebaseline` (expect no change — no callers moved) and commit if changed
- [ ] Final whole-PR review (Opus)
