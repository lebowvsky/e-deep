import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveDive, SaveDiveResult } from '../api/saveDive';
import { CONTEXT, validValues } from '../mocks/diveFormFixture';
import type { DiveDraft, DraftStore } from './draftStore';
import { DRAFT_DEBOUNCE_MS, useDiveForm, type UseDiveFormOptions } from './useDiveForm';

const KEY = 'e-deep:dive-draft:new';
const DRAFT_IDS = { eventId: 'e-draft', newSiteId: 's-draft' };

/** An in-memory `DraftStore` whose calls can be inspected. */
function memoryStore(initial: Record<string, DiveDraft> = {}) {
  const drafts = new Map(Object.entries(initial));
  const store = {
    load: vi.fn((key: string) => Promise.resolve(drafts.get(key) ?? null)),
    save: vi.fn((key: string, draft: DiveDraft) => {
      drafts.set(key, draft);
      return Promise.resolve();
    }),
    clear: vi.fn((key: string) => {
      drafts.delete(key);
      return Promise.resolve();
    }),
  } satisfies DraftStore;
  return { store, drafts };
}

function setup(overrides: Partial<UseDiveFormOptions> = {}) {
  const { store, drafts } = memoryStore();
  const saveDive = vi.fn<SaveDive>(() => Promise.resolve({ ok: true, id: 'd128', number: 128 }));
  let id = 0;
  const options: UseDiveFormOptions = {
    mode: { kind: 'new' },
    initialValues: validValues(),
    target: { kind: 'create' },
    context: CONTEXT,
    saveDive,
    draftStore: store,
    newId: () => `id-${++id}`,
    now: () => Date.UTC(2026, 3, 9, 8, 52),
    ...overrides,
  };
  const hook = renderHook(() => useDiveForm(options));
  return { hook, store, drafts, saveDive };
}

/** Lets the draft lookup (a resolved promise) settle. */
const flush = () => act(async () => {});

describe('draft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves the draft 1 s after the last change, not before', async () => {
    const { hook, store, drafts } = setup();
    await flush();
    act(() => hook.result.current.actions.change('notes', 'Mérou'));
    await act(() => vi.advanceTimersByTimeAsync(DRAFT_DEBOUNCE_MS - 1));
    act(() => hook.result.current.actions.change('notes', 'Mérou brun'));
    await act(() => vi.advanceTimersByTimeAsync(DRAFT_DEBOUNCE_MS - 1));
    expect(store.save).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(drafts.get(KEY)?.values.notes).toBe('Mérou brun');
    expect(hook.result.current.draft.savedAt).toEqual(new Date(Date.UTC(2026, 3, 9, 8, 52)));
  });

  it('saves nothing while the form is untouched', async () => {
    const { store } = setup();
    await flush();
    await act(() => vi.advanceTimersByTimeAsync(DRAFT_DEBOUNCE_MS * 3));
    expect(store.save).not.toHaveBeenCalled();
  });

  it('writes the pending draft at once on flushDraft, then not again at the delay', async () => {
    const { hook, store, drafts } = setup();
    await flush();
    act(() => hook.result.current.actions.change('notes', 'Mérou'));
    act(() => hook.result.current.flushDraft());
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(drafts.get(KEY)?.values.notes).toBe('Mérou');
    await act(() => vi.advanceTimersByTimeAsync(DRAFT_DEBOUNCE_MS));
    expect(store.save).toHaveBeenCalledTimes(1);
  });

  it('writes the pending draft on pagehide (tab closed or put in the back-forward cache)', async () => {
    const { hook, drafts } = setup();
    await flush();
    act(() => hook.result.current.actions.change('notes', 'Mérou'));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(drafts.get(KEY)?.values.notes).toBe('Mérou');
  });

  it('drops the draft mention once the values are back to their start', async () => {
    const { hook, store, drafts } = setup();
    await flush();
    act(() => hook.result.current.actions.change('notes', 'Mérou'));
    await act(() => vi.advanceTimersByTimeAsync(DRAFT_DEBOUNCE_MS));
    expect(hook.result.current.draft.savedAt).not.toBeNull();

    act(() => hook.result.current.actions.change('notes', ''));
    await flush();
    expect(drafts.has(KEY)).toBe(false);
    expect(hook.result.current.draft.savedAt).toBeNull();
    expect(store.clear).toHaveBeenCalledTimes(1);
  });

  it('claims no draft when the device could not write it', async () => {
    const { store } = memoryStore();
    store.save.mockRejectedValue(new Error('quota'));
    const { hook } = setup({ draftStore: store });
    await flush();
    act(() => hook.result.current.actions.change('notes', 'Mérou'));
    await act(() => vi.advanceTimersByTimeAsync(DRAFT_DEBOUNCE_MS));
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(hook.result.current.draft.savedAt).toBeNull();
  });

  it('writes the pending draft when the form unmounts within the delay', async () => {
    const { hook, drafts } = setup();
    await flush();
    act(() => hook.result.current.actions.change('notes', 'Mérou'));
    hook.unmount();
    expect(drafts.get(KEY)?.values.notes).toBe('Mérou');
  });

  it('writes nothing on flush or unmount once the dive is saved, nor when untouched', async () => {
    const { hook, store } = setup();
    await flush();
    act(() => hook.result.current.flushDraft());
    act(() => hook.result.current.actions.change('notes', 'Mérou'));
    await act(async () => {
      await hook.result.current.submit();
    });
    hook.unmount();
    expect(store.save).not.toHaveBeenCalled();
  });

  it('restores the draft of the mode, and discards it on demand', async () => {
    const { store } = memoryStore({
      [KEY]: { values: validValues({ notes: 'brouillon' }), ids: DRAFT_IDS, savedAt: 1 },
    });
    const { hook } = setup({ draftStore: store });
    expect(hook.result.current.draft.isChecking).toBe(true);
    await flush();
    expect(hook.result.current.values.notes).toBe('brouillon');
    expect(hook.result.current.draft.isRestored).toBe(true);
    expect(hook.result.current.isDirty).toBe(true);
    act(() => hook.result.current.discardDraft());
    expect(hook.result.current.values.notes).toBe('');
    expect(store.clear).toHaveBeenCalledWith(KEY);
  });
});

describe('ids of a new dive in the draft', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores the ids with the values', async () => {
    const { hook, drafts } = setup();
    await flush();
    act(() => hook.result.current.actions.change('notes', 'Mérou'));
    await act(() => vi.advanceTimersByTimeAsync(DRAFT_DEBOUNCE_MS));
    expect(drafts.get(KEY)?.ids).toEqual(hook.result.current.ids);
  });

  // A save that timed out on the device may be stored by the API: sent again with other ids, it
  // would be a second dive and a second site.
  it('sends the ids of the restored draft, not new ones', async () => {
    const { store } = memoryStore({
      [KEY]: {
        values: validValues({ site: { id: null, name: 'Le Sec' } }),
        ids: DRAFT_IDS,
        savedAt: 1,
      },
    });
    const { hook, saveDive } = setup({ draftStore: store });
    await flush();
    expect(hook.result.current.ids).toEqual(DRAFT_IDS);
    await act(async () => {
      await hook.result.current.submit();
    });
    const input = saveDive.mock.calls[0]?.[0];
    expect(input?.event.id).toBe(DRAFT_IDS.eventId);
    expect(input?.contacts.site.id).toBe(DRAFT_IDS.newSiteId);
  });

  it('draws new ids once the restored draft is discarded: another dive from now on', async () => {
    const { store } = memoryStore({
      [KEY]: { values: validValues({ notes: 'brouillon' }), ids: DRAFT_IDS, savedAt: 1 },
    });
    const { hook } = setup({ draftStore: store });
    await flush();
    act(() => hook.result.current.discardDraft());
    expect(hook.result.current.ids.eventId).not.toBe(DRAFT_IDS.eventId);
    expect(hook.result.current.ids.newSiteId).not.toBe(DRAFT_IDS.newSiteId);
  });
});

describe('submit', () => {
  it('returns the fields to fix in order, without calling saveDive', async () => {
    const { hook, saveDive } = setup({
      initialValues: validValues({ weightKg: '45', site: { id: null, name: '' } }),
    });
    await flush();
    let outcome: unknown;
    await act(async () => {
      outcome = await hook.result.current.submit();
    });
    expect(outcome).toEqual({ status: 'invalid', fields: ['site', 'weightKg'] });
    expect(saveDive).not.toHaveBeenCalled();
    expect(hook.result.current.errors.site).toBeDefined();
  });

  it('saves once, clears the draft, and refuses a second submit meanwhile', async () => {
    let resolve: (result: SaveDiveResult) => void = () => undefined;
    const saveDive = vi.fn<SaveDive>(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { hook, store } = setup({ saveDive });
    await flush();
    let first: Promise<unknown> = Promise.resolve();
    let second: unknown;
    await act(async () => {
      first = hook.result.current.submit();
      second = await hook.result.current.submit();
    });
    expect(second).toEqual({ status: 'busy' });
    expect(hook.result.current.submitStatus).toEqual({ status: 'submitting' });
    expect(saveDive).toHaveBeenCalledTimes(1);
    expect(saveDive.mock.calls[0]?.[0].event.id).toBe('id-1');
    await act(async () => {
      resolve({ ok: true, id: 'id-1', number: 120 });
      await first;
    });
    // The number the dive got (D26), not the one guessed when the form opened.
    expect(await first).toEqual({ status: 'saved', id: 'id-1', number: 120 });
    expect(store.clear).toHaveBeenCalledWith(KEY);
    expect(hook.result.current.isDirty).toBe(false);
  });

  it('maps the field errors of saveDive', async () => {
    const saveDive = vi.fn<SaveDive>(() =>
      Promise.resolve({ ok: false, fieldErrors: { site: 'Site inconnu.' } }),
    );
    const { hook } = setup({ saveDive });
    await flush();
    let outcome: unknown;
    await act(async () => {
      outcome = await hook.result.current.submit();
    });
    expect(outcome).toEqual({ status: 'invalid', fields: ['site'] });
    expect(hook.result.current.errors.site).toBe('Site inconnu.');
  });

  it('sends the same ids again after a failure: a retry is not a second dive', async () => {
    const saveDive = vi
      .fn<SaveDive>()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ ok: true, id: 'id-1', number: 128 });
    const { hook } = setup({
      saveDive,
      initialValues: validValues({ site: { id: null, name: 'Le Sec' } }),
    });
    await flush();
    await act(async () => {
      await hook.result.current.submit();
    });
    await act(async () => {
      await hook.result.current.submit();
    });
    const [first, second] = saveDive.mock.calls.map(([input]) => input);
    expect(second?.event.id).toBe(first?.event.id);
    expect(second?.contacts.site.id).toBe(first?.contacts.site.id);
  });

  it('reports a saved dive even when its draft cannot be cleared', async () => {
    const { store } = memoryStore();
    store.clear.mockRejectedValue(new Error('blocked'));
    const { hook } = setup({ draftStore: store });
    await flush();
    let outcome: unknown;
    await act(async () => {
      outcome = await hook.result.current.submit();
    });
    expect(outcome).toEqual({ status: 'saved', id: 'd128', number: 128 });
    expect(hook.result.current.submitStatus).toEqual({ status: 'saved', id: 'd128' });
  });

  it('hands over an unexpected failure and keeps the values', async () => {
    const failure = new Error('network');
    const { hook } = setup({ saveDive: () => Promise.reject(failure) });
    await flush();
    let outcome: unknown;
    await act(async () => {
      outcome = await hook.result.current.submit();
    });
    expect(outcome).toEqual({ status: 'failed', error: failure });
    expect(hook.result.current.submitStatus).toEqual({ status: 'failed' });
    expect(hook.result.current.values.site.name).toBe('Pointe de la Revellata');
  });
});

describe('editing helpers', () => {
  it('gives new rows and new members a key', async () => {
    const { hook } = setup();
    await flush();
    act(() => {
      hook.result.current.actions.addDecoStop();
      hook.result.current.actions.addMember({
        id: null,
        firstName: 'Léa',
        lastName: 'Morel',
        level: '',
      });
    });
    // id-1 and id-2 are the dive's and a new site's, drawn when the form opens.
    expect(hook.result.current.values.decoStops[0]?.key).toBe('id-3');
    expect(hook.result.current.values.team[0]?.key).toBe('id-4');
  });

  it('keeps the same actions from one render to the next (memoised sections)', async () => {
    const { hook } = setup();
    await flush();
    const { actions } = hook.result.current;
    act(() => actions.change('notes', 'Mérou'));
    expect(hook.result.current.values.notes).toBe('Mérou');
    expect(hook.result.current.actions).toBe(actions);
  });
});
