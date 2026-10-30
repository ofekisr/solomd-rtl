import type { OpenerPort } from './opener.port.ts';

type OpenerModule = Pick<typeof import('@tauri-apps/plugin-opener'), 'openUrl' | 'openPath' | 'revealItemInDir'>;
type LoadOpener = () => Promise<OpenerModule>;

const loadTauriOpener: LoadOpener = () => import('@tauri-apps/plugin-opener');

export function createTauriOpenerPort(load: LoadOpener = loadTauriOpener): OpenerPort {
  return {
    openUrl: async (url) => (await load()).openUrl(url),
    openPath: async (path) => (await load()).openPath(path),
    revealItemInDir: async (path) => (await load()).revealItemInDir(path),
  };
}
