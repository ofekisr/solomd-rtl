# Directive Completion Manifests Design

## Status

Approved in conversation on 08-10-26.

## Purpose

SoloMD will load editor completion definitions from JSON files installed in the platform application-data directory.
The model follows shell completion directories: users add or remove definition files manually, and SoloMD discovers them on its next start.
SoloMD does not depend on `epub-builder` and does not encode EPUB directive names or values.

## Goals

- Load every valid `*.json` manifest from `<app-data>/completions/` once during application startup.
- Offer a Settings action that creates and opens the completions directory in the platform file manager.
- Drive directive parsing, key completion, value completion, and generated snippets entirely from each manifest.
- Give CodeMirror and the native Windows textarea identical completion behavior and cursor placement.
- Continue loading valid manifests when another manifest is invalid.
- Report invalid files and duplicate definitions in one startup warning.

## Non-goals

- SoloMD will not watch the directory for changes.
- SoloMD will not provide an import, download, update, enable, or disable interface.
- SoloMD will not interpret directive semantics.
- This version will not add document diagnostics or a Problems panel.
- This version will not modify or publish another repository.

## Manifest contract

Each file contains one manifest with this shape:

```typescript
interface DirectiveCompletionManifest {
  schemaVersion: 1;
  grammar: {
    opening: string;
    marker: string;
    closing: string;
    pairSeparator: string;
    keyValueSeparator: string;
  };
  directives: Array<{
    key: string;
    type: string;
    values?: string[];
    default?: string;
    label?: string;
    description?: string;
  }>;
}
```

The loader requires `schemaVersion === 1`, non-empty grammar strings, a directives array, unique non-empty keys within a manifest, and string values for every declared field.
The loader accepts unknown `type` values because SoloMD treats `type` as descriptive metadata.
Value completion uses `values` whenever present, regardless of `type`, and places `default` first when it occurs in `values`.

Files are processed by filename in ascending Unicode order.
The first definition wins when two files contain the same grammar and directive key; the loader ignores the later definition and emits a warning.
A grammar identity consists of all five grammar strings, so different syntaxes may reuse the same directive key.

## Backend loader

A focused Rust module owns filesystem access and validation.
It resolves the directory through SoloMD's portable-aware `portable::app_data_dir` helper, appends `completions`, and creates the directory when needed.

The frontend receives one serializable startup result:

```typescript
interface DirectiveCompletionLoadResult {
  manifests: LoadedDirectiveCompletionManifest[];
  warnings: DirectiveCompletionWarning[];
  directory: string;
}
```

Each loaded manifest includes its source filename for deterministic conflict messages.
Warnings include the filename and a concise reason but never abort startup.
Unreadable directories produce an empty registry and one warning.

A second Tauri command creates the directory and opens it with the operating system's file manager.
This command reuses the same path resolver as the loader, including portable builds.

## Frontend registry

A small Pinia-independent module stores the immutable startup registry.
Application startup calls the Rust loader before editors become interactive, then installs the returned manifests.
Tests and browser harnesses can install fixture manifests without Tauri.

The registry exposes manifest lookup and aggregated status only.
Parsing and completion remain pure functions that receive manifests explicitly, which prevents filesystem or global-state coupling in unit tests.

## Shared parser and completion engine

The pure TypeScript engine scans complete logical lines and tracks backtick and tilde fences.
It recognizes a directive only when optional indentation is followed by the manifest's complete opening and marker sequence, and the line closes with the manifest's closing token.
Ordinary comments, markers after other comment text, and directive-looking text inside fenced code blocks do not match.

For a caret inside a recognized directive line, the engine returns a shared result:

```typescript
interface DirectiveCompletionContext {
  from: number;
  to: number;
  kind: 'key' | 'value' | 'snippet';
  options: DirectiveCompletionOption[];
}
```

Key options exclude keys already present on the current line.
Value options come from the selected directive's `values`, with its default first.
Malformed pairs suppress value insertion instead of guessing.

The engine generates two snippet families from each manifest:

- `<marker-name>-<key>` inserts one directive with its default value when available.
- `<marker-name>-directives` inserts every directive that has a default, followed by a blank line and `# Chapter Title`.

`marker-name` removes surrounding whitespace and trailing punctuation from the marker.
Typing `<marker-name>-` as the only non-whitespace text on a line opens snippet completion and replaces that token when the user accepts an option.
The completion option carries an explicit cursor offset, so both editor engines place the caret identically after insertion.

## Editor integration

CodeMirror receives one new completion source in its existing `autocompletion({ override })` array and one targeted trigger extension beside the fence-language trigger.
The trigger runs only after committed text changes, never during IME composition.

The native textarea dispatcher asks the same pure engine for a context before falling back to its existing completion kinds.
It converts shared options into the existing popup item shape and keeps the current arrow, Enter, Tab, Escape, history, and insertion paths.
Both flat and live-block textarea modes use the same adapter.

## Settings experience

The Writing section adds an **Open Completions Folder** button and a status line.
The status reports the number of loaded files and explains that changes take effect after restart.
When startup produces warnings, SoloMD shows one warning toast after mounting and the Settings status renders an expandable filename-and-reason list.

Opening the folder creates it first.
Failure to create or open the directory produces a visible error and leaves the editor usable.

## Security and resilience

Manifest files are data, not executable extensions.
The loader reads at most 64 regular `*.json` files, rejects files larger than 1 MiB before parsing, accepts at most 512 directives and 512 values per directive, and limits every manifest string to 1,024 Unicode scalar values.
The frontend renders labels and descriptions as text.
One malformed file cannot disable other manifests or normal editor completion.

## Testing

Rust tests cover portable-aware path construction, sorted discovery, valid loading, unsupported schema versions, malformed JSON, invalid field types, size limits, duplicate handling, and partial success.

TypeScript tests use synthetic manifests and cover arbitrary grammar tokens, key exclusion, manifest-derived values, default ordering, unknown types, multiple grammars, fence suppression, replacement ranges, generated snippets, and cursor offsets.

CodeMirror adapter tests cover trigger boundaries and IME suppression.
Native adapter tests prove that shared contexts produce the existing popup item shape and the same inserted text and cursor offset as CodeMirror.

The final verification runs the complete frontend test suite, `vue-tsc --noEmit`, the Vite build, and focused Rust tests.
Manual verification opens the completions folder, installs the EPUB sample manifest, restarts SoloMD, and exercises key, value, and snippet completion in CodeMirror and the native textarea path.

## Delivery sequence

1. Add the Rust loader, open-folder command, and backend tests.
2. Add the typed frontend registry and startup warning flow.
3. Build the pure parser, completion engine, snippets, and tests with fixture manifests.
4. Integrate CodeMirror and its adapter tests.
5. Integrate both native textarea modes and their adapter tests.
6. Add the Settings action, status, translations, and end-to-end verification.
