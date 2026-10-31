# Directive Completion Manifests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load arbitrary directive-completion manifests from SoloMD's application-data directory and provide identical manifest-driven completion in CodeMirror and the native Windows textarea.

**Architecture:** A Rust module owns bounded filesystem discovery and structural validation, then returns immutable manifests and warnings to a small frontend registry during startup. Pure TypeScript functions parse completion context and generate snippets; thin adapters connect that result to CodeMirror and the existing native autocomplete popup.

**Tech Stack:** Rust, Tauri 2, serde/serde_json, Vue 3, Pinia, TypeScript 5.6, CodeMirror 6, and Node's built-in test runner.

**Spec:** `docs/design/2026-10-08-directive-completion-manifests-design.md`

## Global Constraints

- Work only in the SoloMD repository; do not modify or publish `epub-builder`.
- Load at most 64 regular `*.json` files from `<app-data>/completions/`, in ascending Unicode filename order, once per application start.
- Reject files larger than 1 MiB, manifests with more than 512 directives, directives with more than 512 values, and strings longer than 1,024 Unicode scalar values.
- Require `schemaVersion === 1`; ignore unknown top-level, grammar, and directive fields.
- Treat `type` as metadata; use `values` whenever present and order a listed `default` first.
- First filename wins for duplicate grammar-and-key definitions, with one warning for each ignored later definition.
- Accept whitespace between opening and marker tokens and after the marker.
- Allow completion in unclosed directive comments; require the closing token only for full recognition.
- Suppress directive completion inside backtick and tilde fences and during IME composition.
- Keep Phase 2 diagnostics and a live Reload button out of scope.

## Review Focus

- A symlink or directory named `*.json` must not be read as a manifest; only regular files count.
- A file that becomes unreadable between directory enumeration and read must produce a warning without suppressing other files.
- Two manifests with different grammar fields may reuse a directive key without conflict.
- Multi-character separators and regex punctuation in grammar tokens must be treated literally.
- A completion request at a caret before the closing token must not inspect or replace text after the caret incorrectly.

## Delivery and Estimate

| Task | Deliverable | Estimate |
| --- | --- | ---: |
| 1 | Rust manifest loader and commands | 3–5 hours |
| 2 | Frontend registry and startup load | 2–3 hours |
| 3 | Pure parser, completion engine, snippets, and conformance fixture | 6–9 hours |
| 4 | CodeMirror adapter | 4–6 hours |
| 5 | Native textarea adapter | 5–8 hours |
| 6 | Settings folder UI and final verification | 2–4 hours |

Tasks 1–5 deliver the completion engine.
Task 6 adds the discoverable folder-management surface and translations.

---

### Task 1: Rust Manifest Loader and Commands

**Files:**

- Create: `app/src-tauri/src/directive_completions.rs`
- Modify: `app/src-tauri/src/lib.rs`

**Interfaces:**

- Consumes: `portable::app_data_dir(app.path())` and `tauri_plugin_opener::OpenerExt`.
- Produces: `directive_completions_load(app: AppHandle) -> Result<DirectiveCompletionLoadResult, String>`.
- Produces: `directive_completions_open_folder(app: AppHandle) -> Result<String, String>`.
- Produces serialized camelCase types `LoadedDirectiveCompletionManifest`, `DirectiveCompletionWarning`, and `DirectiveCompletionLoadResult`.

- [ ] **Step 1: Write failing loader tests**

Add a `#[cfg(test)]` module that creates isolated temporary directories without a new dependency and tests these observable results:

```rust
#[test]
fn loads_valid_files_in_filename_order_and_ignores_unknown_fields() {
    let dir = fixture_dir("ordered");
    write_json(&dir, "b.json", r#"{
      "schemaVersion":1,
      "futureTopLevel":true,
      "grammar":{"opening":"<!--","marker":"b:","closing":"-->","pairSeparator":",","keyValueSeparator":"=","futureGrammar":"ok"},
      "directives":[{"key":"beta","type":"future","values":["x"],"futureDirective":9}]
    }"#);
    write_json(&dir, "a.json", VALID_EPUB_MANIFEST);

    let result = load_from_dir(&dir);

    assert_eq!(result.manifests.iter().map(|m| m.source_file.as_str()).collect::<Vec<_>>(), ["a.json", "b.json"]);
    assert!(result.warnings.is_empty());
}

#[test]
fn keeps_valid_files_when_neighbors_are_invalid_or_unreadable() {
    let dir = fixture_dir("partial");
    write_json(&dir, "good.json", VALID_EPUB_MANIFEST);
    write_json(&dir, "bad.json", "{");
    std::fs::create_dir(dir.join("not-a-file.json")).unwrap();

    let result = load_from_dir(&dir);

    assert_eq!(result.manifests.len(), 1);
    assert_eq!(result.warnings.len(), 1);
}

#[test]
fn read_failure_after_enumeration_warns_and_continues() {
    // Call the internal load_entries_with_reader helper with a reader closure
    // that returns PermissionDenied for bad.json and reads good.json normally.
    // Expect good.json plus one bad.json warning.
}

#[cfg(unix)]
#[test]
fn ignores_json_symlinks_instead_of_following_them() {
    // Symlink outside.json into the fixture directory as linked.json.
    // Expect no loaded manifest and no attempt to read the target.
}

#[test]
fn first_filename_wins_only_for_identical_grammar_and_key() {
    // a.json and b.json define the same grammar/key; c.json reuses the key
    // with another marker. Expect a.json + c.json and one b.json warning.
}
```

Also cover unsupported schema versions, missing grammar fields, empty tokens, duplicate keys within one file, 1 MiB plus one byte, 65 files, 513 directives, 513 values, and a 1,025-scalar string.
Verify that a default absent from `values` remains accepted and is not invented as a value completion.

- [ ] **Step 2: Run the focused Rust tests and verify RED**

Run from `app/src-tauri`:

```bash
cargo test directive_completions --lib
```

Expected: FAIL because `directive_completions` and `load_from_dir` do not exist.

- [ ] **Step 3: Implement bounded parsing and deterministic conflict handling**

Use serde structs without `deny_unknown_fields`, explicit validation helpers, and no new crates:

```rust
const MAX_FILES: usize = 64;
const MAX_FILE_BYTES: u64 = 1024 * 1024;
const MAX_DIRECTIVES: usize = 512;
const MAX_VALUES: usize = 512;
const MAX_STRING_SCALARS: usize = 1024;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectiveGrammar {
    pub opening: String,
    pub marker: String,
    pub closing: String,
    pub pair_separator: String,
    pub key_value_separator: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectiveDefinition {
    pub key: String,
    #[serde(rename = "type")]
    pub directive_type: String,
    #[serde(default)]
    pub values: Vec<String>,
    pub default: Option<String>,
    pub label: Option<String>,
    pub description: Option<String>,
}
```

Read sorted `DirEntry` values, check `file_type().is_file()`, inspect metadata length before `read_to_string`, and convert every per-file failure into `DirectiveCompletionWarning { source_file, reason }`.
Put the loop in a private `load_entries_with_reader` helper whose reader callback defaults to `std::fs::read_to_string`; the injected failure in the test above proves the enumeration/read race without platform-specific permission assumptions.
Keep a `HashSet<(GrammarIdentity, String)>`; insert accepted definitions in order and drop only later conflicts.
Return a manifest even when one of its directives conflicts, provided at least one directive remains.

- [ ] **Step 4: Implement both Tauri commands and register them**

Resolve `<app-data>/completions` through one helper:

```rust
fn completions_dir(app: &AppHandle) -> Result<PathBuf, String> {
    portable::app_data_dir(app.path())
        .map(|path| path.join("completions"))
        .map_err(|error| format!("resolve completions directory: {error}"))
}
```

`directive_completions_load` creates the directory and calls `load_from_dir`.
`directive_completions_open_folder` creates it, calls `app.opener().open_path(&dir, None::<&str>)`, and returns the display path.
Add the module and both commands to `lib.rs`.

- [ ] **Step 5: Run focused and full Rust tests**

Run:

```bash
cargo test directive_completions --lib
cargo test --lib
```

Expected: PASS with no warnings from the new module.

- [ ] **Step 6: Commit Task 1**

```bash
git add app/src-tauri/src/directive_completions.rs app/src-tauri/src/lib.rs
git commit -m "feat(completions): load directive manifests"
```

---

### Task 2: Frontend Registry and Startup Loading

**Files:**

- Create: `app/src/lib/directive-completion-registry.ts`
- Create: `app/src/lib/directive-completion-registry.test.ts`
- Modify: `app/src/main.ts`

**Interfaces:**

- Consumes: Tauri command `directive_completions_load` and the camelCase result from Task 1.
- Produces: exported manifest types matching the Rust payload.
- Produces: `installDirectiveCompletionLoadResult(result: DirectiveCompletionLoadResult): void`.
- Produces: `directiveCompletionManifests(): readonly LoadedDirectiveCompletionManifest[]`.
- Produces: `directiveCompletionStatus(): Readonly<DirectiveCompletionLoadResult>`.
- Produces: `loadDirectiveCompletions(): Promise<DirectiveCompletionLoadResult>`.

Define the frontend payload exactly once:

```typescript
export interface DirectiveGrammar {
  opening: string;
  marker: string;
  closing: string;
  pairSeparator: string;
  keyValueSeparator: string;
}

export interface DirectiveDefinition {
  key: string;
  type: string;
  values: readonly string[];
  default?: string;
  label?: string;
  description?: string;
}

export interface LoadedDirectiveCompletionManifest {
  sourceFile: string;
  schemaVersion: 1;
  grammar: DirectiveGrammar;
  directives: readonly DirectiveDefinition[];
}

export interface DirectiveCompletionWarning {
  sourceFile: string;
  reason: string;
}

export interface DirectiveCompletionLoadResult {
  manifests: readonly LoadedDirectiveCompletionManifest[];
  warnings: readonly DirectiveCompletionWarning[];
  directory: string;
}
```

- [ ] **Step 1: Write failing immutable-registry tests**

```typescript
test('installs manifests and warnings without exposing mutable arrays', () => {
  const manifests = [epubManifest];
  const input = loadResult(manifests, [{ sourceFile: 'bad.json', reason: 'invalid JSON' }]);
  installDirectiveCompletionLoadResult(input);

  assert.equal(directiveCompletionManifests().length, 1);
  manifests.length = 0;
  assert.equal(directiveCompletionManifests().length, 1);
  assert.equal(directiveCompletionStatus().warnings[0]?.sourceFile, 'bad.json');
});

test('empty installation clears a prior registry for browser harnesses', () => {
  installDirectiveCompletionLoadResult(loadResult([epubManifest], []));
  installDirectiveCompletionLoadResult(loadResult([], []));
  assert.deepEqual(directiveCompletionManifests(), []);
});
```

- [ ] **Step 2: Run the registry test and verify RED**

Run from `app`:

```bash
node --test --experimental-strip-types src/lib/directive-completion-registry.test.ts
```

Expected: FAIL because the registry module does not exist.

- [ ] **Step 3: Implement the typed immutable registry**

Store cloned, frozen arrays in module scope.
Use explicit interfaces; do not use `any`.
`loadDirectiveCompletions` invokes the backend only when `typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window`; browser harnesses install an empty result without logging a false startup error.

- [ ] **Step 4: Bootstrap before mounting the main window**

Refactor `main.ts` into an async `bootstrap(): Promise<void>`.
Create and install Pinia, await `loadDirectiveCompletions()` only for the main root, install the result, mount the app, then show one warning toast with the count when warnings exist.
Slideshow and quick-capture roots install an empty registry and do not invoke the loader.
Catch command failure into one synthetic warning and continue mounting.

- [ ] **Step 5: Run tests and type-check**

```bash
node --test --experimental-strip-types src/lib/directive-completion-registry.test.ts
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add app/src/lib/directive-completion-registry.ts app/src/lib/directive-completion-registry.test.ts app/src/main.ts
git commit -m "feat(completions): initialize manifest registry"
```

---

### Task 3: Pure Parser, Completion Engine, and Conformance Fixture

**Files:**

- Create: `app/src/lib/fixtures/directive-completions.conformance.json`
- Create: `app/src/lib/directive-completions.ts`
- Create: `app/src/lib/directive-completions.test.ts`

**Interfaces:**

- Consumes: `DirectiveCompletionManifest` from Task 2.
- Produces: `DirectiveCompletionOption` and `DirectiveCompletionContext`.
- Produces: `completionContextAt(text: string, caret: number, manifests: readonly LoadedDirectiveCompletionManifest[]): DirectiveCompletionContext | null`.
- Produces: `generatedDirectiveSnippets(manifest: LoadedDirectiveCompletionManifest): readonly DirectiveCompletionOption[]`.
- Produces: `applyDirectiveCompletion(text: string, context: DirectiveCompletionContext, option: DirectiveCompletionOption): { text: string; caret: number }`.

- [ ] **Step 1: Add the language-neutral conformance fixture**

Use literal offsets and expected values so neither parser computes its own oracle:

```json
{
  "manifest": {
    "schemaVersion": 1,
    "grammar": {
      "opening": "<!--",
      "marker": "epub:",
      "closing": "-->",
      "pairSeparator": ",",
      "keyValueSeparator": "="
    },
    "directives": [
      {"key":"skip","type":"boolean","values":["true","false"],"default":"false"},
      {"key":"toc","type":"boolean","values":["true","false"],"default":"true"}
    ]
  },
  "cases": [
    {"name":"unclosed key after marker","text":"<!-- epub: sk","caret":13,"kind":"key","from":11,"to":13,"labels":["skip"]},
    {"name":"whitespace before marker","text":"<!--   epub: ","caret":13,"kind":"key","from":13,"to":13,"labels":["skip","toc"]},
    {"name":"key after pair separator","text":"<!-- epub: skip=false, t","caret":24,"kind":"key","from":23,"to":24,"labels":["toc"]},
    {"name":"partial value","text":"<!--epub:toc=t","caret":14,"kind":"value","from":13,"to":14,"labels":["true","false"]},
    {"name":"inside backtick fence","text":"```md\n<!-- epub: s\n```","caret":18,"kind":null},
    {"name":"inside tilde fence","text":"~~~~\n<!-- epub: s\n~~~~","caret":17,"kind":null}
  ]
}
```

Verify each numeric offset by slicing `text.slice(from, to)` in the test before implementation; correct fixture numbers rather than weakening assertions.

- [ ] **Step 2: Write failing parser, ordering, and snippet tests**

Test every fixture row plus these independent behaviors:

```typescript
test('unknown types still use manifest values and put a listed default first', () => {
  const manifest = withDirective({ key: 'layout', type: 'future', values: ['fixed', 'flow'], default: 'flow' });
  const result = completionContextAt('<!-- epub: layout=', 18, [manifest]);
  assert.deepEqual(result?.options.map(({ label }) => label), ['flow', 'fixed']);
});

test('regex punctuation and multi-character separators are literal', () => {
  const manifest = withGrammar({ opening: '[*', marker: 'x+', closing: '*]', pairSeparator: '||', keyValueSeparator: '::' });
  const result = completionContextAt('[* x+ skip::t', 13, [manifest]);
  assert.equal(result?.kind, 'value');
});

test('snippets contain no EPUB-specific chapter scaffold', () => {
  const options = generatedDirectiveSnippets(epubManifest);
  const all = options.find(({ label }) => label === 'epub-directives');
  assert.equal(all?.insertText, '<!-- epub: skip=false,toc=true -->\n\n');
  assert.doesNotMatch(all?.insertText ?? '', /Chapter Title/);
});

test('application replaces only the reported range and uses the shared cursor offset', () => {
  const context = completionContextAt('Before\nepub-sk\nAfter', 14, [epubManifest]);
  const option = context?.options.find(({ label }) => label === 'epub-skip');
  assert.deepEqual(applyDirectiveCompletion('Before\nepub-sk\nAfter', context!, option!), {
    text: 'Before\n<!-- epub: skip=false -->\nAfter',
    caret: 32
  });
});
```

Add cases for ordinary comments, a marker after other comment text, repeated identical values, empty pairs, extra key-value separators, longer closing fences, caret before existing closing text, key exclusion, separate grammar identities, and no values.

- [ ] **Step 3: Run the parser tests and verify RED**

```bash
node --test --experimental-strip-types src/lib/directive-completions.test.ts
```

Expected: FAIL because the engine module does not exist.

- [ ] **Step 4: Implement the pure scanner and completion functions**

Use literal `startsWith`/`indexOf` operations, not dynamically built regular expressions, for manifest tokens.
Track Markdown fences line by line with opener character and length; a closer must use the same character and at least the opener length.
Parse only the caret's line after determining that its line start is outside a fence.
Treat the closing token as optional for completion and cap parsing at the caret.

Define the shared option without CodeMirror types:

```typescript
export interface DirectiveCompletionOption {
  label: string;
  detail?: string;
  info?: string;
  insertText: string;
  cursorOffset: number;
}

export interface DirectiveCompletionContext {
  from: number;
  to: number;
  kind: 'key' | 'value' | 'snippet';
  options: readonly DirectiveCompletionOption[];
}
```

Generate marker names by trimming whitespace and trailing non-letter/non-number characters.
Generate only grammar-derived directive text and a trailing blank line for the combined snippet.

- [ ] **Step 5: Run parser tests and the nearest regression suite**

```bash
node --test --experimental-strip-types src/lib/directive-completions.test.ts src/lib/fence-languages.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add app/src/lib/fixtures/directive-completions.conformance.json app/src/lib/directive-completions.ts app/src/lib/directive-completions.test.ts
git commit -m "feat(completions): parse manifest directives"
```

---

### Task 4: CodeMirror Completion Adapter

**Files:**

- Create: `app/src/lib/cm-directive-completions.ts`
- Create: `app/src/lib/cm-directive-completions.test.ts`
- Modify: `app/src/components/Editor.vue`

**Interfaces:**

- Consumes: `completionContextAt`, `applyDirectiveCompletion`, and `directiveCompletionManifests`.
- Produces: `directiveCompletionSource(context: CompletionContext): CompletionResult | null`.
- Produces: `directiveCompletionExtension(): Extension`.

- [ ] **Step 1: Write failing adapter tests**

Create real `EditorState` and `CompletionContext` instances as `fence-languages.test.ts` does.
Assert key and value replacement ranges, details/descriptions, arbitrary grammar, unclosed comments, snippet insertion and selection, fence suppression, null with an empty registry, and null when `context.view?.composing` is true.

Add a trigger-classification helper test:

```typescript
test('typing marker whitespace or a pair separator requests completion', () => {
  assert.equal(shouldStartDirectiveCompletion('<!-- epub: ', 11, [epubManifest]), true);
  assert.equal(shouldStartDirectiveCompletion('<!-- epub: skip=false,', 22, [epubManifest]), true);
  assert.equal(shouldStartDirectiveCompletion('<!-- epub: skip=', 16, [epubManifest]), true);
  assert.equal(shouldStartDirectiveCompletion('ordinary text,', 14, [epubManifest]), false);
});
```

- [ ] **Step 2: Run adapter tests and verify RED**

```bash
node --test --experimental-strip-types src/lib/cm-directive-completions.test.ts
```

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the source and targeted trigger**

Map shared options to CodeMirror completions with an explicit `apply` callback that dispatches the shared `insertText` and sets `selection.anchor = from + cursorOffset`.
Return `filter: false` because the shared engine already filters labels and values.

The update listener must return during composition, respond only to `input.type`, defer `startCompletion` with `requestAnimationFrame`, and open for marker whitespace, pair separators, key-value separators, or `<marker-name>-` snippet prefixes.
When a directive completion is already active, refresh it after each committed character for which `completionContextAt` still returns a context.
Like `fenceLanguageExtension`, claim Tab only while completion is active.

- [ ] **Step 4: Register one source and one trigger in `Editor.vue`**

Place `directiveCompletionExtension()` beside `fenceLanguageExtension()`.
Append `directiveCompletionSource` to the existing single `override` array; do not create a second `autocompletion()` extension.

- [ ] **Step 5: Run adapter tests and type-check**

```bash
node --test --experimental-strip-types src/lib/cm-directive-completions.test.ts src/lib/fence-languages.test.ts
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add app/src/lib/cm-directive-completions.ts app/src/lib/cm-directive-completions.test.ts app/src/components/Editor.vue
git commit -m "feat(editor): complete manifest directives in CodeMirror"
```

---

### Task 5: Native Textarea Completion Adapter

**Files:**

- Create: `app/src/lib/native-directive-completions.ts`
- Create: `app/src/lib/native-directive-completions.test.ts`
- Modify: `app/src/components/Editor.vue`

**Interfaces:**

- Consumes: shared completion contexts/options and the existing native `AcItem` insertion contract.
- Produces: `nativeDirectiveCompletion(text: string, caret: number, manifests: readonly LoadedDirectiveCompletionManifest[]): NativeDirectiveCompletion | null`.
- Produces: `applyNativeDirectiveCompletion(text: string, completion: NativeDirectiveCompletion, index: number): { text: string; caret: number }` for adapter parity tests.

Use this adapter-only shape:

```typescript
export interface NativeDirectiveCompletionItem {
  label: string;
  hint?: string;
  insert: string;
  cursorOffset: number;
}

export interface NativeDirectiveCompletion {
  from: number;
  to: number;
  items: readonly NativeDirectiveCompletionItem[];
  sharedContext: DirectiveCompletionContext;
}
```

- [ ] **Step 1: Write failing native parity tests**

```typescript
test('native options preserve shared labels, ranges, inserts, and cursor offsets', () => {
  const text = '<!-- epub: sk';
  const native = nativeDirectiveCompletion(text, text.length, [epubManifest]);
  const shared = completionContextAt(text, text.length, [epubManifest]);

  assert.equal(native?.from, shared?.from);
  assert.equal(native?.to, shared?.to);
  assert.deepEqual(native?.items.map(({ label, insert, cursorOffset }) => ({ label, insert, cursorOffset })),
    shared?.options.map(({ label, insertText, cursorOffset }) => ({ label, insert: insertText, cursorOffset })));
});

test('flat and live insertion use the same multiline snippet result', () => {
  const text = 'epub-dir';
  const completion = nativeDirectiveCompletion(text, text.length, [epubManifest])!;
  const index = completion.items.findIndex(({ label }) => label === 'epub-directives');
  assert.deepEqual(applyNativeDirectiveCompletion(text, completion, index),
    applyDirectiveCompletion(text, completion.sharedContext, completion.sharedContext.options[index]));
});
```

Also test empty manifests, fences, arbitrary grammar, and partial values.

- [ ] **Step 2: Run native tests and verify RED**

```bash
node --test --experimental-strip-types src/lib/native-directive-completions.test.ts
```

Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Implement the pure native adapter**

Map the shared context to the current `AcItem` fields: `label`, `hint`, `insert`, and `cursorOffset`.
Keep the shared `from` and `to`; do not infer replacement ranges again.

- [ ] **Step 4: Wire both textarea modes through the existing popup**

In `maybeOpenPlainAutocomplete`, after the IME guard and before slash/wikilink/tag/citation/fence matching, ask the native adapter for a directive completion.
When present, set `acTriggerStart` from `from`, add an `acTriggerEnd` initialized from `to`, and populate `acItems` through the existing popup state.

Extend `applyPlainAutocomplete` to replace `from..to`, not `from..caret`, for directive items only.
Keep current history recording, focus restoration, live-block re-splitting, arrows, Enter, Tab, and Escape.
Do not run the directive adapter while `plainComposing` is true or for non-Markdown tabs.

- [ ] **Step 5: Run native, parser, and type tests**

```bash
node --test --experimental-strip-types src/lib/native-directive-completions.test.ts src/lib/directive-completions.test.ts
pnpm exec vue-tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add app/src/lib/native-directive-completions.ts app/src/lib/native-directive-completions.test.ts app/src/components/Editor.vue
git commit -m "feat(editor): complete directives in native textareas"
```

---

### Task 6: Settings Folder UI and Final Verification

**Files:**

- Modify: `app/src/components/SettingsPanel.vue`
- Modify: `app/src/i18n/en.ts`
- Create: `app/src/lib/directive-completion-settings.test.ts`

**Interfaces:**

- Consumes: `directiveCompletionStatus()` and Tauri command `directive_completions_open_folder`.
- Produces: Writing settings section with loaded-file count, restart guidance, expandable warning details, and **Open Completions Folder**.

- [ ] **Step 1: Extract and test the settings status view model**

Put the pure formatter in `directive-completion-registry.ts` and test concrete states:

```typescript
test('status distinguishes clean, warning, and empty registries', () => {
  assert.deepEqual(completionSettingsStatus(loadResult([], [])), { loaded: 0, warningCount: 0 });
  assert.deepEqual(completionSettingsStatus(loadResult([epubManifest], [])), { loaded: 1, warningCount: 0 });
  assert.deepEqual(completionSettingsStatus(loadResult([epubManifest], [badWarning])), { loaded: 1, warningCount: 1 });
});
```

- [ ] **Step 2: Run the settings test and verify RED**

```bash
node --test --experimental-strip-types src/lib/directive-completion-settings.test.ts
```

Expected: FAIL because `completionSettingsStatus` does not exist.

- [ ] **Step 3: Implement the view model and Settings section**

Add English keys for heading, open-folder button, loaded count, restart hint, warning summary, and open failure.
Rely on the existing English fallback for other languages in this release.

Render under Writing:

```vue
<section data-cat="writing">
  <h3>{{ t('settings.directiveCompletions') }}</h3>
  <button type="button" class="link-button" @click="openCompletionsFolder">
    {{ t('settings.openCompletionsFolder') }}
  </button>
  <p class="setting-hint">{{ completionStatusText }}</p>
  <details v-if="completionWarnings.length">
    <summary>{{ t('settings.directiveCompletionWarnings', { count: completionWarnings.length }) }}</summary>
    <ul><li v-for="warning in completionWarnings" :key="`${warning.sourceFile}:${warning.reason}`">{{ warning.sourceFile }} — {{ warning.reason }}</li></ul>
  </details>
</section>
```

`openCompletionsFolder` invokes the backend command and shows a toast error on failure.
Do not reload the registry after opening; the hint states that restart is required.

- [ ] **Step 4: Run frontend verification**

```bash
node --test --experimental-strip-types \
  src/lib/directive-completion-registry.test.ts \
  src/lib/directive-completions.test.ts \
  src/lib/cm-directive-completions.test.ts \
  src/lib/native-directive-completions.test.ts \
  src/lib/directive-completion-settings.test.ts \
  src/lib/fence-languages.test.ts
pnpm exec vue-tsc --noEmit
pnpm build
```

Expected: all tests PASS, type-check exits 0, and Vite build exits 0.

- [ ] **Step 5: Run Rust verification**

From `app/src-tauri`:

```bash
cargo test --lib
```

Expected: PASS.

- [ ] **Step 6: Perform the manual acceptance matrix**

1. Open Settings → Writing → **Open Completions Folder**.
2. Copy `/Users/ofeki/scripts/epub-builder/completions/directives.schema.json` into that folder and restart SoloMD.
3. Verify `<!-- epub: `, `<!--epub:`, `<!--   epub: `, `, `, partial values, `epub-` snippets, backtick fences, and tilde fences in CodeMirror.
4. Select the native Windows editor and repeat key, value, snippet, Enter, Tab, Escape, and IME composition checks.
5. Add one malformed JSON file, restart, and verify the valid manifest still loads with one warning toast and one Settings warning row.

- [ ] **Step 7: Run the repository's existing frontend self-tests**

From `app`, run every existing self-test wrapper and stop on the first failure:

```bash
for test_file in src/lib/*.selftest.mjs; do node --experimental-strip-types "$test_file" || exit 1; done
```

Expected: every wrapper exits 0.

- [ ] **Step 8: Commit Task 6**

```bash
git add app/src/components/SettingsPanel.vue app/src/i18n/en.ts app/src/lib/directive-completion-registry.ts app/src/lib/directive-completion-settings.test.ts
git commit -m "feat(settings): expose directive completions folder"
```

## Completion Contract

- Every production behavior was first exercised by a failing test.
- Tasks 1–6 are committed separately.
- Frontend focused tests, full available frontend tests, `vue-tsc`, Vite build, and Rust library tests pass.
- The manual acceptance matrix passes in CodeMirror and the native textarea path.
- A final whole-branch review reports no Critical or Important findings.
