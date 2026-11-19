import type { DiveWriteResponse } from '@e-deep/shared';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { fakeApiClient } from '@/test/fakeApiClient';
import { toSaveDiveInput } from '../form/convert';
import { editTarget } from '../form/prefill';
import { filledDive, validValues } from '../mocks/diveFormFixture';
import {
  createHttpDiveRepository,
  isDiveWriteResponse,
  SITE_NOT_FOUND,
  TEAM_NOT_FOUND,
  toDiveWriteRequest,
} from './httpDiveRepository';
import { divesKeys } from './queryKeys';
import type { SaveDiveInput } from './saveDive';

const IDS = { eventId: 'new-event', newSiteId: 'new-site' };
const SAVED: DiveWriteResponse = {
  id: 'new-event',
  number: 128,
  updatedAt: '2026-04-10T08:00:00.000Z',
};

function inputOf(input: SaveDiveInput | null): SaveDiveInput {
  if (input === null) throw new Error('Invalid values');
  return input;
}

/** A new dive on a site of the log, with Lucas (a contact) in the team. */
const created = () =>
  inputOf(
    toSaveDiveInput(
      validValues({
        site: { id: 's01', name: 'Pointe de la Revellata' },
        team: [{ key: 'k', id: 'b1', firstName: 'Lucas', lastName: 'Bernard', level: '' }],
      }),
      { kind: 'create' },
      IDS,
    ),
  );

const edited = () => {
  const dive = filledDive();
  return inputOf(toSaveDiveInput(validValues(), editTarget(dive), IDS));
};

function setup(methods: Partial<ApiClient>) {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const saveDive = createHttpDiveRepository({ apiClient: fakeApiClient(methods), queryClient });
  return { saveDive, invalidate };
}

const httpError = (
  status: number,
  body: { code?: string; fieldErrors?: Record<string, string[]> },
) => new ApiError('http', `HTTP ${status}`, { status, ...body });

describe('toDiveWriteRequest', () => {
  it('sends the contract: the site and the team of the contacts, no `kind`', () => {
    const input = created();
    const request = toDiveWriteRequest(input);

    expect(request).toStrictEqual({
      event: input.event,
      participation: input.participation,
      observations: input.observations,
      site: { id: 's01', name: 'Pointe de la Revellata', isNew: false },
      buddies: [
        { id: 'b1', firstName: 'Lucas', lastName: 'Bernard', levelCode: null, isNew: false },
      ],
      baseUpdatedAt: null,
    });
    expect(request.event.siteId).toBe(request.site.id);
  });
});

describe('isDiveWriteResponse', () => {
  it('accepts the contract and rejects anything else', () => {
    expect(isDiveWriteResponse(SAVED)).toBe(true);
    expect(isDiveWriteResponse({ ...SAVED, number: '128' })).toBe(false);
    expect(isDiveWriteResponse({ ...SAVED, number: 1.5 })).toBe(false);
    expect(isDiveWriteResponse({ id: 'd1', number: 1 })).toBe(false);
    expect(isDiveWriteResponse(null)).toBe(false);
  });
});

describe('createHttpDiveRepository', () => {
  it('creates with a POST, then refreshes the log and the detail', async () => {
    const post = vi.fn().mockResolvedValue(SAVED);
    const { saveDive, invalidate } = setup({ post });
    const input = created();

    await expect(saveDive(input)).resolves.toEqual({ ok: true, id: 'new-event', number: 128 });
    expect(post).toHaveBeenCalledWith('dives', toDiveWriteRequest(input), isDiveWriteResponse);
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      divesKeys.log(),
      divesKeys.detail('new-event'),
    ]);
  });

  // A creation that timed out yet was stored, then sent again once changed: same id, other content.
  it('replaces the dive with a PUT when its POST is a 409 identifier-conflict', async () => {
    const post = vi.fn().mockRejectedValue(httpError(409, { code: 'identifier-conflict' }));
    const put = vi.fn().mockResolvedValue(SAVED);
    const { saveDive, invalidate } = setup({ post, put });
    const input = created();

    await expect(saveDive(input)).resolves.toEqual({ ok: true, id: 'new-event', number: 128 });
    expect(put).toHaveBeenCalledWith(
      'dives/new-event',
      toDiveWriteRequest(input),
      isDiveWriteResponse,
    );
    expect(invalidate).toHaveBeenCalledTimes(2);
  });

  it('rejects with the error of the PUT when the id is not a dive of the diver (404)', async () => {
    const notFound = httpError(404, { code: 'not-found' });
    const post = vi.fn().mockRejectedValue(httpError(409, { code: 'identifier-conflict' }));
    const put = vi.fn().mockRejectedValue(notFound);
    const { saveDive, invalidate } = setup({ post, put });

    await expect(saveDive(created())).rejects.toBe(notFound);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('does not replay another 409 of a creation', async () => {
    const conflict = httpError(409, { code: 'stale-write' });
    const put = vi.fn();
    const { saveDive } = setup({ post: vi.fn().mockRejectedValue(conflict), put });

    await expect(saveDive(created())).rejects.toBe(conflict);
    expect(put).not.toHaveBeenCalled();
  });

  it('replaces an edited dive with a PUT on its id, with the updatedAt it was read with', async () => {
    const put = vi.fn().mockResolvedValue({ ...SAVED, id: 'd127', number: 127 });
    const { saveDive } = setup({ put });
    const input = edited();

    await expect(saveDive(input)).resolves.toEqual({ ok: true, id: 'd127', number: 127 });
    expect(put).toHaveBeenCalledWith(
      'dives/d127',
      expect.objectContaining({
        event: expect.objectContaining({ id: 'd127' }) as unknown,
        baseUpdatedAt: filledDive().updatedAt,
      }),
      isDiveWriteResponse,
    );
  });

  it('maps a 400 validation-failed to the fields of the form, the first path of a field winning', async () => {
    const error = httpError(400, {
      code: 'validation-failed',
      fieldErrors: {
        'participation.maxDepthM': ['max'],
        'observations.3.label': ['length'],
        'observations.4.label': ['duplicate'],
        'participation.safetyStopDurationMin': ['before-duration'],
      },
    });
    const { saveDive, invalidate } = setup({ post: () => Promise.reject(error) });

    await expect(saveDive(created())).resolves.toEqual({
      ok: false,
      fieldErrors: {
        maxDepthM: 'Indique une profondeur entre 1 et 100 m.',
        species: 'Raccourcis les espèces (80 caractères au plus).',
        safetyStopDurationMin: 'Le palier doit durer moins que la plongée.',
      },
    });
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('maps a 400 of a duplicate species (business code) to the species', async () => {
    const error = httpError(400, { code: 'duplicate-observation' });
    const { saveDive } = setup({ post: () => Promise.reject(error) });

    await expect(saveDive(created())).resolves.toEqual({
      ok: false,
      fieldErrors: { species: 'Retire les espèces en double.' },
    });
  });

  it('maps a 422 invalid-reference to the site of the log and to the team', async () => {
    const error = httpError(422, { code: 'invalid-reference' });
    const { saveDive } = setup({ post: () => Promise.reject(error) });

    await expect(saveDive(created())).resolves.toEqual({
      ok: false,
      fieldErrors: { site: SITE_NOT_FOUND, team: TEAM_NOT_FOUND },
    });
  });

  it('blames only what may be unknown on a 422: not a site created by its name', async () => {
    const error = httpError(422, { code: 'invalid-reference' });
    const { saveDive } = setup({ post: () => Promise.reject(error) });
    const onNewSite = inputOf(
      toSaveDiveInput(
        validValues({
          site: { id: null, name: 'Le Sec' },
          team: [{ key: 'k', id: null, firstName: 'Zoé', lastName: 'Martin', level: 'PA40' }],
        }),
        { kind: 'create' },
        IDS,
      ),
    );
    await expect(saveDive(onNewSite)).resolves.toEqual({
      ok: false,
      fieldErrors: { team: TEAM_NOT_FOUND },
    });

    const alone = { ...onNewSite, contacts: { ...onNewSite.contacts, buddies: [] } };
    await expect(saveDive(alone)).rejects.toBe(error);
  });

  it.each([
    [
      'a 400 naming no field of the form',
      httpError(400, { code: 'validation-failed', fieldErrors: { 'event.id': ['matches-route'] } }),
    ],
    ['a 400 validation-failed without fieldErrors', httpError(400, { code: 'validation-failed' })],
    ['a 404 (dive gone meanwhile)', httpError(404, {})],
    ['a 409 identifier-conflict', httpError(409, { code: 'identifier-conflict' })],
    ['a 401', httpError(401, {})],
    ['a 500', httpError(500, { code: 'unsupported-contract-value' })],
    ['a timeout', new ApiError('timeout', 'Too slow')],
    ['a broken response', new ApiError('invalid-response', 'Unexpected response shape.')],
  ])('rejects with the error on %s', async (_label, error) => {
    const { saveDive, invalidate } = setup({ put: () => Promise.reject(error) });

    await expect(saveDive(edited())).rejects.toBe(error);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
