import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serializeBaseline } from './baseline-file.ts';
import { parseBaseline } from './baseline.schema.ts';

const VALID = {
  version: 1,
  fileSize: { 'app/src/components/Editor.vue': 5026 },
  rawIpc: ['app/src/App.vue'],
  libPurity: ['app/src/lib/saf-fs.ts'],
  featurePurity: ['app/src/features/find/internal/cm-find-panel.ts'],
};

test('accepts a valid baseline', () => {
  assert.deepEqual(parseBaseline(VALID), VALID);
});

test('rejects negative or zero line counts', () => {
  assert.throws(() => parseBaseline({ ...VALID, fileSize: { 'app/src/a.ts': -1 } }));
  assert.throws(() => parseBaseline({ ...VALID, fileSize: { 'app/src/a.ts': 0 } }));
});

test('rejects absolute and parent-relative paths', () => {
  assert.throws(() => parseBaseline({ ...VALID, rawIpc: ['/Users/x/app/src/a.ts'] }));
  assert.throws(() => parseBaseline({ ...VALID, libPurity: ['C:/repo/a.ts'] }));
  assert.throws(() => parseBaseline({ ...VALID, fileSize: { '/abs/a.ts': 500 } }));
  assert.throws(() => parseBaseline({ ...VALID, rawIpc: ['app/../secrets.ts'] }));
});

test('rejects an unknown version or extra keys', () => {
  assert.throws(() => parseBaseline({ ...VALID, version: 2 }));
  assert.throws(() => parseBaseline({ ...VALID, extra: true }));
});

test('serializeBaseline sorts keys and arrays and ends with a newline', () => {
  const text = serializeBaseline({
    version: 1,
    fileSize: { 'b.ts': 500, 'a.ts': 450 },
    rawIpc: ['z.ts', 'a.ts'],
    libPurity: [],
    featurePurity: [],
  });
  assert.equal(text, [
    '{',
    '  "version": 1,',
    '  "fileSize": {',
    '    "a.ts": 450,',
    '    "b.ts": 500',
    '  },',
    '  "rawIpc": [',
    '    "a.ts",',
    '    "z.ts"',
    '  ],',
    '  "libPurity": [],',
    '  "featurePurity": []',
    '}',
    '',
  ].join('\n'));
});

test('serializeBaseline orders fileSize keys by code unit (uppercase first)', () => {
  const text = serializeBaseline({
    version: 1,
    fileSize: { 'a.ts': 450, 'B.ts': 500 },
    rawIpc: [],
    libPurity: [],
    featurePurity: [],
  });
  assert.ok(text.indexOf('"B.ts"') < text.indexOf('"a.ts"'));
});

test('a baseline without featurePurity is rejected', () => {
  const { featurePurity: _omitted, ...legacy } = VALID;
  assert.throws(() => parseBaseline(legacy));
});
