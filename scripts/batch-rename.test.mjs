import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const SCRIPT_PATH = path.join(import.meta.dirname, 'batch-rename.mjs');

async function createFixture(fileNames) {
  const directoryPath = await mkdtemp(path.join(tmpdir(), 'batch-rename-'));

  await Promise.all(
    fileNames.map((fileName) => writeFile(path.join(directoryPath, fileName), 'fixture')),
  );

  return directoryPath;
}

function runBatchRename(args, cwd = process.cwd()) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

test('removes literal patterns and cleans separators around the removed text', async () => {
  const directoryPath = await createFixture([
    'file1-www.ynet.co.il.md',
    'file2-pattern-example.md',
    'file3-ynet.co.il.md',
    'file4 pattern .epub',
    'file5,pattern-example',
    'file6-(-)-pattern-example.md',
  ]);

  const result = runBatchRename([directoryPath, 'www.ynet.co.il|pattern']);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await readdir(directoryPath)).sort(), [
    'file1.md',
    'file2-example.md',
    'file3-ynet.co.il.md',
    'file4.epub',
    'file5-example',
    'file6-example.md',
  ]);
});

test('accepts space-delimited positional patterns and repeated pattern flags', async () => {
  const directoryPath = await createFixture([
    'one-ALPHA.md',
    'two_beta.md',
    'three,gamma.md',
  ]);

  const result = runBatchRename([
    directoryPath,
    'alpha beta',
    '-p',
    'gamma',
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await readdir(directoryPath)).sort(), [
    'one.md',
    'three.md',
    'two.md',
  ]);
});

test('dry-run reports renames without changing files', async () => {
  const directoryPath = await createFixture(['report-pattern.md']);

  const result = runBatchRename([directoryPath, 'pattern', '--dry-run']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /report-pattern\.md -> report\.md/);
  assert.deepEqual(await readdir(directoryPath), ['report-pattern.md']);
});

test('recursive mode renames files below the selected folder', async () => {
  const directoryPath = await createFixture([]);
  const nestedPath = path.join(directoryPath, 'nested');
  await mkdir(nestedPath);
  await writeFile(path.join(nestedPath, 'chapter-pattern.md'), 'fixture');

  const result = runBatchRename([directoryPath, 'pattern', '-rd']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /chapter-pattern\.md -> chapter\.md/);
  assert.deepEqual(await readdir(nestedPath), ['chapter-pattern.md']);
});

test('skips a rename when the destination already exists', async () => {
  const directoryPath = await createFixture(['report-pattern.md', 'report.md']);

  const result = runBatchRename([directoryPath, 'pattern']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /destination already exists/i);
  assert.deepEqual((await readdir(directoryPath)).sort(), [
    'report-pattern.md',
    'report.md',
  ]);
});

test('accepts a relative folder path', async () => {
  const directoryPath = await createFixture(['notes-pattern.md']);
  const parentPath = path.dirname(directoryPath);
  const relativePath = path.basename(directoryPath);

  const result = runBatchRename([relativePath, 'pattern'], parentPath);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await readdir(directoryPath), ['notes.md']);
});

test('removes a JavaScript regex match while preserving single spaces', async () => {
  const directoryPath = await createFixture([
    'מי אתה 1b5279b1842f80ca90b5e3fa9140b0cf.md',
  ]);

  const result = runBatchRename([directoryPath, '--reg', '1b52[^ ]*']);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await readdir(directoryPath), ['מי אתה.md']);
});

test('combines literal patterns with repeated regex patterns', async () => {
  const directoryPath = await createFixture(['file-alpha-123-beta.md']);

  const result = runBatchRename([
    directoryPath,
    'alpha',
    '--reg',
    '\\d+',
    '--reg',
    'beta',
  ]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(await readdir(directoryPath), ['file.md']);
});

test('rejects an invalid regex before renaming files', async () => {
  const directoryPath = await createFixture(['report-pattern.md']);

  const result = runBatchRename([directoryPath, '--reg', '[']);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /invalid regular expression/i);
  assert.deepEqual(await readdir(directoryPath), ['report-pattern.md']);
});
