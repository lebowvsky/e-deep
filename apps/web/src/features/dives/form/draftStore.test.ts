import { beforeEach, describe, expect, it } from 'vitest';
import { validValues } from '../mocks/diveFormFixture';
import {
  createLocalDraftStore,
  draftKey,
  DRAFT_MAX_AGE_MS,
  isDiveFormValues,
  purgeAllDrafts,
  storageKeyOf,
} from './draftStore';

const DIVER = '0190f5a2-7c1e-7d3a-9b1f-2a4c6e8f0a1b';
const OTHER_DIVER = '0190f5a2-7c1e-7d3a-9b1f-2a4c6e8f0a1c';

describe('draftKey', () => {
  it('has one key per mode and per dive', () => {
    expect(draftKey({ kind: 'new' })).toBe('new');
    expect(draftKey({ kind: 'duplicate', sourceId: 'd127' })).toBe('new:from:d127');
    expect(draftKey({ kind: 'edit', diveId: 'd127' })).toBe('edit:d127');
  });

  it('is stored under the diver (D41)', () => {
    expect(storageKeyOf(DIVER, draftKey({ kind: 'edit', diveId: 'd127' }))).toBe(
      `e-deep:dive-draft:${DIVER}:edit:d127`,
    );
  });
});

describe('createLocalDraftStore', () => {
  const key = draftKey({ kind: 'new' });
  const stored = storageKeyOf(DIVER, key);
  const draft = {
    values: validValues({ species: ['Corb'] }),
    ids: { eventId: 'e1', newSiteId: 's1' },
    savedAt: 1_775_725_920_000,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('saves, restores and clears a draft under the diver', async () => {
    const store = createLocalDraftStore(DIVER, localStorage, () => draft.savedAt);
    await store.save(key, draft);
    expect(localStorage.getItem(stored)).not.toBeNull();
    expect(await store.load(key)).toEqual(draft);
    expect(await store.load(draftKey({ kind: 'edit', diveId: 'd1' }))).toBeNull();
    await store.clear(key);
    expect(await store.load(key)).toBeNull();
    expect(localStorage.getItem(stored)).toBeNull();
  });

  it('never gives a diver the draft of another one', async () => {
    await createLocalDraftStore(OTHER_DIVER, localStorage, () => draft.savedAt).save(key, draft);
    const mine = createLocalDraftStore(DIVER, localStorage, () => draft.savedAt);
    expect(await mine.load(key)).toBeNull();
    await mine.clear(key);
    expect(localStorage.getItem(storageKeyOf(OTHER_DIVER, key))).not.toBeNull();
  });

  it('purges the drafts older than 30 days, and those without a date, when one is loaded', async () => {
    const now = draft.savedAt + DRAFT_MAX_AGE_MS + 1;
    const store = createLocalDraftStore(DIVER, localStorage, () => now);
    const fresh = storageKeyOf(OTHER_DIVER, draftKey({ kind: 'edit', diveId: 'fresh' }));
    const old = storageKeyOf(OTHER_DIVER, draftKey({ kind: 'edit', diveId: 'old' }));
    const undated = storageKeyOf(DIVER, draftKey({ kind: 'edit', diveId: 'undated' }));
    localStorage.setItem(stored, JSON.stringify({ version: 3, ...draft }));
    localStorage.setItem(old, JSON.stringify({ version: 1, savedAt: 1, values: {} }));
    localStorage.setItem(undated, '{not json');
    localStorage.setItem(fresh, JSON.stringify({ version: 3, ...draft, savedAt: now - 1000 }));
    localStorage.setItem('other-app', 'kept');

    expect(await store.load(key)).toBeNull();
    expect(localStorage.getItem(stored)).toBeNull();
    expect(localStorage.getItem(old)).toBeNull();
    expect(localStorage.getItem(undated)).toBeNull();
    expect(localStorage.getItem(fresh)).not.toBeNull();
    expect(localStorage.getItem('other-app')).toBe('kept');
  });

  it('deletes the drafts written before they had an owner, even fresh, and never restores them', async () => {
    const store = createLocalDraftStore(DIVER, localStorage, () => draft.savedAt);
    const unowned = [
      'e-deep:dive-draft:new',
      'e-deep:dive-draft:new:from:d127',
      'e-deep:dive-draft:edit:d127',
    ];
    for (const legacy of unowned) {
      localStorage.setItem(legacy, JSON.stringify({ version: 3, ...draft }));
    }

    expect(await store.load(key)).toBeNull();
    for (const legacy of unowned) expect(localStorage.getItem(legacy)).toBeNull();
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
    await expect(createLocalDraftStore(DIVER, full).save(key, draft)).rejects.toThrow();
  });

  it('ignores a corrupted, outdated or foreign draft', async () => {
    const store = createLocalDraftStore(DIVER, localStorage);
    localStorage.setItem(stored, '{not json');
    expect(await store.load(key)).toBeNull();
    localStorage.setItem(stored, JSON.stringify({ version: 0, ...draft }));
    expect(await store.load(key)).toBeNull();
    localStorage.setItem(
      stored,
      JSON.stringify({ ...draft, version: 3, values: { ...draft.values, gas: 'TRIMIX' } }),
    );
    expect(await store.load(key)).toBeNull();
    localStorage.setItem(stored, JSON.stringify({ ...draft, version: 3, ids: { eventId: 'e1' } }));
    expect(await store.load(key)).toBeNull();
  });

  it('ignores a draft of version 2, written without the ids of the dive', async () => {
    const store = createLocalDraftStore(DIVER, localStorage, () => draft.savedAt);
    const { values, savedAt } = draft;
    localStorage.setItem(stored, JSON.stringify({ version: 2, values, savedAt }));
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
    const store = createLocalDraftStore(DIVER, failing);
    await expect(store.load(key)).resolves.toBeNull();
    await expect(store.clear(key)).resolves.toBeUndefined();
    expect(createLocalDraftStore(DIVER, null)).toBeDefined();
  });
});

describe('purgeAllDrafts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('deletes every draft of the device, of every diver, and nothing else', () => {
    const mine = storageKeyOf(DIVER, 'new');
    const theirs = storageKeyOf(OTHER_DIVER, 'edit:d1');
    localStorage.setItem(mine, '{}');
    localStorage.setItem(theirs, '{}');
    localStorage.setItem('e-deep:dive-draft:new', '{}');
    localStorage.setItem('other-app', 'kept');

    purgeAllDrafts(localStorage);

    expect(localStorage.getItem(mine)).toBeNull();
    expect(localStorage.getItem(theirs)).toBeNull();
    expect(localStorage.getItem('e-deep:dive-draft:new')).toBeNull();
    expect(localStorage.getItem('other-app')).toBe('kept');
  });

  it('stops every store opened before from writing (this tab and the others)', async () => {
    const draft = {
      values: validValues(),
      ids: { eventId: 'e1', newSiteId: 's1' },
      savedAt: 1_775_725_920_000,
    };
    const thisTab = createLocalDraftStore(DIVER, localStorage, () => draft.savedAt);
    const otherTab = createLocalDraftStore(DIVER, localStorage, () => draft.savedAt);

    purgeAllDrafts(localStorage);

    await expect(thisTab.save('new', draft)).rejects.toThrow();
    await expect(otherTab.save('edit:d1', draft)).rejects.toThrow();
    expect(localStorage.getItem(storageKeyOf(DIVER, 'new'))).toBeNull();
    expect(localStorage.getItem(storageKeyOf(DIVER, 'edit:d1'))).toBeNull();
    // A store opened after the purge (the next session) writes again.
    const next = createLocalDraftStore(DIVER, localStorage, () => draft.savedAt);
    await next.save('new', draft);
    expect(await next.load('new')).toEqual(draft);
  });

  it('never throws on a blocked or missing storage', () => {
    const blocked: Storage = {
      length: 1,
      clear: () => undefined,
      key: () => {
        throw new Error('blocked');
      },
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    expect(() => purgeAllDrafts(blocked)).not.toThrow();
    expect(() => purgeAllDrafts(null)).not.toThrow();
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
