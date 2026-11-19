import type { SiteResponse } from '@e-deep/shared';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '@/shared/lib/apiClient';
import type { SiteDraft } from '@/shared/model/site';
import { createHttpSitesRepository } from './httpSitesRepository';
import { isSiteResponse, splitPlaceLabel, toSite } from './siteContract';

const RESPONSE: SiteResponse = {
  id: 's01',
  name: 'Pointe de la Revellata',
  locality: 'Calvi',
  region: 'Corse',
  area: 'Méditerranée',
  latitude: 42.583,
  longitude: 8.725,
  type: 'tombant',
  depthMinM: 15,
  depthMaxM: 60,
  accessNotes: 'Mouillage au pied du phare.',
  createdVia: 'full',
  createdAt: '2026-04-01T08:00:00.000Z',
  updatedAt: '2026-04-02T08:00:00.000Z',
};
const SITE = toSite(RESPONSE);

const DRAFT: SiteDraft = {
  name: SITE.name,
  region: SITE.region,
  type: SITE.type,
  depthMinM: SITE.depthMinM,
  depthMaxM: SITE.depthMaxM,
  position: SITE.position,
  accessNotes: SITE.accessNotes,
};

/** Answers `responses` in turn; the requests sent are in `calls`. */
function stubFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetchMock);
  const calls = () =>
    fetchMock.mock.calls.map(([url, init]) => ({
      url: url instanceof Request ? url.url : url.toString(),
      method: init?.method,
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    }));
  return { calls };
}

const error = (status: number, code: string) =>
  Response.json({ statusCode: status, code }, { status });

const repository = createHttpSitesRepository(createApiClient({ baseUrl: 'http://api.test/api' }));

describe('createHttpSitesRepository — reads', () => {
  it('lists the sites, with the label of their place and what they store (D-32)', async () => {
    const { calls } = stubFetch(Response.json({ sites: [RESPONSE] }));

    const [site] = await repository.list();

    expect(calls()).toStrictEqual([
      { url: 'http://api.test/api/sites', method: 'GET', body: undefined },
    ]);
    expect(site).toStrictEqual({
      id: 's01',
      name: 'Pointe de la Revellata',
      region: 'Calvi · Corse',
      zone: 'mediterranee',
      type: 'tombant',
      depthMinM: 15,
      depthMaxM: 60,
      position: { latitude: 42.583, longitude: 8.725 },
      accessNotes: 'Mouillage au pied du phare.',
      createdVia: 'full',
      createdAt: '2026-04-01T08:00:00.000Z',
      updatedAt: '2026-04-02T08:00:00.000Z',
      storedPlace: { locality: 'Calvi', region: 'Corse', area: 'Méditerranée' },
    });
  });

  it.each([
    ['an unknown type', { type: 'recif' }],
    ['an unknown origin', { createdVia: 'import' }],
    ['half a position', { longitude: null }],
    ['no timestamp', { updatedAt: undefined }],
    ['no area', { area: undefined }],
  ])('rejects a list with %s as out of contract', async (_label, change) => {
    stubFetch(Response.json({ sites: [{ ...RESPONSE, ...change }] }));

    await expect(repository.list()).rejects.toMatchObject({ kind: 'invalid-response' });
  });

  it('accepts a site created by its name: everything but its name is null', () => {
    const quick = {
      ...RESPONSE,
      locality: null,
      region: null,
      area: null,
      latitude: null,
      longitude: null,
      type: null,
      depthMinM: null,
      depthMaxM: null,
      accessNotes: null,
      createdVia: 'quick',
    };

    expect(isSiteResponse(quick)).toBe(true);
    expect(toSite(quick as SiteResponse)).toMatchObject({ region: null, zone: 'autre' });
  });
});

describe('createHttpSitesRepository — writes', () => {
  it('creates a site with its origin, the label cut at its first « · »', async () => {
    const { calls } = stubFetch(Response.json(RESPONSE, { status: 201 }));

    const site = await repository.create({
      ...DRAFT,
      id: 's01',
      region: 'Calvi · Haute-Corse · France',
      createdVia: 'quick',
    });

    expect(calls()).toStrictEqual([
      {
        url: 'http://api.test/api/sites',
        method: 'POST',
        body: {
          id: 's01',
          name: 'Pointe de la Revellata',
          locality: 'Calvi',
          region: 'Haute-Corse · France',
          area: null,
          latitude: 42.583,
          longitude: 8.725,
          type: 'tombant',
          depthMinM: 15,
          depthMaxM: 60,
          accessNotes: 'Mouillage au pied du phare.',
          createdVia: 'quick',
        },
      },
    ]);
    // The site as the API saved it.
    expect(site).toStrictEqual(SITE);
  });

  it('takes the answer of a creation received again (200) as the site', async () => {
    stubFetch(Response.json(RESPONSE, { status: 200 }));

    await expect(repository.create({ ...DRAFT, id: 's01', createdVia: 'full' })).resolves.toEqual(
      SITE,
    );
  });

  it('rejects a creation in conflict, without replaying it: its id was drawn for it', async () => {
    const { calls } = stubFetch(error(409, 'identifier-conflict'));

    await expect(
      repository.create({ ...DRAFT, id: 's01', createdVia: 'full' }),
    ).rejects.toMatchObject({ status: 409, code: 'identifier-conflict' });
    expect(calls()).toHaveLength(1);
  });

  it('sends back the stored place while the label is unchanged', async () => {
    const { calls } = stubFetch(Response.json(RESPONSE));

    await repository.update(SITE, { ...DRAFT, name: 'La Revellata' });

    expect(calls()[0]).toMatchObject({
      url: 'http://api.test/api/sites/s01',
      method: 'PUT',
      body: { id: 's01', name: 'La Revellata', locality: 'Calvi', region: 'Corse' },
    });
    expect(calls()[0]?.body).not.toHaveProperty('createdVia');
  });

  it.each([
    ['Calvi · Haute-Corse', { locality: 'Calvi', region: 'Haute-Corse' }],
    ['Haute-Corse', { locality: null, region: 'Haute-Corse' }],
    [null, { locality: null, region: null }],
  ])('cuts a changed label %s, and keeps the area', async (label, place) => {
    const { calls } = stubFetch(Response.json(RESPONSE));

    await repository.update(SITE, { ...DRAFT, region: label });

    expect(calls()[0]?.body).toMatchObject({ ...place, area: 'Méditerranée' });
  });

  it('rejects an update of a site gone meanwhile (404)', async () => {
    stubFetch(new Response(null, { status: 404 }));

    await expect(repository.update(SITE, DRAFT)).rejects.toMatchObject({ status: 404 });
  });

  it('merges a site into another one: the completed target', async () => {
    const { calls } = stubFetch(Response.json(RESPONSE));

    await expect(repository.merge('x 1', 's01')).resolves.toEqual(SITE);
    expect(calls()).toStrictEqual([
      { url: 'http://api.test/api/sites/x%201/merge', method: 'POST', body: { targetId: 's01' } },
    ]);
  });

  it.each([
    ['merge-into-self', 422],
    ['invalid-reference', 422],
  ])('rejects a merge refused with %s', async (code, status) => {
    stubFetch(error(status, code));

    await expect(repository.merge('s01', 's02')).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects a merge answered out of contract', async () => {
    stubFetch(Response.json({ id: 's01' }));

    await expect(repository.merge('x1', 's01')).rejects.toMatchObject({
      kind: 'invalid-response',
    });
  });

  it('deletes a site (204)', async () => {
    const { calls } = stubFetch(new Response(null, { status: 204 }));

    await expect(repository.remove('x1')).resolves.toBe('deleted');
    expect(calls()).toStrictEqual([
      { url: 'http://api.test/api/sites/x1', method: 'DELETE', body: undefined },
    ]);
  });

  it('says that a site still used by dives is not deleted (409 site-in-use)', async () => {
    stubFetch(error(409, 'site-in-use'));

    await expect(repository.remove('s01')).resolves.toBe('in-use');
  });

  it('rejects any other refused deletion', async () => {
    stubFetch(error(409, 'identifier-conflict'), new Response(null, { status: 404 }));

    await expect(repository.remove('s01')).rejects.toMatchObject({ status: 409 });
    await expect(repository.remove('s01')).rejects.toMatchObject({ status: 404 });
  });
});

describe('splitPlaceLabel', () => {
  it.each([
    ['Calvi · Corse', { locality: 'Calvi', region: 'Corse' }],
    ['Calvi·Corse', { locality: 'Calvi', region: 'Corse' }],
    ['Calvi · Haute-Corse · France', { locality: 'Calvi', region: 'Haute-Corse · France' }],
    ['Corse', { locality: null, region: 'Corse' }],
    [' · Corse', { locality: null, region: 'Corse' }],
    ['Calvi · ', { locality: 'Calvi', region: null }],
    [null, { locality: null, region: null }],
  ])('cuts %s', (label, place) => {
    expect(splitPlaceLabel(label)).toStrictEqual(place);
  });
});
