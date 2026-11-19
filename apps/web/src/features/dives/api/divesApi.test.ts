import type { DiveDetail, DiveSummary } from '@e-deep/shared';
import { describe, expect, it, vi } from 'vitest';
import { avatarPalette } from '@/design/tokens';
import { fetchDiveLog, isDiveLogResponse, isDiveSummary } from '@/shared/diveLog/diveLogApi';
import { ApiError, createApiClient } from '@/shared/lib/apiClient';
import { avatarColorOf } from '../lib/avatarColor';
import { MOCKUP_DETAIL_FIELDS } from '../mocks/diveDetailResponse';
import { mockDiveLogResponse, mockOwner } from '../mocks/diveLogResponse';
import {
  fetchDive,
  isDiveDetail,
  isDiveNotFound,
  toDiveDetailView,
  toDiveLog,
  toLoggedDive,
  toSelfMember,
} from './divesApi';
import { fakeApiClient } from '@/test/fakeApiClient';

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
    site: { ...base.site, latitude: 42.58, longitude: 8.72, area: null },
    buddies: base.buddies.map((buddy) => ({ ...buddy, level: null })),
    visibilityM: 20,
    hadDecompression: false,
    stopsOk: true,
    diverLevel: { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' },
    entryType: null,
    timeOfDay: null,
    weather: null,
    airTemperatureC: null,
    seaState: null,
    currentStrength: null,
    diveCenter: null,
    surfaceTemperatureC: null,
    safetyStopDurationMin: null,
    safetyStopDepthM: null,
    isRepetitive: null,
    o2Percent: null,
    tankVolumeL: null,
    tankMaterial: null,
    startPressureBar: null,
    endPressureBar: null,
    suitType: null,
    suitThicknessMm: null,
    weightKg: null,
    observations: [],
    createdAt: '2026-04-08T18:00:00.000Z',
    updatedAt: '2026-04-08T18:00:00.000Z',
    ...overrides,
  };
}

/** `detail()` filled with the mockup values (#127): area, buddy levels and every detail field. */
function filledDetail(): DiveDetail {
  const base = detail(structuredClone(MOCKUP_DETAIL_FIELDS));
  return {
    ...base,
    site: { ...base.site, area: 'Méditerranée' },
    buddies: [
      { id: 'b1', firstName: 'Lucas', lastName: 'Bernard', level: N3 },
      { id: 'b2', firstName: 'émilie', lastName: 'durand', level: null },
    ],
  };
}

const N3 = { agency: 'FFESSM', code: 'N3', label: 'Niveau 3' };

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

  it('accepts a site without region (created by its name, D-23)', () => {
    expect(
      isDiveSummary(summary({ site: { id: 's2', name: 'Le Sec', locality: null, region: null } })),
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
    ['a numeric region', withSiteField('region', 42)],
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

  it('accepts a site without position (D-23)', () => {
    expect(
      isDiveDetail(detail({ site: { ...detail().site, latitude: null, longitude: null } })),
    ).toBe(true);
  });

  it('rejects a summary: the detail-only fields are required', () => {
    expect(isDiveDetail(summary())).toBe(false);
  });

  it('accepts a detail filled with every field', () => {
    expect(isDiveDetail(filledDetail())).toBe(true);
    expect(isDiveDetail(detail({ gasMix: 'OTHER', o2Percent: 28 }))).toBe(true);
  });

  // Each union, with a value the front does not know (D-14: deployed front first).
  it.each([
    ['entryType', 'BOAT', 'BOAT_DIVE'],
    ['timeOfDay', 'NIGHT', 'DUSK'],
    ['weather', 'RAIN', 'SNOW'],
    ['seaState', 'ROUGH', 'STORM'],
    ['currentStrength', 'MODERATE', 'moderate'],
    ['tankMaterial', 'ALUMINIUM', 'CARBON'],
    ['suitType', 'SEMI_DRY', 'SHORTY'],
  ] as const)('accepts a known %s or null, rejects an unknown one', (key, known, unknown) => {
    expect(isDiveDetail({ ...detail(), [key]: known })).toBe(true);
    expect(isDiveDetail({ ...detail(), [key]: null })).toBe(true);
    expect(isDiveDetail({ ...detail(), [key]: unknown })).toBe(false);
    expect(isDiveDetail({ ...detail(), [key]: undefined })).toBe(false);
  });

  it.each([
    'airTemperatureC',
    'surfaceTemperatureC',
    'safetyStopDurationMin',
    'safetyStopDepthM',
    'o2Percent',
    'tankVolumeL',
    'startPressureBar',
    'endPressureBar',
    'suitThicknessMm',
    'weightKg',
  ] as const)('accepts a numeric or null %s, rejects a string or a missing one', (key) => {
    expect(isDiveDetail({ ...detail(), [key]: 12.5 })).toBe(true);
    expect(isDiveDetail({ ...detail(), [key]: '12' })).toBe(false);
    expect(isDiveDetail({ ...detail(), [key]: undefined })).toBe(false);
  });

  it.each([
    ['without diverLevel', { ...detail(), diverLevel: null }],
    [
      'with a diverLevel without code',
      { ...detail(), diverLevel: { agency: 'FFESSM', label: 'N2' } },
    ],
    ['with a numeric repetitive flag', { ...detail(), isRepetitive: 0 }],
    ['with a numeric dive centre', { ...detail(), diveCenter: 3 }],
    ['without site area', { ...detail(), site: { ...detail().site, area: undefined } }],
    ['with null observations', { ...detail(), observations: null }],
    ['with an observation without label', { ...detail(), observations: [{ count: 2 }] }],
    [
      'with a string observation count',
      { ...detail(), observations: [{ label: 'Corb', count: '2' }] },
    ],
    [
      'with a buddy without level',
      { ...detail(), buddies: [{ id: 'b1', firstName: 'Lucas', lastName: 'Bernard' }] },
    ],
    [
      'with a buddy level without agency',
      {
        ...detail(),
        buddies: [{ id: 'b1', firstName: 'Lucas', lastName: 'Bernard', level: { code: 'N3' } }],
      },
    ],
    [
      'with a string level',
      {
        ...detail(),
        buddies: [{ id: 'b1', firstName: 'Lucas', lastName: 'Bernard', level: 'N3' }],
      },
    ],
    ['with an unparsable creation date', { ...detail(), createdAt: 'hier' }],
    ['without updatedAt', { ...detail(), updatedAt: undefined }],
    ['without coordinates', { ...detail(), site: summary().site }],
    ['with a string latitude', { ...detail(), site: { ...detail().site, latitude: '42.58' } }],
    ['with a latitude alone', { ...detail(), site: { ...detail().site, longitude: null } }],
    ['with a longitude alone', { ...detail(), site: { ...detail().site, latitude: null } }],
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

    await fetchDiveLog(fakeApiClient({ get }), { signal: controller.signal });
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

    await fetchDive(fakeApiClient({ get }), 'd1', { signal: controller.signal });
    expect(get).toHaveBeenCalledWith('dives/d1', isDiveDetail, { signal: controller.signal });
  });

  it('rejects with an http 404 ApiError when the dive is not the diver’s', async () => {
    stubFetch(() => Promise.resolve(new Response(null, { status: 404 })));

    await expect(fetchDive(client, 'd999')).rejects.toMatchObject({ kind: 'http', status: 404 });
  });

  it('rejects a union value the front does not know with an invalid-response ApiError', async () => {
    stubFetch(() => Promise.resolve(Response.json({ ...filledDetail(), weather: 'SNOW' })));

    await expect(fetchDive(client, 'd1')).rejects.toMatchObject({ kind: 'invalid-response' });
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
      utcOffsetMinutes: 120,
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

  it('shows the locality alone, or no place, when the region was not entered', () => {
    const site = (locality: string | null) =>
      toLoggedDive(summary({ site: { id: 's4', name: 'Le Sec', locality, region: null } }), self)
        .site;
    expect(site('Agay')).toStrictEqual({
      id: 's4',
      name: 'Le Sec',
      place: 'Agay',
      region: null,
      regionName: null,
    });
    expect(site(null).place).toBeNull();
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

describe('isDiveNotFound', () => {
  it('is true for a 404 and a 400 (malformed id) only', () => {
    expect(isDiveNotFound(new ApiError('http', 'HTTP 404', { status: 404 }))).toBe(true);
    expect(isDiveNotFound(new ApiError('http', 'HTTP 400', { status: 400 }))).toBe(true);
  });

  it.each([
    ['a 500', new ApiError('http', 'HTTP 500', { status: 500 })],
    ['a 403', new ApiError('http', 'HTTP 403', { status: 403 })],
    ['a network failure', new ApiError('network', 'The API is unreachable.')],
    ['a broken contract', new ApiError('invalid-response', 'Unexpected response shape.')],
    ['any other error', new Error('boom')],
  ])('is false for %s', (_, error) => {
    expect(isDiveNotFound(error)).toBe(false);
  });
});

describe('toDiveDetailView', () => {
  const self = toSelfMember(mockOwner);

  it('extends the logged dive with every detail field, nothing entered', () => {
    const view = toDiveDetailView(
      detail({ visibilityM: null, hadDecompression: true, stopsOk: false }),
      self,
    );
    const logged = toLoggedDive(summary(), self);

    expect(view).toStrictEqual({
      ...logged,
      site: { ...logged.site, position: { latitude: 42.58, longitude: 8.72 }, area: null },
      team: logged.team.map((member) => ({
        ...member,
        level: member.isSelf ? { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' } : null,
      })),
      visibilityM: null,
      hadDecompression: true,
      stopsOk: false,
      surfaceTemperatureC: null,
      safetyStop: null,
      isRepetitive: null,
      conditions: {
        entryType: null,
        timeOfDay: null,
        weather: null,
        airTemperatureC: null,
        seaState: null,
        currentStrength: null,
        diveCenter: null,
      },
      equipment: {
        o2Percent: 32,
        tankVolumeL: null,
        tankMaterial: null,
        startPressureBar: null,
        endPressureBar: null,
        suitType: null,
        suitThicknessMm: null,
        weightKg: null,
      },
      observations: [],
      createdAt: '2026-04-08T18:00:00.000Z',
      updatedAt: '2026-04-08T18:00:00.000Z',
    });
  });

  it('has no position when the site has none', () => {
    const view = toDiveDetailView(
      detail({ site: { ...detail().site, latitude: null, longitude: null } }),
      self,
    );
    expect(view.site.position).toBeNull();
  });

  it('groups a filled detail into the cards, with the mockup values', () => {
    const view = toDiveDetailView({ ...filledDetail(), gasMix: 'AIR' }, self);

    expect(view.site.area).toBe('Méditerranée');
    expect(view.surfaceTemperatureC).toBe(16);
    expect(view.safetyStop).toStrictEqual({ durationMin: 3, depthM: 5 });
    expect(view.isRepetitive).toBe(false);
    expect(view.conditions).toStrictEqual({
      entryType: 'BOAT',
      timeOfDay: 'DAY',
      weather: 'SUNNY',
      airTemperatureC: 19,
      seaState: 'CALM',
      currentStrength: 'WEAK',
      diveCenter: 'Calvi Plongée',
    });
    expect(view.equipment).toStrictEqual({
      o2Percent: 21,
      tankVolumeL: 12,
      tankMaterial: 'STEEL',
      startPressureBar: 200,
      endPressureBar: 60,
      suitType: 'SEMI_DRY',
      suitThicknessMm: 7,
      weightKg: null,
    });
    expect(view.observations.map(({ label }) => label)).toStrictEqual([
      'Mérou brun',
      'Barracudas',
      'Gorgones rouges',
      'Corb',
      'Murène',
    ]);
    expect(view.updatedAt).toBe('2026-04-09T07:30:00.000Z');
  });

  it('gives the user the level at the time of the dive, each buddy the declared one', () => {
    const view = toDiveDetailView(filledDetail(), self);
    expect(
      view.team.map(({ id, isSelf, level }) => ({ id, isSelf, code: level?.code })),
    ).toStrictEqual([
      { id: mockOwner.id, isSelf: true, code: 'N2' },
      { id: 'b1', isSelf: false, code: 'N3' },
      { id: 'b2', isSelf: false, code: undefined },
    ]);
    expect(view.team[1]?.color).toBe(avatarColorOf('b1'));
  });

  it('takes the entered oxygen share of another mix only', () => {
    expect(
      toDiveDetailView(detail({ gasMix: 'OTHER', o2Percent: 28 }), self).equipment.o2Percent,
    ).toBe(28);
    expect(toDiveDetailView(detail({ gasMix: 'OTHER' }), self).equipment.o2Percent).toBeNull();
    expect(
      toDiveDetailView(detail({ gasMix: 'AIR', o2Percent: 28 }), self).equipment.o2Percent,
    ).toBe(21);
  });

  it('drops a safety stop entered by half (the contract pairs both values)', () => {
    expect(toDiveDetailView(detail({ safetyStopDurationMin: 3 }), self).safetyStop).toBeNull();
    expect(toDiveDetailView(detail({ safetyStopDepthM: 5 }), self).safetyStop).toBeNull();
  });
});
