import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build, type Plugin } from 'esbuild';
import { EditorState } from '@codemirror/state';
import { EditorView, type DecorationSet } from '@codemirror/view';

type LiveBlocksFn = (opts?: Record<string, unknown>) => unknown;
let liveBlocksExtension: LiveBlocksFn;
let bundlePath = '';

// cm-live-blocks.ts uses extensionless imports, TS parameter properties and
// CSS imports, none of which node's type stripping runs. Bundle it with
// esbuild (packages stay external) and import the result.
const stubCss: Plugin = {
  name: 'stub-css',
  setup(b) {
    b.onResolve({ filter: /\.css$/ }, (a) => ({ path: a.path, namespace: 'stub-css' }));
    b.onLoad({ filter: /.*/, namespace: 'stub-css' }, () => ({ contents: '', loader: 'js' }));
  },
};

before(async () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const appRoot = resolve(here, '..', '..');
  const outDir = join(appRoot, 'node_modules', '.cache', 'live-blocks-test');
  mkdirSync(outDir, { recursive: true });
  const outfile = join(outDir, `bundle-${process.pid}.mjs`);
  bundlePath = outfile;
  await build({
    entryPoints: [join(here, 'cm-live-blocks.ts')],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    packages: 'external',
    plugins: [stubCss],
    logLevel: 'silent',
  });
  const mod = (await import(pathToFileURL(outfile).href)) as { liveBlocksExtension: LiveBlocksFn };
  liveBlocksExtension = mod.liveBlocksExtension;
});

after(() => {
  if (bundlePath) rmSync(bundlePath, { force: true });
});

interface Deco { from: number; to: number; widget: string | null; block: boolean; kind: string }

function decos(doc: string, cursor = 0, opts: Record<string, unknown> = {}): Deco[] {
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: liveBlocksExtension(opts) as never,
  });
  const out: Deco[] = [];
  for (const source of state.facet(EditorView.decorations)) {
    if (typeof source === 'function') continue; // view-dependent sources are skipped
    (source as DecorationSet).between(0, state.doc.length, (from, to, d) => {
      const spec = d.spec as { widget?: object; class?: string; block?: boolean };
      out.push({
        from,
        to,
        widget: spec.widget ? spec.widget.constructor.name : null,
        block: !!spec.block,
        kind: spec.widget ? 'widget' : (spec.class ?? 'mark'),
      });
    });
  }
  return out;
}

const widgets = (ds: Deco[]): string[] => ds.filter((d) => d.widget).map((d) => d.widget as string);

const TABLE = '| a | b |\n|---|---|\n| 1 | 2 |\n';

test('GFM table renders as a block widget when the cursor is elsewhere', () => {
  const doc = `intro\n\n${TABLE}\nafter`;
  assert.ok(decos(doc, 0).some((d) => d.widget === 'TableWidget' && d.block));
});

test('cursor inside the table keeps its source', () => {
  const doc = `intro\n\n${TABLE}\nafter`;
  assert.ok(!decos(doc, doc.indexOf('| 1')).some((d) => d.widget === 'TableWidget'));
});

test('image line renders as ImageWidget, cursor on it keeps source', () => {
  const doc = 'text\n\n![alt](pic.png)\n\nmore';
  const ds = decos(doc, 0);
  const img = ds.filter((d) => d.widget === 'ImageWidget');
  assert.equal(img.length, 1);
  assert.equal(img[0].block, true);
  assert.equal(img[0].from, doc.indexOf('!['));
  assert.equal(img[0].to, doc.indexOf(')') + 1);
  assert.deepEqual(widgets(decos(doc, doc.indexOf('!['))), []);
});

test('$$ block math renders as MathWidget', () => {
  const doc = 'a\n\n$$\nx^2\n$$\n\nb';
  assert.deepEqual(widgets(decos(doc, 0)), ['MathWidget']);
  assert.deepEqual(widgets(decos(doc, doc.indexOf('x^2'))), []);
});

test('single-line $$..$$ renders as MathWidget', () => {
  assert.deepEqual(widgets(decos('a\n\n$$x^2+1$$\n\nb', 0)), ['MathWidget']);
});

test('inline $x$ renders as InlineMathWidget, not a block', () => {
  const ds = decos('a\n\nvalue $x$ here\n\nb', 0);
  assert.deepEqual(widgets(ds), ['InlineMathWidget']);
  assert.equal(ds[0].block, false);
});

test('inline math reveals when cursor is on its line', () => {
  const doc = 'a\n\nvalue $x$ here\n\nb';
  assert.deepEqual(widgets(decos(doc, doc.indexOf('value'))), []);
});

test('```mermaid fence renders as a moded diagram wrapper', () => {
  const doc = 'a\n\n```mermaid\ngraph TD; A-->B\n```\n\nb';
  const ds = decos(doc, 0);
  assert.deepEqual(widgets(ds), ['ModedDiagramWidget']);
  assert.equal(ds[0].block, true);
  assert.deepEqual(widgets(decos(doc, doc.indexOf('graph'))), []);
});

test('```dot fence renders as a moded diagram wrapper', () => {
  const doc = 'a\n\n```dot\ndigraph { a -> b }\n```\n\nb';
  assert.deepEqual(widgets(decos(doc, 0)), ['ModedDiagramWidget']);
});

test('```plantuml renders only when enabled with a server', () => {
  const doc = 'a\n\n```plantuml\nA -> B\n```\n\nb';
  const on = { getPlantuml: () => ({ enabled: true, server: 'https://x' }) };
  const off = { getPlantuml: () => ({ enabled: false, server: 'https://x' }) };
  assert.deepEqual(widgets(decos(doc, 0, on)), ['PlantumlWidget']);
  assert.deepEqual(widgets(decos(doc, 0, off)), []);
  assert.deepEqual(widgets(decos(doc, 0)), []);
});

test('```mindmap fence', () => {
  const doc = 'a\n\n```mindmap\n- root\n  - child\n```\n\nb';
  const ds = decos(doc, 0);
  assert.deepEqual(widgets(ds), ['MindmapWidget']);
  assert.equal(ds[0].block, true);
});

test('```tldraw fence renders even with the cursor inside', () => {
  const doc = 'a\n\n```tldraw id=b1\n{}\n```\n\nb';
  assert.deepEqual(widgets(decos(doc, 0)), ['TldrawWidget']);
  assert.deepEqual(widgets(decos(doc, doc.indexOf('{}'))), ['TldrawWidget']);
});

test('HTML block renders as HtmlBlockWidget', () => {
  const doc = 'a\n\n<div>\nhi\n</div>\n\nb';
  assert.deepEqual(widgets(decos(doc, 0)), ['HtmlBlockWidget']);
  assert.deepEqual(widgets(decos(doc, doc.indexOf('hi'))), []);
});

test('keepSource: nothing replaced, image renders below its source line', () => {
  const keep = { keepSource: () => true };
  const doc = `a\n\n![alt](pic.png)\n\n${TABLE}\n$$x$$\n\n<div>\nhi\n</div>\n\nb`;
  const ds = decos(doc, 0, keep);
  assert.deepEqual(widgets(ds), ['ImageWidget']);
  const lineEnd = doc.indexOf('\n', doc.indexOf('!['));
  assert.deepEqual(
    ds.map((d) => ({ from: d.from, to: d.to, block: d.block })),
    [{ from: lineEnd, to: lineEnd, block: true }],
  );
});
