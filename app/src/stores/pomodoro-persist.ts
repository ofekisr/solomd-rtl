const LS_STATE = 'solomd.pomodoro.state.v1';
const LS_SESSIONS = 'solomd.pomodoro.sessions.v1';
const LS_LAST_PRESET = 'solomd.pomodoro.lastPreset.v1';

export type PomodoroPhase = 'focus' | 'break' | 'flash';

export interface PomodoroSessionRecord {
  date: string; // ISO date "YYYY-MM-DD"
  durationMin: number;
  wordsWritten: number;
}

export interface PersistedState {
  phase: PomodoroPhase;
  startedAt: number; // epoch ms when current run started (excluding paused time)
  durationMs: number;
  paused: boolean;
  pausedRemainingMs: number; // remaining ms snapshot when paused; 0 if not paused
  // Snapshot at start so we can compute words-written delta + restore focus mode
  startWordCount: number;
  priorFocusMode: boolean;
  // Whether an auto-break should chain after this focus phase
  autoBreakNext: boolean;
  // Whether to fire a notification at the end of the focus phase
  notifyOnEnd: boolean;
}

export function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(LS_STATE);
    if (!raw) return null;
    const obj = JSON.parse(raw) as PersistedState;
    // Sanity — sessions older than 24h are stale, drop them.
    if (typeof obj?.startedAt !== 'number') return null;
    if (Date.now() - obj.startedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(LS_STATE);
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

export function savePersisted(s: PersistedState) {
  try {
    localStorage.setItem(LS_STATE, JSON.stringify(s));
  } catch {}
}

export function clearPersisted() {
  try {
    localStorage.removeItem(LS_STATE);
  } catch {}
}

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function appendSession(rec: PomodoroSessionRecord) {
  try {
    const raw = localStorage.getItem(LS_SESSIONS);
    const arr: PomodoroSessionRecord[] = raw ? JSON.parse(raw) : [];
    arr.push(rec);
    localStorage.setItem(LS_SESSIONS, JSON.stringify(arr));
  } catch {}
}

export function setLastPreset(min: number) {
  try {
    localStorage.setItem(LS_LAST_PRESET, String(min));
  } catch {}
}

export function getLastPreset(): number {
  try {
    const v = localStorage.getItem(LS_LAST_PRESET);
    if (v) {
      const n = parseFloat(v);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {}
  return 25;
}

export function fireNotification(title: string, body: string) {
  // Browser Notification API — works inside Tauri WKWebView once the user
  // grants permission. Async-await without blocking is fine; we ignore the
  // permission promise's rejection (best-effort).
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((p) => {
        if (p === 'granted') new Notification(title, { body });
      }).catch(() => {});
    }
  } catch {}
}
