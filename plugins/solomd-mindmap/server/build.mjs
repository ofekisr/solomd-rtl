#!/usr/bin/env node
import { createRequire } from 'node:module';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'dist/index.mjs');
const EXECUTABLE = 0o755;
const HASHBANG = /^#!.*\n/m;
const { build } = createRequire(join(HERE, '../../../app/package.json'))('esbuild');

async function bundle() {
  const result = await build({
    entryPoints: [join(HERE, 'src/index.ts')],
    outfile: OUT,
    absWorkingDir: HERE,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
    legalComments: 'none',
    logLevel: 'warning',
    write: false,
  });
  const body = result.outputFiles[0].text.replace(HASHBANG, '');
  return `#!/usr/bin/env node\n${body}`;
}

function check(text) {
  if (existsSync(OUT) && readFileSync(OUT, 'utf8') === text) return;
  console.error('dist/index.mjs is stale: run pnpm --dir plugins/solomd-mindmap/server build');
  process.exit(1);
}

function write(text) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  chmodSync(OUT, EXECUTABLE);
}

const text = await bundle();
if (process.argv.includes('--check')) check(text);
else write(text);
