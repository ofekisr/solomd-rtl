export interface LocalStorageStub {
  restore(): void;
}

const PINNED_NAVIGATOR = { language: 'en-US', userAgent: 'Mozilla/5.0 (Macintosh; solomd-settings-test)', maxTouchPoints: 0 };

function createMapStorage(seed: Record<string, string>): Storage {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, String(value)),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  };
}

function overrideGlobal(name: string, value: unknown): () => void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  return () => {
    if (previous) Object.defineProperty(globalThis, name, previous);
    else Reflect.deleteProperty(globalThis, name);
  };
}

/** Installs a Map-backed localStorage and a pinned navigator so load() output is machine-independent. */
export function withLocalStorage(seed: Record<string, string>): LocalStorageStub {
  const restores = [
    overrideGlobal('localStorage', createMapStorage(seed)),
    overrideGlobal('navigator', PINNED_NAVIGATOR),
  ];
  return { restore: () => restores.reverse().forEach((restore) => restore()) };
}
