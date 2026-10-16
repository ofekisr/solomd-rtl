export interface ServerConfig { workspace: string; allowWrite: boolean }

const WORKSPACE_FLAG = '--workspace';
const ALLOW_WRITE_FLAG = '--allow-write';

export function parseArgs(argv: readonly string[]): ServerConfig {
  const at = argv.indexOf(WORKSPACE_FLAG);
  const workspace = at >= 0 ? argv[at + 1] : process.env.SOLOMD_WORKSPACE;
  if (!workspace) throw new Error(`Missing ${WORKSPACE_FLAG} <dir> (or SOLOMD_WORKSPACE)`);
  return { workspace, allowWrite: argv.includes(ALLOW_WRITE_FLAG) };
}
