// The drafts' storage layout and their purge, without any dependency: the app's session wiring
// imports `purgeAllDrafts` (sign-out, D41) and must not pull the dive form code into the bundle of
// the public pages (D45). `draftStore.ts` builds the drafts themselves on top of it.

/** Prefix of every draft key: `e-deep:dive-draft:<diverId>:<key>`. */
export const KEY_PREFIX = 'e-deep:dive-draft:';

/**
 * Counter advanced by every purge, outside the drafts' prefix. Kept in the storage itself, so that
 * every tab of the device sees a purge made by another one.
 */
const EPOCH_KEY = 'e-deep:dive-draft-epoch';

/** The storage keys of every draft of the device (all divers, modes and dives). */
export function draftStorageKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(KEY_PREFIX)) keys.push(key);
  }
  return keys;
}

/** The current epoch of the drafts (`0` before any purge, or when unreadable). */
export function readEpoch(storage: Storage): number {
  const value = Number(storage.getItem(EPOCH_KEY));
  return Number.isSafeInteger(value) ? value : 0;
}

/** Reading `window.localStorage` itself throws when the browser blocks it. */
export function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Deletes every draft of the device, whoever wrote it: signing out leaves no health data behind
 * (D41). The epoch moves first: a store opened before (in this tab or another) refuses to write
 * from then on, so a form that flushes its last changes while leaving cannot bring one back. Never
 * throws: a blocked storage has nothing to delete.
 */
export function purgeAllDrafts(storage: Storage | null = safeLocalStorage()): void {
  try {
    if (storage === null) return;
    storage.setItem(EPOCH_KEY, String(readEpoch(storage) + 1));
    for (const key of draftStorageKeys(storage)) storage.removeItem(key);
  } catch {
    // Storage blocked: nothing was written either.
  }
}
