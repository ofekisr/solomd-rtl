export type SyncProvider = 'github' | 'gitlab' | 'gitea' | 'custom';
export type Translate = (key: string, params?: Record<string, string | number>) => string;

const GITEA_MESSAGE_KEYS: Record<string, string> = {
  pushedToast: 'giteaPushedToast',
  pulledToast: 'giteaPulledToast',
  repoCreatedToast: 'giteaRepoCreatedToast',
};

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const GITHUB_REMOTE = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i;
const ANY_REMOTE = /[:/]([^/]+)\/([^/]+?)(?:\.git)?$/;

export function syncMessageKey(provider: SyncProvider, key: string): string {
  const actual = provider === 'gitea' ? (GITEA_MESSAGE_KEYS[key] ?? key) : key;
  return `githubSync.${actual}`;
}

export function formatAgo(ts: number | null, t: Translate, nowMs: number = Date.now()): string {
  if (!ts) return t('githubSync.never');
  const dt = nowMs / 1000 - ts;
  if (dt < SECONDS_PER_MINUTE) return t('githubSync.agoSec', { n: String(Math.floor(dt)) });
  if (dt < SECONDS_PER_HOUR) return t('githubSync.agoMin', { n: String(Math.floor(dt / SECONDS_PER_MINUTE)) });
  if (dt < SECONDS_PER_DAY) return t('githubSync.agoHour', { n: String(Math.floor(dt / SECONDS_PER_HOUR)) });
  return t('githubSync.agoDay', { n: String(Math.floor(dt / SECONDS_PER_DAY)) });
}

export function linkedRepoLabel(remoteUrl: string): string {
  const gh = remoteUrl.match(GITHUB_REMOTE);
  if (gh) return `${gh[1]}/${gh[2]}`;
  const any = remoteUrl.match(ANY_REMOTE);
  if (any) return `${any[1]}/${any[2]}`;
  return remoteUrl;
}

export type GiteaStep = 'url' | 'token' | 'ready';
