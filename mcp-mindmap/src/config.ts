export interface ServerConfig { workspace: string; allowWrite: boolean }

const WORKSPACE_FLAG = '--workspace';
const ALLOW_WRITE_FLAG = '--allow-write';

export function parseArgs(argv: readonly string[], cwd: string = process.cwd()): ServerConfig {
  const at = argv.indexOf(WORKSPACE_FLAG);
  const workspace = at >= 0 ? argv[at + 1] : cwd;
  if (!workspace) throw new Error(`Missing value for ${WORKSPACE_FLAG} <dir>`);
  return { workspace, allowWrite: argv.includes(ALLOW_WRITE_FLAG) };
}
