/**
 * Dev app only. `pnpm dev:seed` dumps the installed app's localStorage to
 * `app/dev-seed/localstorage.json`; Vite serves it, and the dev app copies it
 * in before any store reads localStorage. Each seed applies once, by seedId.
 */

const SEED_URL = '/dev-seed/localstorage.json';
const SEED_ID_KEY = 'solomd.dev.seedId';

interface DevSeed {
  seedId: string;
  items: Record<string, string>;
}

function isDevSeed(value: unknown): value is DevSeed {
  if (!value || typeof value !== 'object') return false;
  const { seedId, items } = value as Partial<DevSeed>;
  if (typeof seedId !== 'string' || !items || typeof items !== 'object') return false;
  return Object.values(items).every((v) => typeof v === 'string');
}

/** Playwright and other WebDriver runs must start from their own clean state, not the copied app's. */
export function isAutomatedBrowser(nav: { webdriver?: boolean } | undefined): boolean {
  return nav?.webdriver === true;
}

export async function applyDevSeed(): Promise<void> {
  if (isAutomatedBrowser(typeof navigator === 'undefined' ? undefined : navigator)) return;
  try {
    const res = await fetch(SEED_URL, { cache: 'no-store' });
    if (!res.ok) return;
    const seed: unknown = await res.json();
    if (!isDevSeed(seed) || localStorage.getItem(SEED_ID_KEY) === seed.seedId) return;
    for (const [key, value] of Object.entries(seed.items)) localStorage.setItem(key, value);
    localStorage.setItem(SEED_ID_KEY, seed.seedId);
    console.info(`[dev-seed] applied ${Object.keys(seed.items).length} localStorage keys (${seed.seedId})`);
  } catch {
    // No seed file yet: start with default settings.
  }
}
