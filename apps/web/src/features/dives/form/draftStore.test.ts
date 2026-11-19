import { beforeEach, describe, expect, it } from 'vitest';
import { validValues } from '../mocks/diveFormFixture';
import { createLocalDraftStore, draftKey, DRAFT_MAX_AGE_MS, isDiveFormValues } from './draftStore';

describe('draftKey', () => {
  it('has one key per mode and per dive', () => {
    expect(draftKey({ kind: 'new' })).toBe('e-deep:dive-draft:new');
    expect(draftKey({ kind: 'duplicate', sourceId: 'd127' })).toBe(
      'e-deep:dive-draft:new:from:d127',
    );
    expect(draftKey({ kind: 'edit', diveId: 'd127' })).toBe('e-deep:dive-draft:edit:d127');
  });
});

describe('createLocalDraftStore', () => {
  const key = draftKey({ kind: 'new' });
  const draft = {
    values: validValues({ species: ['Corb'] }),
    ids: { eventId: 'e1', newSiteId: 's1' },
    savedAt: 1_775_725_920_000,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('saves, restores and clears a draft', async () => {
    const store = createLocalDraftStore(localStorage, () => draft.savedAt);
    await store.save(key, draft);
    expect(await store.load(key)).toEqual(draft);
    expect(await store.load(draftKey({ kind: 'edit', diveId: 'd1' }))).toBeNull();
    await store.clear(key);
    expect(await store.load(key)).toBeNull();
  });

  it('purges the drafts older than 30 days, and those without a date, when one is loaded', async () => {
    const now = draft.savedAt + DRAFT_MAX_AGE_MS + 1;
    const store = createLocalDraftStore(localStorage, () => now);
    const fresh = draftKey({ kind: 'edit', diveId: 'fresh' });
    const old = draftKey({ kind: 'edit', diveId: 'old' });
    const undated = draftKey({ kind: 'edit', diveId: 'undated' });
    localStorage.setItem(key, JSON.stringify({ version: 3, ...draft }));
    localStorage.setItem(old, JSON.stringify({ version: 1, savedAt: 1, values: {} }));
    localStorage.setItem(undated, '{not json');
    localStorage.setItem(fresh, JSON.stringify({ version: 3, ...draft, savedAt: now - 1000 }));
    localStorage.setItem('other-app', 'kept');

    expect(await store.load(key)).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem(old)).toBeNull();
    expect(localStorage.getItem(undated)).toBeNull();
    expect(localStorage.getItem(fresh)).not.toBeNull();
    expect(localStorage.getItem('other-app')).toBe('kept');
    expect(await store.load(fresh)).not.toBeNull();
  });

  it('says when a draft could not be written', async () => {
    const full: Storage = {
      ...localStorage,
      length: 0,
      clear: () => undefined,
      key: () => null,
      getItem: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      },
    };
    await expect(createLocalDraftStore(full).save(key, draft)).rejects.toThrow();
  });

  it('ignores a corrupted, outdated or foreign draft', async () => {
    const store = createLocalDraftStore(localStorage);
    localStorage.setItem(key, '{not json');
    expect(await store.load(key)).toBeNull();
    localStorage.setItem(key, JSON.stringify({ version: 0, ...draft }));
    expect(await store.load(key)).toBeNull();
    localStorage.setItem(
      key,
      JSON.stringify({ ...draft, version: 3, values: { ...draft.values, gas: 'TRIMIX' } }),
    );
    expect(await store.load(key)).toBeNull();
    localStorage.setItem(key, JSON.stringify({ ...draft, version: 3, ids: { eventId: 'e1' } }));
    expect(await store.load(key)).toBeNull();
  });

  it('ignores a draft of version 2, written without the ids of the dive', async () => {
    const store = createLocalDraftStore(localStorage, () => draft.savedAt);
    const { values, savedAt } = draft;
    localStorage.setItem(key, JSON.stringify({ version: 2, values, savedAt }));
    expect(await store.load(key)).toBeNull();
  });

  it('keeps the form working when the storage fails', async () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    const failing: Storage = {
      length: 0,
      clear: blocked,
      key: blocked,
      getItem: blocked,
      setItem: blocked,
      removeItem: blocked,
    };
    const store = createLocalDraftStore(failing);
    await expect(store.load(key)).resolves.toBeNull();
    await expect(store.clear(key)).resolves.toBeUndefined();
    expect(createLocalDraftStore(null)).toBeDefined();
  });
});

describe('isDiveFormValues', () => {
  it('accepts form values and refuses anything else', () => {
    expect(isDiveFormValues(validValues())).toBe(true);
    expect(isDiveFormValues({ ...validValues(), team: [{ key: 'k' }] })).toBe(false);
    expect(isDiveFormValues({ ...validValues(), safetyStop: 'yes' })).toBe(false);
    expect(isDiveFormValues(null)).toBe(false);
  });
});
