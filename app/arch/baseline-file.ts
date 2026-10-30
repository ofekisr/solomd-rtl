import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Baseline, parseBaseline } from './baseline.schema.ts';

export const BASELINE_PATH = fileURLToPath(new URL('./baseline.json', import.meta.url));

const JSON_INDENT = 2;

export function loadBaseline(path: string = BASELINE_PATH): Baseline {
  return parseBaseline(JSON.parse(readFileSync(path, 'utf8')));
}

export function serializeBaseline(baseline: Baseline): string {
  const sorted: Baseline = {
    version: baseline.version,
    fileSize: Object.fromEntries(Object.entries(baseline.fileSize).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    rawIpc: [...baseline.rawIpc].sort(),
    libPurity: [...baseline.libPurity].sort(),
    featurePurity: [...baseline.featurePurity].sort(),
  };
  return `${JSON.stringify(sorted, null, JSON_INDENT)}\n`;
}
