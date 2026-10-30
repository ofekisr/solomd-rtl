type AnyFn = (...args: unknown[]) => unknown;

/** Binds a function that a composable created later will provide on `api`. */
export function late<A extends object, K extends keyof A>(api: A, key: K): A[K] {
  const call = (...args: unknown[]) => (api[key] as unknown as AnyFn)(...args);
  return call as unknown as A[K];
}

/** Binds a ref/computed that a composable created later will provide on `api`. */
export function lateRef<A extends object, K extends keyof A>(api: A, key: K): A[K] {
  const proxy = {
    get value(): unknown {
      return (api[key] as unknown as { value: unknown }).value;
    },
    set value(next: unknown) {
      (api[key] as unknown as { value: unknown }).value = next;
    },
  };
  return proxy as unknown as A[K];
}
