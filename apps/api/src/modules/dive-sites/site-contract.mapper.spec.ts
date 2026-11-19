import type { SiteResponse } from '@e-deep/shared';
import type { DiveSite } from './dive-site.entity';
import { toSiteResponse } from './site-contract.mapper';

function site(values: Partial<DiveSite> = {}): DiveSite {
  return {
    id: 'site-1',
    ownerId: 'diver-1',
    name: 'Épave du Donator',
    locality: 'Porquerolles',
    region: 'Var',
    area: 'Méditerranée',
    latitude: 42.979,
    longitude: 6.223,
    type: 'epave',
    depthMinM: 30,
    depthMaxM: 39.5,
    accessNotes: 'Bouée du club.',
    createdVia: 'full',
    mergedIntoId: null,
    createdAt: new Date('2026-04-01T08:00:00.123Z'),
    updatedAt: new Date('2026-04-02T09:30:00.456Z'),
    deletedAt: null,
    ...values,
  };
}

describe('toSiteResponse', () => {
  it('maps every field, the instants in ISO UTC, without owner nor tombstone', () => {
    expect(toSiteResponse(site())).toStrictEqual({
      id: 'site-1',
      name: 'Épave du Donator',
      locality: 'Porquerolles',
      region: 'Var',
      area: 'Méditerranée',
      latitude: 42.979,
      longitude: 6.223,
      type: 'epave',
      depthMinM: 30,
      depthMaxM: 39.5,
      accessNotes: 'Bouée du club.',
      createdVia: 'full',
      createdAt: '2026-04-01T08:00:00.123Z',
      updatedAt: '2026-04-02T09:30:00.456Z',
    } satisfies SiteResponse);
  });

  it('keeps every field not entered as null (site created by its name)', () => {
    const response = toSiteResponse(
      site({
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
      }),
    );
    expect(response).toMatchObject({
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
    });
  });
});
