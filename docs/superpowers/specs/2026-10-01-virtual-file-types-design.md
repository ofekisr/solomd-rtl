# Virtual File Types and Block Badges

Status: proposed design for user review; product code has not changed.

Delivery direction: retain this broader design for a second virtual-type use case.
The immediate `.full.md` badge work is described in [the smaller plan](../plans/2026-10-01-full-md-block-badges.md).

## Outcome

Import a reusable virtual file-type definition once, use it to filter a workspace, and apply its presentation automatically to matching documents.
The first use case is `.full.md`: show a numbered badge beside each content block without inserting numbers into the file.
Ordinary Markdown retains its existing presentation.

## Requirements and Proposed Defaults

The user requested imported virtual types, filtering by those types, suffix-based presentation, and block-number badges for `.full.md`.
The user excludes H1 headings, blank lines, and dividers from numbering.
A table, consecutive list items in one list, a quote, and a code block each count as one block.

The proposed first release uses declarative JSON definitions and existing Markdown rendering with built-in decorations.
Imported executable renderers and new binary-format converters are outside this release.
Definitions apply across local workspaces and persist through restarts.
Badges appear in split preview and reading mode; source editing, live editor decorations, copying, and exports retain their existing output.
The source document is never modified by classification or numbering.

## Counting Contract

Number eligible, source-backed, top-level parsed Markdown blocks from 1 in document order.
The counter continues across H1 headings and dividers and resets when rendering another document.

| Source construct | Numbering |
|---|---|
| H1, using either supported heading syntax | Excluded; does not reset the counter |
| H2–H6 | One block each, because the exclusion names only H1 |
| Blank lines and thematic breaks | Excluded |
| Paragraph, including soft breaks or hard breaks inside it | One block |
| Table, regardless of rows or cells | One block |
| Ordered, unordered, or task list | One block per parsed list |
| Blockquote or callout | One block per parsed outer quote |
| Fenced or indented code, including diagram fences | One block for the whole code block, including all consecutive indented code lines |
| Display math or a source-backed HTML block | One block per parsed outer block |
| Image inside a paragraph | Part of that paragraph's block |
| Frontmatter and generated navigation or footnote sections | Excluded |

Proposed nesting default: children of a numbered list or quote remain inside that block and receive no separate badges.
A nested list therefore belongs to its outer list, and a quote containing several paragraphs remains one quote block.
Paragraphs between two lists separate them into two list blocks.
Blank lines between items do not split a list when the Markdown parser still recognizes one list.
This follows parsed document structure rather than treating each physical line as a block.

## Imported Definition

Import a single `.solomd-type.json` file through Settings → Virtual File Types.
The filename is a picker convention; validation checks the contents.

```json
{
  "schemaVersion": 1,
  "id": "full-chapter",
  "label": "Full chapter",
  "match": { "suffixes": [".full.md"] },
  "baseType": "markdown",
  "presentation": {
    "renderer": "markdown",
    "decorations": {
      "blockNumbers": {
        "enabled": true,
        "excludeHeadings": [1],
        "excludeDividers": true,
        "nested": "parent",
        "start": 1,
        "badge": "pill"
      }
    }
  }
}
```

The schema owns allowed values and rejects unsupported versions, renderer names, option keys, malformed suffixes, and duplicate suffix ownership.
Use stable IDs independent of display labels.
First-release definitions specialize Markdown filenames ending in `.md`, `.markdown`, `.mdown`, or `.mkd`.
They inherit Markdown editing and encoding behavior.
Appearance uses built-in badge styles rather than importing executable code or unrestricted CSS.
Existing custom themes may style the documented badge class within the virtual-type preview selector.

Import displays the definition's label, suffixes, and presentation before saving.
Replacing an existing ID requires an explicit Replace action; a failed import preserves existing definitions.
Settings lists each definition with enable, disable, replace, export, and remove actions.
Imported settings are copied into persistent app storage rather than reread from the original import path.
Multi-window changes use the application's existing synchronization mechanism.

## Classification and Filtering

Introduce a dedicated virtual-file-type registry, separate from the existing frontmatter-based note Types feature.
Resolve against the filename only, using case-insensitive suffix matching.
Longest matching suffix wins; equal suffix ownership is rejected during import or replacement.
Each document has one resolved virtual type, plus its underlying physical extension.
Disabling or removing a definition immediately restores default Markdown presentation.

Keep existing extension filters and add virtual-type choices identified by stable IDs.
Selecting `.md` includes all `.md` documents, including `.full.md`.
Selecting Full chapter includes only documents whose resolved virtual type is `full-chapter`.
Multiple selections use OR semantics.
All files clears both extension and virtual-type filters.
The persistent banner names all active selections and offers Clear.
Removing or disabling a type also clears its filter selection so a stale setting cannot hide the workspace.

The loaded tree, type counts, and matching-folder scan must use equivalent classification rules.
Preserve lazy directory loading and filename-only scanning; do not read document contents to classify files.
Extend the existing Rust scan with an explicit snapshot of enabled type rules and filter selections.
Type changes, workspace changes, renames, file additions, deletions, and external refreshes invalidate affected counts and matching-folder results.
Ignore stale asynchronous scan responses after their rule snapshot or workspace becomes obsolete.
The first release targets local filesystem workspaces, where the existing extension-filter UI is available.

## Rendering Architecture

The existing opening routes remain responsible for text loading, image viewing, and conversion.
Virtual classification selects presentation after a Markdown document has been loaded.

```text
filename + enabled definitions
            ↓
      virtual type resolver
            ↓
    ┌───────┴────────┐
    ↓                ↓
Explorer filter   Preview profile
                     ↓
        existing Markdown parse
                     ↓
          annotate eligible blocks
                     ↓
       render and sanitize HTML
                     ↓
          display numbered badges
```

Pass the presentation explicitly per render; do not install or mutate a global active profile.
Two previews with different virtual types must render independently.
Use parser token structure to identify whole lists, quotes, tables, and atomic blocks.
Preserve source-line mappings and existing plugins.
Decorations pass through the current final HTML sanitizer.
Badge placement must preserve valid table and list markup, selection, links, task controls, math editing, diagram processing, and synchronized scrolling.
Use logical CSS positioning for Hebrew/Arabic RTL as well as LTR.
Badges fit in the preview gutter without covering content at narrow widths or zoom.

Copying preview content omits badge text.
Screen readers receive concise block labels without inserting numbers into prose.
Exports continue calling the renderer without the preview decoration profile, producing no badges.
The definition changes presentation only: numbering never marks a tab dirty or triggers a save.

## Component Boundaries

| Component | Responsibility |
|---|---|
| New virtual-file-type schema and resolver modules | Validate imports and classify filenames through pure, typed functions |
| New registry store and settings component | Persist and manage imported definitions; publish reactive changes |
| `FileTree.vue`, settings, and Rust scanning commands | Combine extension and virtual-type selections, counts, and matching folders |
| New Markdown block-decoration module | Assign numbers to complete source-backed blocks |
| `markdown.ts` and `Preview.vue` | Apply the selected per-render profile and display badges |

Keep the naming separate from `types-registry.ts` and `stores/types.ts`, which describe frontmatter note membership.
Do not restructure unrelated opening or conversion routes.

## Verification and Delivery Outline

1. Definition schema, deterministic resolver, and shared cross-language fixture cases.
2. Persistent registry, import/export management, and preview-independent type resolution.
3. Explorer choices, counts, matching-folder scan, stale-response protection, and filter persistence migration.
4. Token-based block numbering, scoped badge presentation, and copy omission.
5. Integration checks for two simultaneous profiles, reading mode, RTL, renames, restart, unchanged source, and exports without badges.

Test the counting table with explicit expected numbers and include loose lists, nested lists, quotes containing code, and tables containing inline formatting.
Test that `.full.md` matches its virtual type while other `.md` files keep default presentation.
Test suffix overlaps, mixed-case filenames, malformed imports, replacement, disabling, and removal.
Use the repository's existing Node test/self-test patterns and Rust test conventions, followed by the frontend type check and targeted desktop smoke checks.
The detailed implementation plan follows review of this design.

## Appendix — Optional (+2 Minutes)

### Existing Integration Points

- `app/src/composables/useFiles.ts`: image, conversion, and native text opening paths.
- `app/src/components/FileTree.vue`: existing extension choices, counts, and lazy-tree filtering.
- `app/src-tauri/src/commands.rs`: `fs_list_extensions` and `fs_dirs_with_extensions` backend walks.
- `app/src/components/Preview.vue`: file-path input, rendered HTML, preview copy handler, and reading skin.
- `app/src/lib/markdown.ts`: Markdown plugins, token source maps, and final HTML sanitization.

### Alternatives Considered

Manifest plus CSS alone can distinguish typography but cannot reliably number complete parsed blocks.
Declarative manifests plus built-in decorations cover the requested block badges and keep the classification reusable.
Imported JavaScript renderers support more arbitrary behavior but require a separate runtime and lifecycle design, so this release uses the declarative approach.
