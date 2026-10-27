import { unlinkSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

export const AI_LOCK_SUFFIX = '.ai-lock';
const DEFAULT_IDLE_MS = 4000;
const LOCK_MODE = 0o600;
const SIGNAL_EXIT_CODES: Record<string, number> = { SIGTERM: 143, SIGINT: 130, SIGHUP: 129 };

export interface ActivityMarker { touch(abs: string): Promise<void> }

export const NO_ACTIVITY: ActivityMarker = { touch: async () => undefined };

export function aiLockPath(abs: string, holder: string = `mcp-${process.pid}`): string {
  return join(dirname(abs), `.${basename(abs)}${AI_LOCK_SUFFIX}-${holder}`);
}

export class AiActivity implements ActivityMarker {
  private readonly idleMs: number;
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(idleMs: number = DEFAULT_IDLE_MS) {
    this.idleMs = idleMs;
    process.once('exit', () => this.clearAllSync());
    for (const [signal, code] of Object.entries(SIGNAL_EXIT_CODES)) {
      process.once(signal, () => {
        this.clearAllSync();
        process.exit(code);
      });
    }
  }

  async touch(abs: string): Promise<void> {
    const lock = aiLockPath(abs);
    clearTimeout(this.timers.get(lock));
    const timer = setTimeout(() => void this.release(lock), this.idleMs);
    timer.unref();
    this.timers.set(lock, timer);
    await unlink(lock).catch(() => undefined);
    await writeFile(lock, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), { flag: 'wx', mode: LOCK_MODE }).catch(() => undefined);
  }

  private async release(lock: string): Promise<void> {
    this.timers.delete(lock);
    await unlink(lock).catch(() => undefined);
  }

  private clearAllSync(): void {
    for (const lock of this.timers.keys()) {
      try { unlinkSync(lock); } catch { /* already gone */ }
    }
  }
}
