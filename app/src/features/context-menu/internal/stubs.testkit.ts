const g = globalThis as Record<string, unknown>;

export function stubGlobal(name: string, value: unknown): () => void {
  const had = Object.getOwnPropertyDescriptor(g, name);
  Object.defineProperty(g, name, { value, configurable: true, writable: true });
  return () => {
    if (had) Object.defineProperty(g, name, had);
    else delete g[name];
  };
}

export function stubNavigator(init: Record<string, unknown>): () => void {
  return stubGlobal('navigator', { userAgent: '', platform: 'MacIntel', maxTouchPoints: 0, ...init });
}
