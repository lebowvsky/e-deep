/**
 * Holds the current promise of an async read so `use()` receives the same instance across
 * renders (a promise created during render would suspend forever).
 */
export interface PromiseCache<T> {
  /** Returns the current promise, starting the first load lazily. */
  read(): Promise<T>;
  /** Starts a new load, makes it the current promise and returns it. */
  reload(): Promise<T>;
}

export function createPromiseCache<T>(load: () => Promise<T>): PromiseCache<T> {
  let current: Promise<T> | undefined;

  function reload(): Promise<T> {
    current = load();
    return current;
  }

  return {
    read: () => current ?? reload(),
    reload,
  };
}
