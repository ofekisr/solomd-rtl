# `.full.md` Block Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task, or superpowers:subagent-driven-development if the user chooses delegation.
> Steps use checkbox syntax for tracking.

**Goal:** Automatically display one numbered badge per content block in the preview of `.full.md` files, without changing their contents.

**Architecture:** Add a filename predicate and a token-based block-decoration helper to the existing Markdown preview flow.
Pass an explicit preview-only rendering option; the default render path stays unchanged.
The helper remains usable by a future virtual-type registry, but this change introduces no registry or imported definitions.

**Tech Stack:** Existing Vue 3, TypeScript, markdown-it, DOMPurify, CSS, and Node test/self-test conventions.

**Spec:** The scoped contract below implements the user's `.full.md` example.
The [broader virtual-type design](../design/2026-10-01-virtual-file-types-design.md) remains background for a later, second use case.

## Scope and Counting Contract

This plan targets preview badges only.
A fixed Explorer filter is a separate optional scope addition awaiting the user's preference; it is not an execution dependency of the badge work.
Keep the existing extension filtering for now.
When another virtual-type case appears, revisit imported definitions, renderer profiles, and virtual-type filters in the broader design.

| Construct | Badge count |
|---|---|
| H1, blank lines, divider | Zero |
| H2–H6 or one paragraph with any number of lines | One |
| Whole table | One |
| Whole ordered, unordered, or task list | One |
| Whole quote or callout | One |
| Whole fenced or indented code block, including diagram fences | One |
| Display math or source-backed HTML block | One |
| Frontmatter, generated TOC, generated footnotes | Zero |

Consecutive indented code lines belong to one code block and receive one badge in total.
A blank line within that code block does not create another badge when Markdown still parses it as one block.
Indentation inside a list is interpreted in its list context, and receives no extra number.
All nested content stays in its outer list or quote; this is the proposed nesting default carried from the broader design.
Two lists separated by a paragraph are separate blocks.
Number from 1 across the document; H1 and dividers do not reset numbering.
The filename comparison is case-insensitive and uses the basename, not directory names.

## Global Constraints

- The source document is never modified by classification or numbering.
- Badges appear in split preview and reading mode; source editing, live editor decorations, copying, and exports retain their existing output.
- Use logical CSS positioning for Hebrew/Arabic RTL as well as LTR.
- Decorations pass through the current final HTML sanitizer.
- Preserve source-line mappings and existing plugins.
- Add no runtime dependencies or persistent settings for this first case.

## Review Focus

- Loose or nested lists and quotes containing several paragraphs must remain one outer block.
- Several indented code lines, including an internal blank line, must receive one badge.
- Alternating numbered and default renders must not leak numbering into other tabs or exports.
- Generated TOC/footnote sections must not consume numbers, and existing source-line metadata must survive.
- Copying a selection that begins inside a numbered wrapper must preserve content without decoration metadata.

## Delivery Steps

1. Add and test filename matching and whole-block decoration.
2. Connect `.full.md` detection to preview and add the badge appearance.
3. Verify copying, default renders, RTL, reading mode, and editing updates.

Estimated implementation and verification: 3–5 engineering hours, with the existing dependencies available.

## Appendix — Implementation Detail (+5 Minutes)

### Task 1: Whole-Block Decoration

**Files:**

- Create `app/src/lib/markdown-block-badges.ts`.
- Create `app/src/lib/markdown-block-badges.test.ts` and `app/src/lib/markdown-block-badges.selftest.mjs`.
- Modify `app/src/lib/markdown.ts`, specifically the option signature and rendering call in `renderMarkdown`.

**Interfaces:**

- Produce `isFullMdFile(filePath: string | undefined): boolean`.
- Produce `renderNumberedBlocks(tokens: Token[], render: (tokens: Token[]) => string): string`.
- Extend `renderMarkdown` options with `blockNumbers?: boolean`, defaulting to false.
- Consume the existing markdown-it token stream and renderer; no filesystem operations occur in this helper.

- [ ] Write the following test skeleton and the additional counting cases listed below it.

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFullMdFile } from './markdown-block-badges.ts';
import { renderMarkdown } from './markdown.ts';

function numbers(source: string): number[] {
  const html = renderMarkdown(source, { blockNumbers: true });
  return [...html.matchAll(/data-block-number="(\d+)"/g)]
    .map((match) => Number(match[1]));
}

test('only matching basenames enable numbering', () => {
  assert.equal(isFullMdFile('/books/ch01.FULL.MD'), true);
  assert.equal(isFullMdFile('/books.full.md/ch01.md'), false);
  assert.equal(isFullMdFile('/books/ch01.full.md.bak'), false);
  assert.equal(isFullMdFile(undefined), false);
});

test('one indented code block, not one badge per line', () => {
  const source = '    first\n    second\n\n    third\n';
  assert.deepEqual(numbers(source), [1]);
});

test('exclude H1 and divider, count H2 and whole list', () => {
  const source = '# Title\n\nText\n\n---\n\n## Section\n\n- A\n- B';
  assert.deepEqual(numbers(source), [1, 2, 3]);
});

test('nested list and multi-paragraph quote stay grouped', () => {
  assert.deepEqual(numbers('- A\n  - nested\n- B'), [1]);
  assert.deepEqual(numbers('> First\n>\n> Second'), [1]);
});

test('default renderer stays free of badges after numbered render', () => {
  assert.deepEqual(numbers('Text'), [1]);
  assert.doesNotMatch(renderMarkdown('Text'), /data-block-number/);
});

test('whole-block cases and generated sections', () => {
  const cases: Array<[string, number[]]> = [
    ['| A | B |\n| --- | --- |\n| 1 | 2 |', [1]],
    ['```text\nfirst\nsecond\n```', [1]],
    ['- First\n\n    continuation\n\n- Second', [1]],
    ['- A\n\nParagraph\n\n- B', [1, 2, 3]],
    ['Title\n=====\n\nBody', [1]],
    ['---\ntitle: Book\n---\n\nBody', [1]],
    ['# Title\n\n[TOC]\n\n## Section\n\nBody', [1, 2]],
    ['Body[^1]\n\n[^1]: Generated footnote', [1]],
  ];
  for (const [source, expected] of cases) {
    assert.deepEqual(numbers(source), expected, source);
  }
});

test('preserve source-line mappings and reset per document', () => {
  const source = '# Title\n\nBody';
  const html = renderMarkdown(source, { blockNumbers: true });
  assert.match(html, /data-source-line="3"/);
  assert.deepEqual(numbers('Second document'), [1]);
});
```

These fixture assertions cover the counting rules and source-line preservation without duplicating the helper's implementation.
Browser verification in Task 3 additionally checks the actual tab contents and save output, where mutation would be observable.

Create the self-test runner using the existing loader:

```javascript
import { register } from 'node:module';
register(new URL('./relationships.selftest-loader.mjs', import.meta.url));
await import('./markdown-block-badges.test.ts');
```

- [ ] Run `node --experimental-strip-types src/lib/markdown-block-badges.selftest.mjs` from `app/`; expect failure because the helper or option does not yet exist.
- [ ] Implement the helper with this token-range approach.

```typescript
import type Token from 'markdown-it/lib/token.mjs';

const FIRST_BLOCK_NUMBER = 1;
const COUNTED_TYPES = new Set([
  'paragraph_open', 'heading_open', 'bullet_list_open',
  'ordered_list_open', 'blockquote_open', 'table_open',
  'fence', 'code_block', 'html_block', 'math_block',
]);

export function isFullMdFile(filePath: string | undefined): boolean {
  const name = filePath?.split(/[\\/]/).pop();
  return name?.toLowerCase().endsWith('.full.md') ?? false;
}

function endOfBlock(tokens: Token[], start: number): number {
  if (tokens[start].nesting !== 1) return start + 1;
  let depth = 0;
  for (let index = start; index < tokens.length; index += 1) {
    depth += tokens[index].nesting;
    if (depth === 0) return index + 1;
  }
  return tokens.length;
}

function isCounted(token: Token): boolean {
  return token.map !== null && COUNTED_TYPES.has(token.type)
    && !(token.type === 'heading_open' && token.tag === 'h1');
}

export function renderNumberedBlocks(
  tokens: Token[],
  render: (tokens: Token[]) => string,
): string {
  let number = FIRST_BLOCK_NUMBER;
  let output = '';
  for (let start = 0; start < tokens.length;) {
    const end = endOfBlock(tokens, start);
    const html = render(tokens.slice(start, end));
    output += isCounted(tokens[start])
      ? `<div class="full-md-block" data-block-number="${number++}">${html}</div>`
      : html;
    start = end;
  }
  return output;
}
```

The nesting scan consumes a complete outer container, so children are never numbered separately.
The allowlist excludes generated navigation and footnote containers, even when their tokens carry metadata.
Each wrapper contains whole elements, preserving valid list and table markup.

Import the helper in `markdown.ts`, extend the existing options type, and replace only the existing `body = md.render(normalized, env)` line inside its current try/finally block:

```typescript
if (options?.blockNumbers) {
  const tokens = md.parse(normalized, env);
  body = renderNumberedBlocks(
    tokens,
    (chunk) => md.renderer.render(chunk, md.options, env),
  );
} else {
  body = md.render(normalized, env);
}
```

Retain frontmatter handling, break-option restoration, and final sanitization exactly where they are.

- [ ] Run the new self-test and `node --experimental-strip-types src/lib/markdown-tables.selftest.mjs` from `app/`; expect both suites to pass.
- [ ] Commit only this task's files with `feat(preview): add whole-block numbering option` when executing the approved plan.

### Task 2: Automatic `.full.md` Preview Badges

**Files:** Modify `app/src/components/Preview.vue`.

**Interfaces:** Consume `isFullMdFile` and the `blockNumbers` render option from Task 1.
Existing `filePath` props already reach split preview and reading mode.

- [ ] Confirm the current preview of a mixed-block `.full.md` fixture has no badges.
- [ ] Import `isFullMdFile` and change the existing computed HTML call to pass the opt-in option:

```typescript
return rewriteImageUrls(
  renderMarkdown(source, { blockNumbers: isFullMdFile(props.filePath) }),
  extractImageRoot(source),
  props.filePath,
);
```

Add a conditional `preview-content--full-md` class to the article using the same predicate.
Use a CSS-generated badge so numbers are not DOM text nodes and cannot enter plain-text copying.

```css
.preview-content--full-md {
  padding-inline-start: 3rem;
}

.preview-content .full-md-block {
  position: relative;
  display: flow-root;
}

.preview-content .full-md-block::before {
  content: attr(data-block-number);
  position: absolute;
  inset-inline-end: calc(100% + 0.5rem);
  inset-block-start: 0.25rem;
  min-inline-size: 1.5rem;
  padding: 0.1rem 0.3rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.3;
  text-align: center;
  white-space: nowrap;
  pointer-events: none;
  user-select: none;
}
```

Adjust the full-md gutter rule to coexist with the existing reading skin and narrow viewport rules.
`display: flow-root` contains child margins; compare paragraph/list spacing with the normal preview and adjust wrapper spacing if needed.
Test multi-digit badges at zoom rather than assuming the example gutter fits every document.

- [ ] Verify the mixed-block fixture and an ordinary `.md` file side by side; only the matching file receives badges.
- [ ] Verify reading mode, Hebrew RTL, diagram rendering, task checkboxes, and double-click math editing with the wrappers present.
- [ ] Commit this task's file with `feat(preview): show block badges for full markdown files` when executing the approved plan.

### Task 3: Copy and Regression Verification

**Files:** Modify `app/src/components/Preview.vue`; extend `app/src/lib/markdown-block-badges.test.ts`.

**Interfaces:** No new application API.
The generated wrapper class and `data-block-number` attribute are the decoration markers.

- [ ] Copy across paragraphs and a table in a numbered preview; inspect both clipboard formats before the fix and verify whether wrapper metadata is present.
- [ ] Update `onPreviewCopy` so its early return checks for either a table or numbered wrappers, then unwrap decoration elements before its existing table-style loop:

```typescript
const hasNumberedSelection =
  isFullMdFile(props.filePath) &&
  host.value?.contains(range.commonAncestorContainer);
if (!hasNumberedSelection &&
    !frag.querySelector('table, .full-md-block')) return;
const wrap = document.createElement('div');
wrap.appendChild(frag);
for (const block of Array.from(wrap.querySelectorAll('.full-md-block'))) {
  block.replaceWith(...Array.from(block.childNodes));
}
```

Preserve the existing clipboard HTML table styling and plain-text selection path.
The context check handles a selection entirely inside a block, whose cloned fragment may omit the wrapper.
CSS-generated badge content contributes no DOM text; verify actual macOS clipboard behavior rather than relying only on that assumption.

- [ ] Run the render tests for consecutive numbered renders beginning at 1 and alternating numbered/default renders; verify unchanged saved content in the smoke-check matrix.
- [ ] Run the new self-test, existing Markdown table self-test, and `npx vue-tsc --noEmit` from `app/`.
- [ ] Complete the smoke-check matrix below and commit the targeted changes with `fix(preview): keep block decorations out of copied markup` when executing the approved plan.

| Check | Expected result |
|---|---|
| Add or remove a paragraph | Following badges renumber automatically |
| Rename to or from `.full.md` | Preview follows the reactive file path |
| Switch between two documents | Each numbered document begins at 1 |
| Copy from inside a block or across blocks | Text and tables survive; badges and their metadata do not |
| Export HTML, PDF, image, or DOCX | Export contains no block badges; verify the export path does not capture the decorated live preview |
| Save a numbered document | File contents contain no badge text or markup |
| RTL, narrow viewport, 200% zoom, multi-digit number | Badge stays visible without covering content |
| Scroll synchronization and outline following | Source-line behavior still works |

### Later Extension Boundary

Once a second use case arrives, replace the `.full.md` predicate at the preview call site with the broader registry's resolved presentation.
Reuse the tested token helper and preview-only option.
Add import management and virtual-type filtering then, guided by the separate broader design.
Do not prebuild those components for this single case.
