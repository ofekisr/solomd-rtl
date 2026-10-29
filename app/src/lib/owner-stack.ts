/** Owners that come and go in any order; the newest one still present is on top. */
export interface OwnerStack<T> {
  acquire(owner: T): () => void;
  top(): T | undefined;
  readonly size: number;
}

export function createOwnerStack<T>(onChange: () => void = () => {}): OwnerStack<T> {
  const entries: { owner: T }[] = [];

  function acquire(owner: T): () => void {
    const entry = { owner };
    entries.push(entry);
    onChange();
    let isReleased = false;
    return () => {
      if (isReleased) return;
      isReleased = true;
      entries.splice(entries.indexOf(entry), 1);
      onChange();
    };
  }

  return {
    acquire,
    top: () => entries[entries.length - 1]?.owner,
    get size() {
      return entries.length;
    },
  };
}
