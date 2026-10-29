# Tree Folding Audit

Read-only audit of every hierarchical UI surface in solomd-rtl, mapped to the Tree Folding Lab case catalog (55 cases). Date: 2026-10-29. Static code evidence only; the app and tests were not run.

**Path conventions**

- Paths without a prefix are relative to `app/src/`.
- `ME:` = `app/node_modules/mind-elixir/dist/MindElixir.js` (mind-elixir 5.15.1, bundled source).
- `CML:` = `app/node_modules/@codemirror/language/dist/index.js` (@codemirror/language 6.12.3).
- "(inferred)" = deduced from code paths, not traced end to end.

## 1. Header metrics

| Metric | Value |
|---|---|
| Surfaces | 9 (7 recursive trees, 2 flat two-level group lists) |
| Cases ✅ on at least one surface | **33 / 55** |
| Cases ✅ or 🟡 on at least one surface | 44 / 55 |
| Cases with no surface above 🔌 | 11 (F-MODEL-03, F-ACTION-04, F-SCOPE-02, F-SCOPE-06, F-SCOPE-08, F-INNER-03, F-STATE-03, F-LIFE-05, F-SEL-02, F-SEL-04, F-SEL-05) |

| Surface | ✅ | 🟡 | 🔌 | ❌ | ➖ |
|---|---|---|---|---|---|
| S1 Mind map canvas | 23 | 13 | 6 | 12 | 1 |
| S2 Editor heading fold | 19 | 7 | 7 | 12 | 10 |
| S3 Preview heading fold | 9 | 2 | 17 | 12 | 15 |
| S4 Outline panel | 10 | 2 | 17 | 12 | 14 |
| S5 File explorer | 13 | 9 | 11 | 13 | 9 |
| S6 Mind map folder tree | 10 | 3 | 13 | 19 | 10 |
| S7 Git branch tree | 11 | 2 | 17 | 13 | 12 |
| S8 Neighborhood groups | 7 | 2 | 5 | 7 | 34 |
| S9 Types panel sections | 5 | 2 | 7 | 8 | 33 |

## 2. Table A: surface inventory

| Surface | Name | Route / screen | Component | Tree data source | Library | Depth |
|---|---|---|---|---|---|---|
| S1 | Mind map canvas | `.mmap` tab, and ` ```mindmap ` fences in markdown | `components/MindmapCanvas.vue` (+ `MindmapView.vue`) | `.mmap` JSON `nodeData` via `lib/mindmap-format.ts:85-89,219-248` | mind-elixir 5.15.1 | Unbounded |
| S2 | Editor heading fold | Markdown editor (CodeMirror; Windows plain block editor) | `components/Editor.vue`, `lib/cm-heading-fold.ts`, `lib/heading-fold.ts` | ATX headings scanned from text, `lib/heading-fold.ts:72-130` | @codemirror/language `codeFolding` | H1–H6 (6) |
| S3 | Preview heading fold | Markdown preview pane | `components/Preview.vue:480-493`, `lib/preview-heading-fold.ts` | Rendered `<h1>`–`<h6>` siblings in the preview DOM | none | H1–H6 (6) |
| S4 | Outline panel | Sidebar "Outline" pane (left or right, `App.vue:1929,2004`) | `components/Outline.vue` | `extractOutline(tab.content)` (`lib/markdown.ts:1165-1184`), tree via `buildTree` `Outline.vue:90-103` | none | H1–H6 (6) |
| S5 | File explorer | Left sidebar file tree | `components/FileTree.vue` | Lazy `list_dir` per folder, `FileTree.vue:363-415` | none | Unbounded (lazy) |
| S6 | Mind map folder tree | "Folder → map" dialog (`mindmap.folderTree`, `lib/keybindings.ts:185`) | `components/MindmapFolderTree.vue`, `lib/mindmap-folder-tree.ts` | Lazy `readDir` per level, `composables/useFolderTreeScan.ts:22-30` | none | Unbounded (lazy) |
| S7 | Git branch tree | Git pane, branch sidebar | `components/git/GitBranchTree.vue`, `GitBranchNode.vue`, `lib/git-pane/branchTree.ts` | Git snapshot branches/tags split on `/`, `branchTree.ts:12-40` | none | Unbounded (eager) |
| S8 | Neighborhood groups | Sidebar "Neighborhood" pane | `components/NeighborhoodGroupSection.vue` | Relationship groups, `NeighborhoodPanel.vue:98-105` | none | 2 (group → rows) |
| S9 | Types panel sections | Sidebar "Types" pane | `components/TypesPanel.vue` | `types.sections`, `TypesPanel.vue:45` | none | 2 (type → members) |

Excluded (disclosure, not hierarchy): commit rows in `HistoryPanel.vue:104-111` (single-open), agent tool cards (`stores/agentPanel.ts:121-126`), `TraceView.vue:47`, recipe run rows (`RecipesSettings.vue:159-201`), `ViewsPanel.vue:29` panel collapse, native `<details>` (preview passthrough `lib/markdown.ts:728`, `SettingsPanel.vue:1268,2234`, `BasesView.vue:467-490`). Grouped but never collapsible: `GlobalSearch.vue:178-184,354-357`, `TasksPanel.vue:53-62`. Flat: Tags, Backlinks, Relationships, Settings nav, `DsDropdown`/`DsPopover` (no nested menus). No tree, outline or fold library in `app/package.json` besides mind-elixir and CodeMirror. No backend or DB stores fold state; `mcp-mindmap/` ignores `expanded`.

## 3. Table B: coverage matrix

Legend: ✅ supported · 🟡 partial · 🔌 supportable · ❌ absent · ➖ N/A.

| Case | Title | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 |
|---|---|---|---|---|---|---|---|---|---|---|
| **Model** | |  |  |  |  |  |  |  |  |  |
| F-MODEL-01 | Collapsed vs visible | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ |
| F-MODEL-02 | Leaf has no fold state | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ➖ | ➖ |
| F-MODEL-03 | Tri-state subtree aggregate | 🔌 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ➖ | ➖ |
| **Action** | |  |  |  |  |  |  |  |  |  |
| F-ACTION-01 | Collapse | ✅ | ✅ | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 |
| F-ACTION-02 | Expand | ✅ | ✅ | 🔌 | 🔌 | ✅ | 🔌 | 🔌 | 🔌 | 🔌 |
| F-ACTION-03 | Toggle (single node) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| F-ACTION-04 | Recursive toggle: per-node invert | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ➖ | ➖ |
| F-ACTION-05 | Recursive toggle: anchor-driven | ✅ | ❌ | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | ➖ | ➖ |
| F-ACTION-06 | Recursive toggle: aggregate-driven | 🟡 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | ➖ | ➖ |
| **Scope** | |  |  |  |  |  |  |  |  |  |
| F-SCOPE-01 | Self | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| F-SCOPE-02 | Children | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | ➖ | ➖ |
| F-SCOPE-03 | Full subtree | ✅ | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | ➖ | ➖ |
| F-SCOPE-04 | Subtree to depth N | 🟡 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | ➖ | ➖ |
| F-SCOPE-05 | Ancestors (reveal) | ✅ | ✅ | 🔌 | 🔌 | ✅ | 🔌 | 🔌 | ➖ | ➖ |
| F-SCOPE-06 | Siblings (accordion) | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 |
| F-SCOPE-07 | Global level k | 🟡 | ✅ | 🔌 | 🔌 | ❌ | ❌ | 🔌 | ➖ | ➖ |
| F-SCOPE-08 | Complement (focus) | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | ➖ | ➖ |
| **Inner** | |  |  |  |  |  |  |  |  |  |
| F-INNER-01 | Preserve | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ➖ | ➖ |
| F-INNER-02 | Overwrite | ✅ | 🟡 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | ➖ | ➖ |
| F-INNER-03 | Restore snapshot | 🔌 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ➖ | ➖ |
| F-INNER-04 | Expand-all guard | ❌ | ➖ | ➖ | ➖ | 🟡 | 🟡 | ➖ | ➖ | ➖ |
| **State** | |  |  |  |  |  |  |  |  |  |
| F-STATE-01 | Stateless / derived | 🟡 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| F-STATE-02 | Full explicit state | ✅ | ❌ | ❌ | ❌ | 🟡 | ❌ | ❌ | ✅ | ❌ |
| F-STATE-03 | Policy + overrides | 🔌 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| F-STATE-04 | Store the minority | ❌ | ✅ | ✅ | ✅ | 🟡 | ✅ | ✅ | ❌ | 🟡 |
| F-STATE-05 | State in the model | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| F-STATE-06 | View-state map / multi-view | ❌ | 🟡 | 🟡 | ✅ | 🟡 | ✅ | ✅ | 🟡 | ✅ |
| F-STATE-07 | Sidecar persistence | 🟡 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 |
| F-STATE-08 | Ephemeral | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Identity** | |  |  |  |  |  |  |  |  |  |
| F-IDENT-01 | Key by path | ❌ | ❌ | ❌ | 🟡 | ✅ | ✅ | ✅ | ❌ | ❌ |
| F-IDENT-02 | Key by content hash | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 |
| F-IDENT-03 | Key by generated id | ✅ | 🟡 | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 | ❌ |
| F-IDENT-04 | Fuzzy re-match | ❌ | 🟡 | ❌ | 🔌 | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Lifecycle** | |  |  |  |  |  |  |  |  |  |
| F-LIFE-01 | Delete: garbage collect | ✅ | ✅ | 🔌 | 🟡 | ✅ | ➖ | 🔌 | ✅ | 🔌 |
| F-LIFE-02 | Move | ✅ | 🟡 | 🟡 | ❌ | ✅ | ➖ | ✅ | ➖ | ➖ |
| F-LIFE-03 | Insert under collapsed parent | ✅ | ➖ | ➖ | ➖ | ✅ | ➖ | 🟡 | ➖ | ➖ |
| F-LIFE-04 | Undo and folding | 🟡 | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| F-LIFE-05 | Snapshot stack | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ➖ | ➖ |
| **Selection** | |  |  |  |  |  |  |  |  |  |
| F-SEL-01 | Antichain normalization | 🟡 | ➖ | ➖ | ➖ | ➖ | ❌ | ➖ | ➖ | ➖ |
| F-SEL-02 | Mixed toggle: anchor | ❌ | ➖ | ➖ | ➖ | ➖ | ❌ | ➖ | ➖ | ➖ |
| F-SEL-03 | Mixed toggle: any expanded collapses all | ✅ | ➖ | ➖ | ➖ | ➖ | ❌ | ➖ | ➖ | ➖ |
| F-SEL-04 | Mixed toggle: majority | ❌ | ➖ | ➖ | ➖ | ➖ | ❌ | ➖ | ➖ | ➖ |
| F-SEL-05 | Mixed toggle: per-node invert | ❌ | ➖ | ➖ | ➖ | ➖ | ❌ | ➖ | ➖ | ➖ |
| F-SEL-06 | Empty selection fallback | 🟡 | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| F-SEL-07 | Leaf selected | 🟡 | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| F-SEL-08 | Focus becomes hidden | 🟡 | 🟡 | ➖ | ✅ | ❌ | 🟡 | ❌ | ➖ | ➖ |
| F-SEL-09 | Navigate to hidden node | ✅ | ✅ | 🔌 | 🔌 | ✅ | ➖ | 🔌 | ➖ | ➖ |
| **Algebra** | |  |  |  |  |  |  |  |  |  |
| F-ALG-01 | Idempotent collapse | ✅ | ✅ | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 | 🔌 |
| F-ALG-02 | Toggle involution | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| F-ALG-03 | Order independence | ✅ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ |
| **Adjacent** | |  |  |  |  |  |  |  |  |  |
| F-ADJ-01 | Filter vs fold | 🟡 | 🟡 | ➖ | ➖ | 🟡 | ➖ | 🟡 | ➖ | ➖ |
| F-ADJ-02 | Partial collapse | ❌ | ❌ | ❌ | ❌ | 🟡 | ❌ | ❌ | ➖ | ❌ |
| F-ADJ-03 | Collapsed summary | ✅ | ✅ | 🔌 | 🔌 | ❌ | ❌ | 🔌 | ✅ | 🔌 |
| F-ADJ-04 | Async expand | ➖ | ➖ | ➖ | ➖ | 🟡 | 🟡 | ➖ | ➖ | ➖ |
| F-ADJ-05 | Rendering concerns | 🟡 | ✅ | ➖ | ➖ | 🟡 | ➖ | ➖ | ➖ | ➖ |

## 4. Table C: evidence per surface

### S1 Mind map canvas

| Case ID | Status | Variant implemented | Evidence (file:line) | Observed behavior | Gap / opportunity | Effort |
|---|---|---|---|---|---|---|
| F-MODEL-01 | ✅ | | `ME:383`, `ME:785-787` | Toggle flips one `expanded` flag; children are not rendered under a collapsed node | | |
| F-MODEL-02 | ✅ | | `lib/mindmap-collapse.ts:13-15,33` | Leaves are filtered out of fold steps; expander exists only for nodes with children (inferred) | | |
| F-MODEL-03 | 🔌 | | `lib/mindmap-collapse.ts:42-44` | `hasOpenBranch` checks depth-1 only | Full subtree tri-state + indeterminate expander | S |
| F-ACTION-01 | ✅ | | `ME:787`, `ME:915-917` | `expandNode(el, false)` sets flag; ⌘K 0 collapses all | | |
| F-ACTION-02 | ✅ | | `ME:787`, `ME:918-920` | `expandNode(el, true)`; ⌘K = expands all | | |
| F-ACTION-03 | ✅ | | `ME:1134`, `ME:787` | Click on expander toggles one node | | |
| F-ACTION-04 | ❌ | 05 instead | | | | |
| F-ACTION-05 | ✅ | 05 | `ME:1134`, `ME:805-807`, `ME:77-88` | ⌘/Ctrl-click expander: `z(n, !n.expanded)` makes the whole subtree uniform from the anchor | No discoverable command; mouse only | S |
| F-ACTION-06 | 🟡 | 06 (whole map only) | `components/MindmapCanvas.vue:529-534`, `lib/mindmap-collapse.ts:42-51` | Space with no selection: any open depth-1 branch → collapse all, else expand all | Aggregate ignores depth ≥2; not available per subtree | S |
| F-SCOPE-01 | ✅ | | `ME:785-787` | Single toggle changes one flag | | |
| F-SCOPE-02 | 🔌 | | `ME:77-88` | `z(node, v, 1)` would collapse grandchildren, not leave them | Children-only setter | S |
| F-SCOPE-03 | ✅ | | `ME:805-807` | `expandNodeAll` | | |
| F-SCOPE-04 | 🟡 | | `ME:921-923`, `ME:77-88` | ⌘K 1–9 from root only; nodes deeper than N are forced collapsed, not left untouched | Per-subtree depth N; leave deeper flags alone | S |
| F-SCOPE-05 | ✅ | permanent | `lib/mindmap-find.ts:57-75`, `lib/mindmap-gate-controller.ts:83-90`, `components/MindmapView.vue:304-305` | Find, gate jumps and folder-search hits expand collapsed ancestors | | |
| F-SCOPE-06 | 🔌 | | `lib/mindmap-collapse.ts:1-6` | Parent and children links exist | Accordion mode per map | S |
| F-SCOPE-07 | 🟡 | expand-to-level | `ME:921-923` | ⌘K k expands depth < k, collapses the rest | No "collapse only level k" | S |
| F-SCOPE-08 | 🔌 | | `lib/mindmap-focus.ts` (`pathTo`), `lib/mindmap-collapse.ts:46-51` | Focus mode hoists a subtree instead of folding (see §9) | Fold-to-selection command | S |
| F-INNER-01 | ✅ | 01 (single toggle) | `ME:787` | Descendant flags untouched by single toggle | | |
| F-INNER-02 | ✅ | 02 (recursive) | `ME:77-88` | Recursive collapse writes `false` to every descendant | | |
| F-INNER-03 | 🔌 | | `ME:1495-1513` | Undo history stores full `getData()` snapshots incl. flags | Named fold snapshots | M |
| F-INNER-04 | ❌ | | `ME:805-807` | `expandNodeAll` / ⌘K = are unbounded | Node-count bound for huge maps | S |
| F-STATE-01 | 🟡 | on load | `components/MindmapCanvas.vue:208` | Standalone maps reset every branch to collapsed on open; stored flags ignored | Respect stored flags or make it a setting | S |
| F-STATE-02 | ✅ | 02 | `lib/mindmap-collapse.ts:1-6` | `expanded?: boolean` on every node | | |
| F-STATE-03 | 🔌 | | `components/MindmapCanvas.vue:208` | Load-time policy exists, no override layer | Policy + stored overrides | M |
| F-STATE-04 | ❌ | | | Stores per-node flags, not a minority set | | |
| F-STATE-05 | ✅ | 05 | `lib/mindmap-format.ts:153-172`, `components/MindmapCanvas.vue:222` | `expanded` serialized into `.mmap`; each fold schedules a save → diffs and git noise | Move to view-state | M |
| F-STATE-06 | ❌ | | | Two views of one map share state through file content | | |
| F-STATE-07 | 🟡 | in-file | `components/MindmapCanvas.vue:208` | Persisted in file; honored for fenced maps only (inferred) | | |
| F-STATE-08 | 🟡 | | `components/MindmapCanvas.vue:208` | Effectively ephemeral for standalone maps | | |
| F-IDENT-01 | ❌ | | | | | |
| F-IDENT-02 | ❌ | | | | | |
| F-IDENT-03 | ✅ | 03 | `ME:785-787`, `lib/mindmap-format.ts:76-77` | Flag rides on the node object with a generated id | | |
| F-IDENT-04 | ❌ | | | | | |
| F-LIFE-01 | ✅ | | `ME:785-787` | Flag deleted with the node | | |
| F-LIFE-02 | ✅ | follows node | `ME:649` | Flag moves with node; dropping "in" a collapsed target expands it | | |
| F-LIFE-03 | ✅ | auto-reveal | `ME:519` | Add child under collapsed parent expands it | | |
| F-LIFE-04 | 🟡 | | `ME:1495-1513`, `components/MindmapCanvas.vue:222` | Folds are not undo steps (`expandNode` event, not `operation`), but undoing an edit restores the snapshot's fold flags | Decide and document | S |
| F-LIFE-05 | ❌ | | | | | |
| F-SEL-01 | 🟡 | collapse only | `lib/mindmap-collapse.ts:37` | Selected nodes with a selected ancestor dropped on collapse, kept on expand | | |
| F-SEL-02 | ❌ | 03 instead | | | | |
| F-SEL-03 | ✅ | 03 | `lib/mindmap-collapse.ts:35` | Any expanded target → all collapse | | |
| F-SEL-04 | ❌ | 03 instead | | | | |
| F-SEL-05 | ❌ | 03 instead | | | | |
| F-SEL-06 | 🟡 | | `components/MindmapCanvas.vue:536-538` | Empty selection → whole-map toggle; no cursor/root step | | |
| F-SEL-07 | 🟡 | | `lib/mindmap-collapse.ts:33-34`, `components/MindmapCanvas.vue:536-538` | Leaves are inert, but a leaf-only selection falls through to the whole-map toggle | Act on nearest foldable ancestor | S |
| F-SEL-08 | 🟡 | | `components/MindmapCanvas.vue:521-525` | Hidden selected nodes are dropped, not moved to the collapsed ancestor | | S |
| F-SEL-09 | ✅ | permanent | `lib/mindmap-find.ts:57-75` | Ancestors expand and stay expanded | | |
| F-ALG-01 | ✅ | | `ME:787` | Boolean set | | |
| F-ALG-02 | ✅ | | `ME:787`, `ME:805-807` | Single toggle is an involution; recursive is not | | |
| F-ALG-03 | ✅ | | `lib/mindmap-collapse.ts:37-38` | Antichain + depth-sorted steps | | |
| F-ADJ-01 | 🟡 | reveal on walk | `lib/mindmap-find.ts:1-6,57-75` | Hits inside collapsed subtrees are not hinted on the ancestor until walked | Hint badge on collapsed ancestor | S |
| F-ADJ-02 | ❌ | | | | | |
| F-ADJ-03 | ✅ | | `lib/mindmap-folded-count.ts:19-40`, `components/MindmapMapFields.vue:17-20` | Direct / all / both counts on collapsed expander, per-map setting | | |
| F-ADJ-05 | 🟡 | | `ME:785-807` | Re-anchors viewport after fold; no animation or virtualization | | |

### S2 Editor heading fold

| Case ID | Status | Variant implemented | Evidence (file:line) | Observed behavior | Gap / opportunity | Effort |
|---|---|---|---|---|---|---|
| F-MODEL-01 | ✅ | | `CML:1314-1334`, `lib/heading-fold.ts:168-182` | Folds are independent ranges; nested ranges stay in the set (inferred) | | |
| F-MODEL-02 | ✅ | | `lib/heading-fold.ts:127` | Heading with no body is not foldable | | |
| F-MODEL-03 | ❌ | | | | | |
| F-ACTION-01 | ✅ | | `lib/cm-heading-fold.ts:125-132`, `CML:1323` | Fold all; `foldExists` blocks duplicates | | |
| F-ACTION-02 | ✅ | | `lib/cm-heading-fold.ts:135-137` | Unfold all (also code blocks) | | |
| F-ACTION-03 | ✅ | | `lib/cm-heading-fold.ts:103-122`, `Editor.vue:509-511` | Toggle section at cursor; gutter and plain chevron | | |
| F-ACTION-04 | ❌ | | | | | |
| F-ACTION-05 | ❌ | | | | | |
| F-ACTION-06 | 🔌 | | `lib/cm-heading-fold.ts:86-93` | `hasFolds` exists but fold.all / fold.none are separate commands | Single "toggle all" | S |
| F-SCOPE-01 | ✅ | | `lib/cm-heading-fold.ts:103-122` | | | |
| F-SCOPE-02 | 🔌 | | `lib/heading-fold.ts:72-130` | Spans know level and range | | S |
| F-SCOPE-03 | 🔌 | | `lib/heading-fold.ts:72-130` | | Fold/unfold section recursively | S |
| F-SCOPE-04 | 🔌 | | `lib/cm-heading-fold.ts:143-151` | Level logic exists globally only | Per-section | S |
| F-SCOPE-05 | ✅ | permanent | `CML:1332-1334` | Moving the cursor into a fold clears every fold covering it; plain editor always renders the active block (`Editor.vue:469-472`) | | |
| F-SCOPE-06 | 🔌 | | `lib/heading-fold.ts:72-130` | | | S |
| F-SCOPE-07 | ✅ | heading level ≥ k | `composables/useCommands.ts:433-441`, `lib/cm-heading-fold.ts:143-151`, `Editor.vue:3547-3551` | "Show down to level k": unfold all, then fold every heading of level ≥ k | Keyed to heading level, not tree depth (H1→H3 skip) | |
| F-SCOPE-08 | 🔌 | | `lib/heading-fold.ts:72-130` | | Fold everything off the cursor's heading path | S |
| F-INNER-01 | ✅ | 01 | `CML:1323-1327` | Nested folds survive a parent unfold (inferred) | | |
| F-INNER-02 | 🟡 | via fold.all | `lib/cm-heading-fold.ts:125-132` | Global only | | |
| F-INNER-03 | ❌ | | | | | |
| F-STATE-01 | ❌ | | | | | |
| F-STATE-02 | ❌ | | | | | |
| F-STATE-03 | ❌ | | | | | |
| F-STATE-04 | ✅ | folded set | `CML:1314-1334`, `Editor.vue:454` | Only folded ranges / anchors stored | | |
| F-STATE-05 | ❌ | | | | | |
| F-STATE-06 | 🟡 | per EditorState | `Editor.vue:3224` | Each editor instance owns its folds (inferred independent across panes) | | |
| F-STATE-07 | 🔌 | | `CML:1338-1356`, `lib/heading-fold.ts:41-44,207-222` | `foldState.toJSON/fromJSON` and title anchors exist | Persist per file | S |
| F-STATE-08 | ✅ | | `Editor.vue:3643-3697` | Tab switch rebuilds `EditorState`; folds lost even without reload | | |
| F-IDENT-01 | ❌ | | | | | |
| F-IDENT-02 | ❌ | | | | | |
| F-IDENT-03 | 🟡 | position mapping | `CML:1321` | CM ranges map through edits (not an id) | | |
| F-IDENT-04 | 🟡 | plain editor only | `lib/heading-fold.ts:207-222`, `Editor.vue:514-521` | Re-anchor by title, nearest line | Also use for CM persistence | |
| F-LIFE-01 | ✅ | | `CML:1319-1320`, `lib/heading-fold.ts:186-189` | Deleting text clears touched folds | | |
| F-LIFE-02 | 🟡 | | `CML:1319-1321` | Cut/paste of a section drops its fold (inferred) | | |
| F-LIFE-04 | ✅ | not in undo | `CML:1314-1334` | Fold effects are not history entries (inferred) | | |
| F-LIFE-05 | ❌ | | | | | |
| F-SEL-07 | ✅ | nearest ancestor | `lib/cm-heading-fold.ts:116-121` | Cursor in body folds the enclosing heading | | |
| F-SEL-08 | 🟡 | | `lib/cm-heading-fold.ts:78-83` | Folding dispatches no selection change; caret can sit in hidden text until it moves (inferred) | Move caret to heading line | S |
| F-SEL-09 | ✅ | permanent | `CML:1332-1334` | | | |
| F-ALG-01 | ✅ | | `CML:1323` | | | |
| F-ALG-02 | ✅ | | `lib/cm-heading-fold.ts:109-121` | Unfold innermost first, then fold | | |
| F-ADJ-01 | 🟡 | reveal | `CML:1332-1334` | Find selecting a hit inside a fold clears it (inferred) | | |
| F-ADJ-02 | ❌ | | | | | |
| F-ADJ-03 | ✅ | | `lib/cm-heading-fold.ts:155-170`, `Editor.vue:486-491,4285-4288` | "⋯ N lines" placeholder | | |
| F-ADJ-05 | ✅ | | `CML:1314-1334` | CM viewport rendering with replace decorations (inferred) | | |

### S3 Preview heading fold

| Case ID | Status | Variant implemented | Evidence (file:line) | Observed behavior | Gap / opportunity | Effort |
|---|---|---|---|---|---|---|
| F-MODEL-01 | ✅ | | `lib/preview-heading-fold.ts:20-32` | Hidden because an ancestor key is folded | | |
| F-MODEL-02 | ✅ | | `lib/preview-heading-fold.ts:82-86` | No toggle on headings without a body | | |
| F-MODEL-03 | ❌ | | | | | |
| F-ACTION-01, 02 | 🔌 | | `lib/preview-heading-fold.ts:56` | `folded: Set<string>` | Commands | S |
| F-ACTION-03 | ✅ | | `lib/preview-heading-fold.ts:93-100` | | | |
| F-ACTION-04 | ❌ | | | | | |
| F-ACTION-05, 06 | 🔌 | | `lib/preview-heading-fold.ts:64-68` | Levels and keys known | | S |
| F-SCOPE-01 | ✅ | | `lib/preview-heading-fold.ts:96-97` | | | |
| F-SCOPE-02..04, 06, 08 | 🔌 | | `lib/preview-heading-fold.ts:64-68` | | | S |
| F-SCOPE-05 | 🔌 | | `lib/preview-heading-fold.ts:20-32` | No reveal on scroll-sync or anchor link | Unfold ancestors of anchor target | S |
| F-SCOPE-07 | 🔌 | | `lib/preview-heading-fold.ts:65` | | Share editor fold.level | S |
| F-INNER-01 | ✅ | 01 | `lib/preview-heading-fold.ts:20-32` | Nested keys kept | | |
| F-INNER-02 | 🔌 | | | | | |
| F-INNER-03 | ❌ | | | | | |
| F-STATE-01..03, 05 | ❌ | | | | | |
| F-STATE-04 | ✅ | folded set | `components/Preview.vue:482-492` | | | |
| F-STATE-06 | 🟡 | per doc | `components/Preview.vue:482-492` | Map keyed by file path; two previews of one file share one Set but only the clicked one re-applies | | S |
| F-STATE-07 | 🔌 | | `components/Preview.vue:482` | Module-level map | Persist | S |
| F-STATE-08 | ✅ | | `components/Preview.vue:480-482` | Survives remount, not reload | | |
| F-IDENT-02 | ✅ | title#ordinal | `lib/preview-heading-fold.ts:35-42` | Heading text + occurrence | Breaks on heading rename | |
| F-IDENT-01, 03, 04 | ❌ | | | | | |
| F-LIFE-01 | 🔌 | | `components/Preview.vue:482-492` | Stale keys never pruned | Prune on render | S |
| F-LIFE-02 | 🟡 | follows text | `lib/preview-heading-fold.ts:35-42` | Moved section keeps fold if title/ordinal unchanged | | |
| F-LIFE-05 | ❌ | | | | | |
| F-SEL-09 | 🔌 | | `lib/preview-heading-fold.ts:20-32` | | | S |
| F-ALG-01 | 🔌 | | | | | |
| F-ALG-02 | ✅ | | `lib/preview-heading-fold.ts:96-97` | | | |
| F-ADJ-02 | ❌ | | | | | |
| F-ADJ-03 | 🔌 | | `lib/preview-heading-fold.ts:20-32` | Hidden block count is computable | Match editor "N lines" | S |

### S4 Outline panel

| Case ID | Status | Variant implemented | Evidence (file:line) | Observed behavior | Gap / opportunity | Effort |
|---|---|---|---|---|---|---|
| F-MODEL-01 | ✅ | | `components/Outline.vue:105-131` | `flattenVisible` skips children of collapsed nodes | | |
| F-MODEL-02 | ✅ | | `components/Outline.vue:276-284` | Leaves get a spacer, no twisty | | |
| F-MODEL-03 | ❌ | | | | | |
| F-ACTION-01, 02 | 🔌 | | `components/Outline.vue:78-88` | | Collapse/expand all | S |
| F-ACTION-03 | ✅ | | `components/Outline.vue:133-145,276-283` | | | |
| F-ACTION-04 | ❌ | | | | | |
| F-ACTION-05, 06 | 🔌 | | `components/Outline.vue:90-103` | Tree built | | S |
| F-SCOPE-01 | ✅ | | `components/Outline.vue:133-145` | | | |
| F-SCOPE-02..04, 06..08 | 🔌 | | `components/Outline.vue:90-125` | | | S |
| F-SCOPE-05 | 🔌 | | `components/Outline.vue:162-171` | Cursor in a collapsed section highlights the collapsed parent; no auto-expand | Optional follow-cursor reveal | S |
| F-INNER-01 | ✅ | 01 | `components/Outline.vue:133-145` | Child lines stay in the list | | |
| F-INNER-02 | 🔌 | | | | | |
| F-INNER-03 | ❌ | | | | | |
| F-STATE-01..03, 05 | ❌ | | | | | |
| F-STATE-04 | ✅ | collapsed set | `components/Outline.vue:25` | `Record<tabId, number[]>`, default expanded | | |
| F-STATE-06 | ✅ | | `components/Outline.vue:25` | Outside the model, keyed per tab | Not shared with editor folds (see Table E) | |
| F-STATE-07 | 🔌 | | `components/Outline.vue:25` | | | S |
| F-STATE-08 | ✅ | | `components/Outline.vue:25` | Lost on unmount (pane hidden, side flipped) | | |
| F-IDENT-01 | 🟡 | line number | `components/Outline.vue:133-145` | Positional key; editing above a collapsed heading re-attaches the fold to whatever heading lands on that line | Use `remapFolds` anchors | S |
| F-IDENT-02, 03 | ❌ | | | | | |
| F-IDENT-04 | 🔌 | | `lib/heading-fold.ts:207-222` | Re-match helper exists, unused here | | S |
| F-LIFE-01 | 🟡 | | `components/Outline.vue:147-159` | Prunes vanished lines, active tab only; closed-tab entries leak | | S |
| F-LIFE-02 | ❌ | | `components/Outline.vue:147-159` | Moving a section moves nothing; fold sticks to the line | | S |
| F-LIFE-05 | ❌ | | | | | |
| F-SEL-08 | ✅ | move to ancestor | `components/Outline.vue:162-171` | Active row becomes the last visible heading | | |
| F-SEL-09 | 🔌 | | `components/Outline.vue:198-207` | Jump labels cover visible rows only | | S |
| F-ALG-01 | 🔌 | | | | | |
| F-ALG-02 | ✅ | | `components/Outline.vue:133-145` | | | |
| F-ADJ-02 | ❌ | | | | | |
| F-ADJ-03 | 🔌 | | `components/Outline.vue:90-103` | Child counts known | | S |

### S5 File explorer

| Case ID | Status | Variant implemented | Evidence (file:line) | Observed behavior | Gap / opportunity | Effort |
|---|---|---|---|---|---|---|
| F-MODEL-01 | ✅ | | `components/FileTree.vue:2147` | Children render only when `n.expanded` | | |
| F-MODEL-02 | ✅ | | `components/FileTree.vue:450-453,2138` | Files open instead of toggling; no caret | | |
| F-MODEL-03 | ❌ | | | | | |
| F-ACTION-01 | 🔌 | | `components/FileTree.vue:455-457` | Collapse only via toggle | Collapse all (common VS Code action) | S |
| F-ACTION-02 | ✅ | | `components/FileTree.vue:466-476` | `expandDir` is idempotent, lazy-loads | | |
| F-ACTION-03 | ✅ | | `components/FileTree.vue:442-460` | Click or double-click per setting | | |
| F-ACTION-04 | ❌ | | | | | |
| F-ACTION-05, 06 | 🔌 | | `components/FileTree.vue:466-476` | Async per-node expand exists | Needs F-INNER-04 guard | M |
| F-SCOPE-01 | ✅ | | `components/FileTree.vue:455-459` | | | |
| F-SCOPE-02..04, 06, 08 | 🔌 | | `components/FileTree.vue:65-72,466-476` | | | S–M |
| F-SCOPE-05 | ✅ | permanent | `components/FileTree.vue:1076-1102,1134-1148` | `revealRow` expands each ancestor; follow-active option | | |
| F-SCOPE-07 | ❌ | | | Needs listing the whole tree | | L |
| F-INNER-01 | 🟡 | 01 in session | `components/FileTree.vue:455-457,606-625` | Preserved in memory; any refresh drops expanded folders under a collapsed parent | Rehydrate all collected paths | S |
| F-INNER-02 | 🔌 | | | | | |
| F-INNER-03 | ❌ | | | | | |
| F-INNER-04 | 🟡 | async per node | `components/FileTree.vue:466-476,402-413` | `loading` flag set but never rendered; errors silently yield `[]` | Spinner + error row | S |
| F-STATE-01, 03, 05 | ❌ | | | | | |
| F-STATE-02 | 🟡 | flag on view node | `components/FileTree.vue:65-72` | Unset = collapsed | | |
| F-STATE-04 | 🟡 | expanded set on refresh | `components/FileTree.vue:608-613` | Expanded paths collected only transiently | | |
| F-STATE-06 | 🟡 | | `components/FileTree.vue:65-72` | View-only flags, single view | | |
| F-STATE-07 | 🔌 | | `components/FileTree.vue:606-625` | Expanded-path set already computed | Persist per workspace (`.solomd/` or settings) | S |
| F-STATE-08 | ✅ | | `components/FileTree.vue:417-440` | Lost on reload and workspace switch | | |
| F-IDENT-01 | ✅ | path | `components/FileTree.vue:608-623` | Rehydrate by absolute path | | |
| F-IDENT-02..04 | ❌ | | | | | |
| F-LIFE-01 | ✅ | | `components/FileTree.vue:606-625` | Refresh rebuilds from disk; removed paths vanish | | |
| F-LIFE-02 | ✅ | reset (path) | `components/FileTree.vue:606-625` | Renamed/moved folder shows collapsed | Carry state on in-app rename/move | S |
| F-LIFE-03 | ✅ | auto-reveal | `components/FileTree.vue:779-784` | New file/folder opens its parent | | |
| F-LIFE-05 | ❌ | | | | | |
| F-SEL-08 | ❌ | | `components/FileTree.vue:449` | Selected row can be hidden; rows are not focusable | Keyboard tree nav | M |
| F-SEL-09 | ✅ | permanent | `components/FileTree.vue:1076-1102` | | | |
| F-ALG-01 | 🔌 | | | | | |
| F-ALG-02 | ✅ | | `components/FileTree.vue:455-459` | | | |
| F-ADJ-01 | 🟡 | stays hidden | `components/FileTree.vue:2073-2077,1105-1112` | Extension filter keeps matching folders collapsed; reveal under a filter fails with a toast | Auto-expand matching dirs | S |
| F-ADJ-02 | 🟡 | root only | `components/FileTree.vue:386-390,1788-1790` | "+N more" for root; subfolder `truncated` set but not shown | Render for every folder | S |
| F-ADJ-03 | ❌ | | | | | |
| F-ADJ-04 | 🟡 | | `components/FileTree.vue:466-476` | Lazy fetch, no visible per-node loading/error | | S |
| F-ADJ-05 | 🟡 | | `components/FileTree.vue:2147` | Caret rotation only; no virtualization | | |

### S6 Mind map folder tree

| Case ID | Status | Variant implemented | Evidence (file:line) | Observed behavior | Gap / opportunity | Effort |
|---|---|---|---|---|---|---|
| F-MODEL-01 | ✅ | | `lib/mindmap-folder-tree.ts:23-36` | Rows recurse only through expanded entries | | |
| F-MODEL-02 | ✅ | | `components/MindmapFolderTree.vue:71,229` | | | |
| F-MODEL-03 | ❌ | | | | | |
| F-ACTION-01, 02 | 🔌 | | `components/MindmapFolderTree.vue:36` | | | S |
| F-ACTION-03 | ✅ | | `components/MindmapFolderTree.vue:70-85,227-233` | Double-click row or chevron | | |
| F-ACTION-04 | ❌ | | | | | |
| F-ACTION-05, 06 | 🔌 | | `components/MindmapFolderTree.vue:64-68` | Async `loadChildren` | Guard needed | M |
| F-SCOPE-01 | ✅ | | `components/MindmapFolderTree.vue:72-77` | | | |
| F-SCOPE-02..06, 08 | 🔌 | | `components/MindmapFolderTree.vue:35-36,64-68` | | | S–M |
| F-SCOPE-07 | ❌ | | | | | L |
| F-INNER-01 | ✅ | 01 | `components/MindmapFolderTree.vue:72-77` | Descendant keys stay | | |
| F-INNER-02 | 🔌 | | | | | |
| F-INNER-03 | ❌ | | | | | |
| F-INNER-04 | 🟡 | async, errors toasted | `components/MindmapFolderTree.vue:78-83` | No loading indicator | | S |
| F-STATE-01..03, 05 | ❌ | | | | | |
| F-STATE-04 | ✅ | expanded set | `components/MindmapFolderTree.vue:36,125` | Default collapsed except root | | |
| F-STATE-06 | ✅ | | `components/MindmapFolderTree.vue:36` | Set keyed by relPath | | |
| F-STATE-07 | 🔌 | | `components/MindmapFolderTree.vue:115-125` | | | S |
| F-STATE-08 | ✅ | | `components/MindmapFolderTree.vue:115-125` | Reset on every open | | |
| F-IDENT-01 | ✅ | relPath | `components/MindmapFolderTree.vue:36` | | | |
| F-IDENT-02..04 | ❌ | | | | | |
| F-LIFE-05 | ❌ | | | | | |
| F-SEL-01..05 | ❌ | | `components/MindmapFolderTree.vue:87-98` | Multi-select exists, no fold-on-selection | | S |
| F-SEL-08 | 🟡 | | `components/MindmapFolderTree.vue:50,100-102` | Collapsing hides selected rows; they silently drop out of scope edits | Keep hidden selection or move it to parent | S |
| F-ALG-01 | 🔌 | | | | | |
| F-ALG-02 | ✅ | | `components/MindmapFolderTree.vue:72-80` | | | |
| F-ADJ-02 | ❌ | | | | | |
| F-ADJ-03 | ❌ | | | Children unknown until listed | | M |
| F-ADJ-04 | 🟡 | | `components/MindmapFolderTree.vue:78-83` | Lazy fetch + error toast, no spinner | | S |

### S7 Git branch tree

| Case ID | Status | Variant implemented | Evidence (file:line) | Observed behavior | Gap / opportunity | Effort |
|---|---|---|---|---|---|---|
| F-MODEL-01 | ✅ | | `components/git/GitBranchNode.vue:29` | | | |
| F-MODEL-02 | ✅ | | `components/git/GitBranchNode.vue:20,24` | Branches/tags select instead of toggling | | |
| F-MODEL-03 | ❌ | | | | | |
| F-ACTION-01, 02 | 🔌 | | `components/git/GitBranchTree.vue:19` | | | S |
| F-ACTION-03 | ✅ | | `components/git/GitBranchTree.vue:53-58` | | | |
| F-ACTION-04 | ❌ | | | | | |
| F-ACTION-05, 06 | 🔌 | | `lib/git-pane/branchTree.ts:12-40` | Eager tree | | S |
| F-SCOPE-01 | ✅ | | `components/git/GitBranchTree.vue:53-58` | | | |
| F-SCOPE-02..08 | 🔌 | | `lib/git-pane/branchTree.ts:12-40` | Reveal current branch absent | | S |
| F-INNER-01 | ✅ | 01 | `components/git/GitBranchTree.vue:53-58` | Nested collapsed ids kept | | |
| F-INNER-02 | 🔌 | | | | | |
| F-INNER-03 | ❌ | | | | | |
| F-STATE-01..03, 05 | ❌ | | | | | |
| F-STATE-04 | ✅ | collapsed set | `components/git/GitBranchTree.vue:19` | Default expanded | | |
| F-STATE-06 | ✅ | | `components/git/GitBranchTree.vue:19` | | | |
| F-STATE-07 | 🔌 | | `components/git/GitBranchTree.vue:19` | | Persist per repo | S |
| F-STATE-08 | ✅ | | `components/git/GitBranchTree.vue:19` | | | |
| F-IDENT-01 | ✅ | name path | `lib/git-pane/branchTree.ts:16` | `local/feature` style ids | | |
| F-IDENT-02..04 | ❌ | | | | | |
| F-LIFE-01 | 🔌 | | `components/git/GitBranchTree.vue:92-96` | Ids never pruned; a recreated folder reappears collapsed | | S |
| F-LIFE-02 | ✅ | reset (path) | `lib/git-pane/branchTree.ts:16,24` | Rename → new id | | |
| F-LIFE-03 | 🟡 | stays hidden | `components/git/GitBranchTree.vue:19` | New branch in a collapsed folder stays hidden even when the user just created it | Auto-reveal on create | S |
| F-LIFE-05 | ❌ | | | | | |
| F-SEL-08 | ❌ | | `components/git/GitBranchTree.vue:98-101` | | | S |
| F-SEL-09 | 🔌 | | `components/git/GitBranchTree.vue:29-39` | | | S |
| F-ALG-01 | 🔌 | | | | | |
| F-ALG-02 | ✅ | | `components/git/GitBranchTree.vue:53-58` | | | |
| F-ADJ-01 | 🟡 | stays hidden | `components/git/GitBranchTree.vue:29-39`, `GitBranchNode.vue:29` | Search prunes the tree but matches under a collapsed folder stay hidden | Ignore `collapsed` while a query is active | S |
| F-ADJ-02 | ❌ | | | | | |
| F-ADJ-03 | 🔌 | | `lib/git-pane/branchTree.ts:12-25` | | Branch count on folder | S |

### S8 Neighborhood groups

| Case ID | Status | Variant implemented | Evidence (file:line) | Observed behavior | Gap / opportunity | Effort |
|---|---|---|---|---|---|---|
| F-ACTION-01, 02 | 🔌 | | `components/NeighborhoodGroupSection.vue:28` | | | S |
| F-ACTION-03 | ✅ | | `components/NeighborhoodGroupSection.vue:28,54` | | | |
| F-SCOPE-01 | ✅ | | `components/NeighborhoodGroupSection.vue:28` | | | |
| F-SCOPE-06 | 🔌 | | `components/NeighborhoodPanel.vue:302,315` | | | S |
| F-STATE-01, 03..05 | ❌ | | | | | |
| F-STATE-02 | ✅ | | `components/NeighborhoodGroupSection.vue:28` | Boolean per group instance | | |
| F-STATE-06 | 🟡 | component-local | `components/NeighborhoodGroupSection.vue:28` | | | |
| F-STATE-07 | 🔌 | | | | | S |
| F-STATE-08 | ✅ | | `components/NeighborhoodGroupSection.vue:28` | | | |
| F-IDENT-03 | 🟡 | v-for key | `components/NeighborhoodPanel.vue:302,315` | State lives while the group key recurs | | |
| F-IDENT-01, 02, 04 | ❌ | | | | | |
| F-LIFE-01 | ✅ | | `components/NeighborhoodPanel.vue:302,315` | Component destroyed with the group (inferred) | | |
| F-ALG-01 | 🔌 | | | | | |
| F-ALG-02 | ✅ | | `components/NeighborhoodGroupSection.vue:28` | | | |
| F-ADJ-03 | ✅ | | `components/NeighborhoodGroupSection.vue:64` | Count chip always shown | | |

### S9 Types panel sections

| Case ID | Status | Variant implemented | Evidence (file:line) | Observed behavior | Gap / opportunity | Effort |
|---|---|---|---|---|---|---|
| F-ACTION-01, 02 | 🔌 | | `components/TypesPanel.vue:49` | | | S |
| F-ACTION-03 | ✅ | | `components/TypesPanel.vue:50-52,143` | Header is a `<div>`, not keyboard-operable | Use a button + `aria-expanded` | S |
| F-SCOPE-01 | ✅ | | `components/TypesPanel.vue:50-52` | | | |
| F-SCOPE-06 | 🔌 | | `components/TypesPanel.vue:49` | | | S |
| F-STATE-01..03, 05 | ❌ | | | | | |
| F-STATE-04 | 🟡 | | `components/TypesPanel.vue:49-55` | Unset = expanded, but toggling back stores `false` | | |
| F-STATE-06 | ✅ | | `components/TypesPanel.vue:49` | Keyed by type name | | |
| F-STATE-07 | 🔌 | | | | | S |
| F-STATE-08 | ✅ | | `components/TypesPanel.vue:49` | | | |
| F-IDENT-02 | 🟡 | type name | `components/TypesPanel.vue:49` | Name is the content key | | |
| F-IDENT-01, 03, 04 | ❌ | | | | | |
| F-LIFE-01 | 🔌 | | `components/TypesPanel.vue:49` | Never pruned (harmless) | | S |
| F-ALG-01 | 🔌 | | | | | |
| F-ALG-02 | ✅ | | `components/TypesPanel.vue:50-52` | | | |
| F-ADJ-02 | ❌ | | | | | |
| F-ADJ-03 | 🔌 | | `components/TypesPanel.vue:45` | Member count known | | S |

## 5. Table D: state architecture

| Surface | State model | Location | Default / stored set | Identity key | Survives reload | In undo | Multi-view | Delete / move / insert |
|---|---|---|---|---|---|---|---|---|
| S1 Mind map | Explicit flag + load-time reset policy | Model (`NodeObj.expanded`, written to `.mmap`) | Collapsed on open (standalone); every node flag stored | Generated node id | No for standalone maps (`MindmapCanvas.vue:208`); yes for fenced maps (inferred) | Not as steps; edit undo restores snapshot flags | Shared via file content | Deleted with node; follows moves; insert auto-expands parent |
| S2 Editor | Explicit folded set | CM `foldState` / `plainFolds` ref | Expanded; folded ranges stored | CM position mapping; plain: line + title anchor | No (lost on tab switch) | No (inferred) | Independent per editor (inferred) | Delete clears; move drops; typing inside impossible (cursor unfolds) |
| S3 Preview | Explicit folded set | Module-level `Map<docPath, Set>` | Expanded; folded keys stored | `title#ordinal` | No (survives remount) | — | Shared Set per file, re-applied only in clicked view | Stale keys kept; rename heading = lost fold |
| S4 Outline | Explicit collapsed set | Component ref `Record<tabId, number[]>` | Expanded; collapsed lines stored | Line number | No (lost on unmount) | — | One view | Pruned for active tab; edits above shift folds onto wrong headings |
| S5 Explorer | Explicit flag on view node | `Node.expanded` in component tree | Collapsed (root expanded); flags stored | Absolute path | No | — | One view | Removed on refresh; rename/move resets; create auto-expands parent |
| S6 MM folder tree | Explicit expanded set | Component `Set<relPath>` | Collapsed (root expanded) | relPath | No (reset per open) | — | One view | Snapshot; no fs watch |
| S7 Git branches | Explicit collapsed set | Component `Set<id>` | Expanded | Name-path id | No | — | One view | Ids never pruned; rename resets; new branch stays hidden |
| S8 Neighborhood | Explicit boolean | Component-local ref | Expanded | v-for group key | No | — | One view | Destroyed with group |
| S9 Types | Explicit map | Component `Record<name, boolean>` | Expanded | Type name | No | — | One view | Never pruned |

## 6. Table E: cross-surface inconsistencies

| Case ID | Surfaces | How behavior differs | Suggested canonical behavior |
|---|---|---|---|
| F-STATE-06 / F-IDENT-* | S2, S3, S4 | Same markdown headings folded by three independent stores keyed three ways: CM ranges, `title#ordinal`, line number. Folding in one never reflects in the others | One per-document heading fold store keyed by `FoldAnchor` (title + line, `lib/heading-fold.ts:41-44`), consumed by editor, preview and outline |
| F-IDENT-01/04 | S2 plain vs S2 CM vs S4 | Plain editor re-anchors folds by title (`remapFolds`); CM maps positions; Outline uses raw line numbers and drifts | Anchor + `remapFolds` everywhere |
| F-STATE-05 | S1 vs all | Only the mind map writes fold state into the document, so folding dirties the file and triggers auto-save | View-state sidecar for standalone maps; keep in-model only if explicitly wanted |
| F-STATE-08 | S1 vs S2 | Mind map persists flags then discards them on open; editor discards on every tab switch | Persist per file, restore on open and tab switch |
| Default | S5, S6 vs S4, S7, S8, S9 | Collapsed by default vs expanded by default | Collapsed for lazy file trees, expanded for small eager trees (current split is fine; document it) |
| F-ACTION-05/06 | S1 vs S2 | Mind map has recursive and toggle-all (Space, ⌘-click, ⌘K); editor has separate fold.all / fold.none, no recursive per section | Shared verbs: toggle, toggle subtree, toggle all, level k |
| F-SCOPE-07 | S1 vs S2 | Mind map ⌘K k = tree depth (expand < k, collapse rest); editor fold.level k = heading level ≥ k after unfold all | Same "show to level k" semantics and binding in both |
| F-ADJ-01 | S5, S7 vs S1, S2 | Explorer and branch search leave matches hidden in collapsed folders; mind-map find and editor reveal them | Reveal matches (or hint on ancestor) while a filter is active |
| F-SEL-08 | S4 vs S1, S5 | Outline moves the active marker to the collapsed ancestor; mind map drops hidden selections; explorer keeps a hidden selection | Move focus/selection to nearest visible ancestor |
| F-LIFE-03 | S1, S5 vs S7 | Mind map and explorer auto-reveal user-created children; git branch tree does not | Auto-reveal when the user created the node |
| A11y (no case) | S6 vs S4, S5, S7, S9 | Only S6 has `role=tree` / `aria-expanded`; others have none, S9 header is a non-focusable div | WAI-ARIA tree pattern on all recursive trees |

## 7. Table F: top opportunities

| Rank | Case ID | Surfaces | Why it matters | Effort | Suggested approach (one line) |
|---|---|---|---|---|---|
| 1 | F-STATE-07 / F-STATE-08 | S2 | Editor folds vanish on every tab switch; long docs lose their shape constantly | S | Save `foldState.toJSON` (or anchors) per tab in `tabCaretMemory` and per file on close |
| 2 | F-STATE-05 / F-STATE-01 | S1 | Folding a map dirties the `.mmap` and auto-saves, yet open re-collapses everything, so the stored state is noise | M | Strip `expanded` from serialization into a per-file sidecar; restore it on open |
| 3 | F-IDENT-01 → F-IDENT-04 | S4 | Outline folds jump to the wrong heading after any edit above | S | Store `FoldAnchor[]` and run `remapFolds` on content change |
| 4 | F-STATE-06 (shared) | S2, S3, S4 | Three disconnected heading fold stores | M | One per-document heading fold store, all three views subscribe |
| 5 | F-ACTION-01 | S5 | No "Collapse all" in the explorer | S | Walk `root` and clear `expanded`; toolbar button + command |
| 6 | F-INNER-01 | S5 | Refresh (every save) drops expanded folders under a collapsed parent | S | Rehydrate every collected path, not only through expanded parents |
| 7 | F-STATE-07 | S5, S7 | Explorer and branch folds lost on reload | S | Persist expanded/collapsed path sets per workspace / repo |
| 8 | F-ADJ-01 | S5, S7 | Filter/search hides matches inside collapsed folders | S | While filtering, treat matching ancestors as expanded (S7: ignore `collapsed` when `query` set) |
| 9 | F-ADJ-04 / F-ADJ-02 | S5 | Slow folders show nothing; subfolder truncation hidden | S | Render `node.loading`, error row, and per-folder "+N more" |
| 10 | F-SEL-07 | S1 | Space on a leaf toggles the whole map | S | Map leaves to their parent in `planSelectionToggle` |
| 11 | F-SCOPE-07 | S1, S2 | Same "level k" verb means different things | S | Align semantics; expose ⌘K digits in the editor too |
| 12 | F-ACTION-05 | S2, S4 | No recursive fold of one section | S | Fold/unfold all headings inside the target span |
| 13 | F-LIFE-03 | S7 | New branch in a collapsed folder is invisible | S | Remove its folder ids from `collapsed` after create |
| 14 | F-MODEL-03 | S1 | No mixed indicator on partially folded branches | S | Subtree aggregate → indeterminate expander style |
| 15 | F-LIFE-01 | S3, S7, S9 | Stale keys accumulate | S | Prune against live keys on render |

## 8. Shared infrastructure

Candidates for a pure `apply(state, tree, command) -> state` fold engine:

| Piece | Path | What it gives |
|---|---|---|
| Selection fold planner | `lib/mindmap-collapse.ts:1-51` | Already pure and tested (`mindmap-collapse.test.ts`): `CollapsibleNode` interface, antichain normalization, mixed policy, depth ordering, subtree setter. Best seed for the engine |
| Recursive setter with depth | `ME:77-88` (`z`) | Reference semantics for subtree / depth-N ops (note: forces deeper nodes collapsed) |
| Heading span model | `lib/heading-fold.ts:72-222` | Text → tree spans, `FoldAnchor`, `remapFolds` (fuzzy re-match), `pruneFolds` (GC), `foldedCharRanges` |
| Block visibility from folds | `lib/preview-heading-fold.ts:20-42` | Pure `hiddenBlocks` + `headingKeys`; reusable for any flat leveled list |
| Folded count | `lib/mindmap-folded-count.ts:11-24` | Pure collapsed-summary computation |
| Visible-row flattening | `lib/mindmap-folder-tree.ts:23-43`, `components/Outline.vue:90-125` | Two copies of "build tree / flatten visible / range select" |
| Branch tree builder | `lib/git-pane/branchTree.ts:12-40` | Path-segment tree builder with stable ids |
| Path-keyed expansion preservation | `components/FileTree.vue:606-625` | Collect/rehydrate expanded paths (move to a pure helper) |

Suggested shape: one `FoldState = { policy, overrides: Set<Key> }` with commands `toggle | set | subtree | depth(n) | level(k) | reveal(key) | focus(keys)` over a `TreeAdapter { id, parent, children, depth }`. S4/S6/S7 adapters are synchronous; S5/S6 need an async `loadChildren` hook for recursive expand.

## 9. Uncatalogued behaviors

| Proposed ID | Behavior | Evidence |
|---|---|---|
| F-ADJ-06 | Hoist / focus mode: show only a subtree as the new root, with a breadcrumb "freeze strip"; distinct from fold and from F-SCOPE-08 | `components/MindmapCanvas.vue:396-447`, `lib/mindmap-focus.ts` |
| F-ACTION-07 | Spring-loaded expand: hovering a collapsed folder during drag expands it after 600 ms | `components/FileTree.vue:1218-1232` |
| F-STATE-09 | Load-time fold reset: persisted flags are overwritten by a "open collapsed" view default | `components/MindmapCanvas.vue:208` (commit 61c4539c) |
| F-STATE-10 | Fold state carried across documents: plain editor `plainFolds` is not reset on tab switch, so `remapFolds` can re-attach folds to same-titled headings in the next tab (inferred) | `components/Editor.vue:454,514-521,3643-3660` |
| F-ADJ-07 | Fold kill switch: a setting disables folding and clears state | `stores/settings.ts:345-349,742`, `components/Editor.vue:3868-3871` |
| F-ADJ-08 | Fold gestures by modifier: ⌘/Ctrl-click on expander = recursive | `ME:1134` |
| F-ADJ-09 | Agent-facing depth cut: MCP `mmap_outline` truncates at a depth and prints "(+N)" for hidden children (text-only F-SCOPE-04 + F-ADJ-03) | `mcp-mindmap/src/server.ts:33-37`, `mcp-mindmap/src/tools/read.ts:11-14` |
| F-SEL-10 | Hidden selection excluded from batch ops: collapsing a parent silently removes selected descendants from the next action | `components/MindmapFolderTree.vue:50,100-102` |
| F-A11Y-01 | Tree semantics: `role=tree`, `treeitem`, `aria-expanded`, arrow-key navigation. Present only in S6 (no arrows anywhere) | `components/MindmapFolderTree.vue:221-233` |
| F-MODEL-04 | Fold scope independent of content kind: `fold.none` also unfolds code blocks and tables, not only headings | `composables/useCommands.ts:427-431` |
