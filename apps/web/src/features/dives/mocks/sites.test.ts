import { describe, expect, it } from 'vitest';
import { mockSites } from '@/shared/sites/mocks/sites';
import { mockDives } from './dives';
import { SITES } from './sites';

// The sites mocks (`@/shared/sites/mocks`) describe the same sites as the dive log mocks.
describe('sites mocks', () => {
  const byId = new Map(mockSites.map((site) => [site.id, site]));

  it('describe every site of the dive log, with the same name and region', () => {
    for (const site of Object.values(SITES)) {
      expect(byId.get(site.id), site.name).toMatchObject({ name: site.name, region: site.place });
    }
  });

  it('add only « Revellata — Grotte aux Corbs », unplaced and not dived', () => {
    const logIds = new Set(Object.values(SITES).map(({ id }) => id));
    const extra = mockSites.filter(({ id }) => !logIds.has(id));

    expect(extra).toMatchObject([{ name: 'Revellata — Grotte aux Corbs', position: null }]);
    expect(mockDives.some((dive) => dive.site.id === extra[0]?.id)).toBe(false);
  });
});
