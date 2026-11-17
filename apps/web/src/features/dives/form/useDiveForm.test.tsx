import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveDive, SaveDiveResult } from '../api/saveDive';
import { CONTEXT, validValues } from '../mocks/diveFormFixture';
import type { DiveDraft, DraftStore } from './draftStore';
import { DRAFT_DEBOUNCE_MS, useDiveForm, type UseDiveFormOptions } from './useDiveForm';

const KEY = 'e-deep:dive-draft:new';

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
  const saveDive = vi.fn<SaveDive>(() => Promise.resolve({ ok: true, id: 'd128' }));
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
    act(() => hook.result.current.change('notes', 'Mérou'));
    await act(() => vi.advanceTimersByTimeAsync(DRAFT_DEBOUNCE_MS - 1));
    act(() => hook.result.current.change('notes', 'Mérou brun'));
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

  it('restores the draft of the mode, and discards it on demand', async () => {
    const { store } = memoryStore({
      [KEY]: { values: validValues({ notes: 'brouillon' }), savedAt: 1 },
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
      resolve({ ok: true, id: 'id-1' });
      await first;
    });
    expect(await first).toEqual({ status: 'saved', id: 'id-1' });
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
      hook.result.current.addDecoStop();
      hook.result.current.addMember({ id: null, firstName: 'Léa', lastName: 'Morel', level: '' });
    });
    expect(hook.result.current.values.decoStops[0]?.key).toBe('id-1');
    expect(hook.result.current.values.team[0]?.key).toBe('id-2');
  });
});
