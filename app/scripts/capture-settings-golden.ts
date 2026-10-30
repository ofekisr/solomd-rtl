import { mkdirSync, writeFileSync } from 'node:fs';
import { EXPECTED_DIR, NONE_CASE, captureStoreState, listBlobNames, readBlob } from '../src/features/settings/internal/useGoldenCapture.ts';

const JSON_INDENT = 2;

async function writeExpected(name: string, blob: string | null): Promise<void> {
  const { state } = await captureStoreState(blob);
  writeFileSync(`${EXPECTED_DIR}${name}.json`, `${JSON.stringify(state, null, JSON_INDENT)}\n`);
  console.log(`captured ${name}: ${Object.keys(state).length} keys`);
}

mkdirSync(EXPECTED_DIR, { recursive: true });
const only = process.argv.slice(2);
const isSelected = (name: string): boolean => only.length === 0 || only.includes(name);
if (isSelected(NONE_CASE)) await writeExpected(NONE_CASE, null);
for (const name of listBlobNames().filter(isSelected)) await writeExpected(name, readBlob(name));
