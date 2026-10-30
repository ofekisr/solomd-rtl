import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EXPECTED_DIR, NONE_CASE, captureStoreState, listBlobNames, readBlob } from './__fixtures__/golden-capture.fixture.ts';

const MIN_BLOB_CASES = 8;

function readExpected(name: string): unknown {
  return JSON.parse(readFileSync(`${EXPECTED_DIR}${name}.json`, 'utf8'));
}

test(`${NONE_CASE}: no stored blob yields defaults and hadStoredSettings() false`, async () => {
  const { state, hadStored } = await captureStoreState(null);
  assert.deepEqual(state, readExpected(NONE_CASE));
  assert.equal(hadStored, false);
});

test('at least the eight pre-wave blobs are present', () => {
  assert.ok(listBlobNames().length >= MIN_BLOB_CASES);
});

for (const name of listBlobNames()) {
  test(`${name}: store state equals the captured expected output`, async () => {
    const { state, hadStored } = await captureStoreState(readBlob(name));
    assert.deepEqual(state, readExpected(name));
    assert.equal(hadStored, true);
  });
}
