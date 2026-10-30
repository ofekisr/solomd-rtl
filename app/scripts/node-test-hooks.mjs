import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const STUB_SOURCE = 'export default {};';
const STUB_SUFFIX = '?node-test-stub';
const STUB_PATTERN = /\.(vue|css)(\?.*)?$/;
const QUERY = /\?.*$/;
const IS_PATH_SPECIFIER = /^(\.{1,2}\/|\/|file:)/;
const HAS_EXTENSION = /\.\w+$/;
// CodeMirror exports DecorationSet only as a type; strip-only Node keeps a value-style import of it
// (lib/cm/ai-rewrite.ts imports it without `type`). Delete this hack once those imports say `type`.
const TYPE_AS_VALUE_IMPORT = /(import\s*\{[^}]*?)(?<!type\s)\bDecorationSet,\s*([^}]*\}\s*from\s*'@codemirror\/view')/;

async function resolveStub(specifier, context, next) {
  const resolved = await next(specifier.replace(QUERY, ''), context);
  return { url: `${resolved.url}${STUB_SUFFIX}`, shortCircuit: true };
}

export async function resolve(specifier, context, next) {
  if (STUB_PATTERN.test(specifier)) return resolveStub(specifier, context, next);
  try {
    return await next(specifier, context);
  } catch (error) {
    if (!IS_PATH_SPECIFIER.test(specifier) || HAS_EXTENSION.test(specifier)) throw error;
    return next(`${specifier}.ts`, context).catch(() => next(`${specifier}/index.ts`, context));
  }
}

export async function load(url, context, next) {
  if (url.endsWith(STUB_SUFFIX)) return { format: 'module', source: STUB_SOURCE, shortCircuit: true };
  if (url.includes('/src/') && url.endsWith('.ts') && !url.includes('node_modules')) {
    const source = readFileSync(fileURLToPath(url), 'utf8');
    if (TYPE_AS_VALUE_IMPORT.test(source)) {
      const stripped = stripTypeScriptTypes(source, { mode: 'transform' });
      return { format: 'module', source: stripped.replace(TYPE_AS_VALUE_IMPORT, '$1$2'), shortCircuit: true };
    }
  }
  return next(url, context);
}
