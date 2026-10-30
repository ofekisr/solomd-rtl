import { existsSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { BASELINE_PATH, loadBaseline, serializeBaseline } from './baseline-file.ts';
import type { Baseline } from './baseline.schema.ts';
import { checkFileSize, collectFileSize } from './file-size.rule.ts';
import { checkLibPurity, collectLibPurity } from './lib-purity.rule.ts';
import { checkRawIpc, collectRawIpc } from './raw-ipc.rule.ts';
import { REPO_ROOT } from './scan.ts';

const INIT_FLAG = '--init';
const EXIT_OK = 0;
const EXIT_REFUSED = 1;

export interface RebaselineResult {
  readonly baseline: Baseline;
  readonly increases: string[];
}

export function measure(repoRoot: string): Baseline {
  return {
    version: 1,
    fileSize: collectFileSize(repoRoot),
    rawIpc: collectRawIpc(repoRoot),
    libPurity: collectLibPurity(repoRoot),
  };
}

export function rebaseline(previous: Baseline, measured: Baseline): RebaselineResult {
  const increases = [
    ...checkFileSize(measured.fileSize, previous.fileSize),
    ...checkRawIpc(measured.rawIpc, previous.rawIpc),
    ...checkLibPurity(measured.libPurity, previous.libPurity),
  ];
  return { baseline: shrink(previous, measured), increases };
}

function shrink(previous: Baseline, measured: Baseline): Baseline {
  const kept = Object.keys(previous.fileSize).filter((path) => measured.fileSize[path] !== undefined);
  return {
    version: 1,
    fileSize: Object.fromEntries(kept.map((path) => [path, Math.min(previous.fileSize[path], measured.fileSize[path])])),
    rawIpc: previous.rawIpc.filter((path) => measured.rawIpc.includes(path)),
    libPurity: previous.libPurity.filter((path) => measured.libPurity.includes(path)),
  };
}

function summary(baseline: Baseline): string {
  return `fileSize ${Object.keys(baseline.fileSize).length}, rawIpc ${baseline.rawIpc.length}, libPurity ${baseline.libPurity.length}`;
}

function init(measured: Baseline): number {
  if (existsSync(BASELINE_PATH)) {
    console.error(`${BASELINE_PATH} exists. ${INIT_FLAG} only creates it; run without ${INIT_FLAG} to shrink it.`);
    return EXIT_REFUSED;
  }
  writeFileSync(BASELINE_PATH, serializeBaseline(measured));
  console.log(`baseline created: ${summary(measured)}`);
  return EXIT_OK;
}

function main(args: readonly string[]): number {
  const measured = measure(REPO_ROOT);
  if (args.includes(INIT_FLAG)) return init(measured);
  const { baseline, increases } = rebaseline(loadBaseline(), measured);
  if (increases.length > 0) {
    console.error([...increases, 'rebaseline refused: baseline values may only go down.'].join('\n'));
    return EXIT_REFUSED;
  }
  writeFileSync(BASELINE_PATH, serializeBaseline(baseline));
  console.log(`baseline updated: ${summary(baseline)}`);
  return EXIT_OK;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
