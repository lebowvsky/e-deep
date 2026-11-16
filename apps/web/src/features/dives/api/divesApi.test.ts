import type { DiveDetail, DiveSummary } from '@e-deep/shared';
import { describe, expect, it, vi } from 'vitest';
import { avatarPalette } from '@/design/tokens';
import { ApiError, createApiClient } from '@/shared/lib/apiClient';
import { mockDiveLogResponse, mockOwner } from '../mocks/diveLogResponse';
import {
  avatarColorOf,
  fetchDive,
  fetchDiveLog,
  isDiveDetail,
  isDiveLogResponse,
  isDiveSummary,
  toDiveLog,
  toLoggedDive,
  toSelfMember,
} from './divesApi';

function summary(overrides: Partial<DiveSummary> = {}): DiveSummary {
  return {
    id: 'd1',
    number: 1,
    date: '2026-04-05T10:30:00+02:00',
    utcOffsetMinutes: 120,
    site: { id: 's1', name: 'La Revellata', locality: 'Calvi', region: 'Corse' },
    depthMaxM: 32.5,
    durationMin: 48,
    temperatureC: 17,
    gasMix: 'NITROX32',
    notes: null,
    buddies: [
      { id: 'b1', firstName: 'Lucas', lastName: 'Bernard' },
      { id: 'b2', firstName: 'émilie', lastName: 'durand' },
    ],
    ...overrides,
  };
}

function detail(overrides: Partial<DiveDetail> = {}): DiveDetail {
  const base = summary();
  return {
    ...base,
    site: { ...base.site, latitude: 42.58, longitude: 8.72 },
    visibilityM: 20,
    hadDecompression: false,
    stopsOk: true,
    ...overrides,
  };
}

/** `summary()` with one field replaced by a value of any type (the guards take `unknown`). */
const withField = (key: string, value: unknown): unknown => ({ ...summary(), [key]: value });
const withSiteField = (key: string, value: unknown): unknown => ({
  ...summary(),
  site: { ...summary().site, [key]: value },
});
const without = (key: keyof DiveSummary): unknown =>
  Object.fromEntries(Object.entries(summary()).filter(([name]) => name !== key));

describe('isDiveSummary', () => {
  it('accepts a dive matching the contract, nullable fields included', () => {
    expect(isDiveSummary(summary())).toBe(true);
    expect(
      isDiveSummary(
        summary({
          temperatureC: null,
          notes: 'Mérous',
          buddies: [],
          site: { id: 's2', name: 'Le Tombant', locality: null, region: 'Bretagne' },
        }),
      ),
    ).toBe(true);
  });

  it.each(['id', 'number', 'date', 'site', 'depthMaxM', 'gasMix', 'buddies'] as const)(
    'rejects a dive without %s',
    (key) => {
      expect(isDiveSummary(without(key))).toBe(false);
    },
  );

  it.each([
    ['a string depth', withField('depthMaxM', '32')],
    ['a NaN duration', withField('durationMin', Number.NaN)],
    ['an unknown gas mix', withField('gasMix', 'TRIMIX')],
    ['a lower-case gas mix', withField('gasMix', 'air')],
    ['buddies that are not an array', withField('buddies', { id: 'b1' })],
    ['a buddy without last name', withField('buddies', [{ id: 'b1', firstName: 'Lucas' }])],
    ['an unparsable date', withField('date', 'hier matin')],
    ['a numeric date', withField('date', 1_775_000_000_000)],
    ['a string temperature', withField('temperatureC', '17')],
    ['a numeric locality', withSiteField('locality', 42)],
    ['an undefined locality', withSiteField('locality', undefined)],
    ['a missing region', withSiteField('region', undefined)],
    ['null', null],
    ['an array', [summary()]],
  ])('rejects %s', (_label, body) => {
    expect(isDiveSummary(body)).toBe(false);
  });
});

describe('isDiveLogResponse', () => {
  it('accepts the mocked log and an empty one', () => {
    expect(isDiveLogResponse(mockDiveLogResponse)).toBe(true);
    expect(isDiveLogResponse({ dives: [] })).toBe(true);
  });

  it.each([
    ['null', null],
    ['a bare array', [summary()]],
    ['a missing list', {}],
    ['a list that is not an array', { dives: summary() }],
    ['one malformed dive among valid ones', { dives: [summary(), withField('depthMaxM', '40')] }],
  ])('rejects %s', (_label, body) => {
    expect(isDiveLogResponse(body)).toBe(false);
  });
});

describe('isDiveDetail', () => {
  it('accepts a dive with the detail-only fields', () => {
    expect(isDiveDetail(detail())).toBe(true);
    expect(isDiveDetail(detail({ visibilityM: null }))).toBe(true);
  });

  it('rejects a summary: the detail-only fields are required', () => {
    expect(isDiveDetail(summary())).toBe(false);
  });

  it.each([
    ['without coordinates', { ...detail(), site: summary().site }],
    ['with a string latitude', { ...detail(), site: { ...detail().site, latitude: '42.58' } }],
    ['with a string visibility', { ...detail(), visibilityM: '20' }],
    ['without hadDecompression', { ...detail(), hadDecompression: undefined }],
    ['with a numeric stopsOk', { ...detail(), stopsOk: 1 }],
    ['with an invalid summary part', { ...detail(), gasMix: 'TRIMIX' }],
  ])('rejects a detail %s', (_label, body) => {
    expect(isDiveDetail(body)).toBe(false);
  });
});

// ── Requests, through the real client over a stubbed `fetch` ─────────────────────────────────

function stubFetch(implementation: typeof fetch) {
  const fetchMock = vi.fn<typeof fetch>(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function fetchCall(fetchMock: ReturnType<typeof stubFetch>, index = 0) {
  const call = fetchMock.mock.calls[index];
  if (!call) throw new Error(`No fetch call #${index}`);
  return { url: call[0], init: call[1] };
}

const client = createApiClient({ baseUrl: 'http://api.test/api' });

describe('fetchDiveLog', () => {
  it('gets /dives and returns the validated body', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(Response.json(mockDiveLogResponse)));

    await expect(fetchDiveLog(client)).resolves.toStrictEqual(mockDiveLogResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchCall(fetchMock).url).toStrictEqual(new URL('http://api.test/api/dives'));
  });

  it('passes the path, the guard and the caller signal to the client', async () => {
    const get = vi.fn().mockResolvedValue({ dives: [] });
    const controller = new AbortController();

    await fetchDiveLog({ get }, { signal: controller.signal });
    expect(get).toHaveBeenCalledWith('dives', isDiveLogResponse, { signal: controller.signal });
  });

  it('lets the caller cancel the request through its signal', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(Response.json({ dives: [] })));
    const controller = new AbortController();

    await fetchDiveLog(client, { signal: controller.signal });
    const signal = fetchCall(fetchMock).init?.signal;
    expect(signal?.aborted).toBe(false);
    controller.abort();
    expect(signal?.aborted).toBe(true);
  });

  it('rejects with an invalid-response ApiError when the body breaks the contract', async () => {
    stubFetch(() =>
      Promise.resolve(Response.json({ dives: [{ ...summary(), depthMaxM: '32.5' }] })),
    );

    const error: unknown = await fetchDiveLog(client).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'invalid-response' });
  });

  it.each([404, 500])('rejects with an http ApiError on HTTP %i', async (status) => {
    stubFetch(() => Promise.resolve(new Response(null, { status })));

    const error: unknown = await fetchDiveLog(client).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'http', status });
  });

  it('rejects with a timeout ApiError when the API does not answer in time', async () => {
    // Never answers: only the client timeout settles the request, by aborting it.
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const impatient = createApiClient({ baseUrl: 'http://api.test/api', timeoutMs: 5 });

    const error: unknown = await fetchDiveLog(impatient).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'timeout' });
  });
});

describe('fetchDive', () => {
  it('gets /dives/:id and returns the validated detail', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(Response.json(detail())));

    await expect(fetchDive(client, 'd1')).resolves.toStrictEqual(detail());
    expect(fetchCall(fetchMock).url).toStrictEqual(new URL('http://api.test/api/dives/d1'));
  });

  it('encodes the id so that it stays one path segment', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(Response.json(detail())));

    await fetchDive(client, '../admin?x=1');
    expect(fetchCall(fetchMock).url).toStrictEqual(
      new URL('http://api.test/api/dives/..%2Fadmin%3Fx%3D1'),
    );
  });

  it('passes the caller signal to the client', async () => {
    const get = vi.fn().mockResolvedValue(detail());
    const controller = new AbortController();

    await fetchDive({ get }, 'd1', { signal: controller.signal });
    expect(get).toHaveBeenCalledWith('dives/d1', isDiveDetail, { signal: controller.signal });
  });

  it('rejects with an http 404 ApiError when the dive is not the diver’s', async () => {
    stubFetch(() => Promise.resolve(new Response(null, { status: 404 })));

    await expect(fetchDive(client, 'd999')).rejects.toMatchObject({ kind: 'http', status: 404 });
  });

  it('rejects a summary with an invalid-response ApiError', async () => {
    stubFetch(() => Promise.resolve(Response.json(summary())));

    await expect(fetchDive(client, 'd1')).rejects.toMatchObject({ kind: 'invalid-response' });
  });
});

// ── Contract → view model ─────────────────────────────────────────────────────────────────────

describe('avatarColorOf', () => {
  it('derives a stable colour from the id, within the avatar palette', () => {
    const palette: readonly string[] = avatarPalette;
    for (const id of ['b1', 'b2', 'u-42', '7f3c1e2a-0000-4000-8000-000000000000', '']) {
      const color = avatarColorOf(id);
      expect(palette).toContain(color);
      expect(avatarColorOf(id)).toBe(color);
    }
  });

  it('spreads the ids over several colours', () => {
    const colors = new Set(Array.from({ length: 40 }, (_, index) => avatarColorOf(`b${index}`)));
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe('toLoggedDive', () => {
  const self = toSelfMember(mockOwner);

  it('puts the user first, then the buddies with their initials and colours', () => {
    const dive = toLoggedDive(summary(), self);

    expect(dive.team).toStrictEqual([
      {
        id: mockOwner.id,
        firstName: mockOwner.firstName,
        lastName: mockOwner.lastName,
        initials: `${mockOwner.firstName.charAt(0)}${mockOwner.lastName.charAt(0)}`.toUpperCase(),
        isSelf: true,
      },
      {
        id: 'b1',
        firstName: 'Lucas',
        lastName: 'Bernard',
        initials: 'LB',
        color: avatarColorOf('b1'),
        isSelf: false,
      },
      {
        id: 'b2',
        firstName: 'émilie',
        lastName: 'durand',
        initials: 'ÉD',
        color: avatarColorOf('b2'),
        isSelf: false,
      },
    ]);
  });

  it('keeps the user alone in a solo dive, without an avatar colour', () => {
    const [member, ...others] = toLoggedDive(summary({ buddies: [] }), self).team;
    expect(others).toStrictEqual([]);
    expect(member?.isSelf).toBe(true);
    expect(member).not.toHaveProperty('color');
  });

  it('maps the dive fields and the site, with its locality', () => {
    expect(toLoggedDive(summary(), self)).toStrictEqual({
      id: 'd1',
      number: 1,
      date: '2026-04-05T10:30:00+02:00',
      site: {
        id: 's1',
        name: 'La Revellata',
        place: 'Calvi · Corse',
        region: 'corse',
        regionName: 'Corse',
      },
      team: expect.any(Array) as unknown,
      depthMaxM: 32.5,
      durationMin: 48,
      temperatureC: 17,
      gasMix: 'NITROX32',
      notes: null,
    });
  });

  it('shows the region alone when the locality was not entered, and slugs the region key', () => {
    const dive = toLoggedDive(
      summary({ site: { id: 's3', name: 'Le Sec', locality: null, region: 'Côte d’Azur' } }),
      self,
    );
    expect(dive.site).toStrictEqual({
      id: 's3',
      name: 'Le Sec',
      place: 'Côte d’Azur',
      region: 'cote-d-azur',
      regionName: 'Côte d’Azur',
    });
  });
});

describe('toDiveLog', () => {
  it('maps every dive in the API order, with the same user first in each team', () => {
    const dives = toDiveLog(mockDiveLogResponse, mockOwner);

    expect(dives.map((dive) => dive.id)).toStrictEqual(
      mockDiveLogResponse.dives.map((dive) => dive.id),
    );
    expect(dives.every((dive) => dive.team[0]?.id === mockOwner.id && dive.team[0].isSelf)).toBe(
      true,
    );
    expect(dives.every((dive) => dive.team.filter((member) => member.isSelf).length === 1)).toBe(
      true,
    );
  });

  it('maps an empty log to an empty list', () => {
    expect(toDiveLog({ dives: [] }, mockOwner)).toStrictEqual([]);
  });
});
