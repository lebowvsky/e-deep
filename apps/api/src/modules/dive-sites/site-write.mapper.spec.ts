import { siteCreateRequest } from '../../../test/support/site-request';
import type { DiveSite } from './dive-site.entity';
import { isSameSiteWrite, toDiveSiteWrite } from './site-write.mapper';

describe('toDiveSiteWrite', () => {
  it('writes a live site with the origin given, whatever the request carries', () => {
    const request = siteCreateRequest({ createdVia: 'full' });
    const { createdVia: _origin, ...fields } = request;

    expect(toDiveSiteWrite(request, 'quick')).toStrictEqual({
      ...fields,
      createdVia: 'quick',
      baseUpdatedAt: null,
      deletedAt: null,
    });
  });
});

describe('isSameSiteWrite', () => {
  const request = siteCreateRequest();
  const write = toDiveSiteWrite(request, request.createdVia);
  const stored = {
    ...write,
    ownerId: 'diver-1',
    mergedIntoId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as DiveSite;

  it('is true for the same content', () => {
    expect(isSameSiteWrite(write, stored)).toBe(true);
  });

  it.each<[string, Partial<DiveSite>]>([
    ['name', { name: 'Revellata' }],
    ['locality', { locality: null }],
    ['region', { region: 'Haute-Corse' }],
    ['area', { area: null }],
    ['latitude', { latitude: 42.5831 }],
    ['longitude', { longitude: 8.7251 }],
    ['type', { type: 'sec' }],
    ['depthMinM', { depthMinM: 15.5 }],
    ['depthMaxM', { depthMaxM: null }],
    ['accessNotes', { accessNotes: 'Autre accès.' }],
    ['createdVia', { createdVia: 'quick' }],
  ])('is false when %s differs', (_field, change) => {
    expect(isSameSiteWrite(write, { ...stored, ...change })).toBe(false);
  });
});
