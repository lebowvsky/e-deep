import { beforeEach, describe, expect, it } from 'vitest';
import { validValues } from '../mocks/diveFormFixture';
import { createLocalDraftStore, draftKey, isDiveFormValues } from './draftStore';

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
  const draft = { values: validValues({ species: ['Corb'] }), savedAt: 1_775_725_920_000 };

  beforeEach(() => {
    localStorage.clear();
  });

  it('saves, restores and clears a draft', async () => {
    const store = createLocalDraftStore(localStorage);
    await store.save(key, draft);
    expect(await store.load(key)).toEqual(draft);
    expect(await store.load(draftKey({ kind: 'edit', diveId: 'd1' }))).toBeNull();
    await store.clear(key);
    expect(await store.load(key)).toBeNull();
  });

  it('ignores a corrupted, outdated or foreign draft', async () => {
    const store = createLocalDraftStore(localStorage);
    localStorage.setItem(key, '{not json');
    expect(await store.load(key)).toBeNull();
    localStorage.setItem(key, JSON.stringify({ version: 0, ...draft }));
    expect(await store.load(key)).toBeNull();
    localStorage.setItem(
      key,
      JSON.stringify({ version: 1, savedAt: 1, values: { ...draft.values, gas: 'TRIMIX' } }),
    );
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
    await expect(store.save(key, draft)).resolves.toBeUndefined();
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
