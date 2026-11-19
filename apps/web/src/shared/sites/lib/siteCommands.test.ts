import type { DiveSummary } from '@e-deep/shared';
import { describe, expect, it } from 'vitest';
import type { SiteDraft, SiteEntry } from '@/shared/model/site';
import type { SitePositions } from '../api/sitePositionsApi';
import { MOCK_SITES } from '../mocks/sites';
import { createMemorySitesRepository, type SitesRepository } from '../repository/sitesRepository';
import { buildSiteCatalogue } from './siteCatalogue';
import { createSite, deleteSite, mergeSites, updateSite } from './siteCommands';

const NOW = new Date('2026-11-19T10:00:00.000Z');

function summary(
  id: string,
  number: number,
  site: DiveSummary['site'],
  overrides: Partial<DiveSummary> = {},
): DiveSummary {
  return {
    id,
    number,
    date: `2026-0${number}-01T10:00:00+02:00`,
    utcOffsetMinutes: 120,
    site,
    depthMaxM: 20 + number,
    durationMin: 40,
    temperatureC: 15,
    gasMix: 'AIR',
    notes: null,
    buddies: [],
    entryType: null,
    diveCenter: null,
    ...overrides,
  };
}

const REVELLATA = { id: 's01', name: 'Pointe de la Revellata', locality: 'Calvi', region: 'Corse' };
// Created by its name from the dive form: no region, no position.
const TYPO = { id: 'x1', name: 'Revelata', locality: null, region: null };
const LIBAN = { id: 's07', name: 'Épave du Liban', locality: 'Frioul', region: 'Marseille' };

// Latest first, as the API serves the log.
const DIVES = [
  summary('d5', 5, REVELLATA),
  summary('d4', 4, TYPO, { depthMaxM: 41 }),
  summary('d3', 3, LIBAN),
  summary('d2', 2, TYPO),
  summary('d1', 1, REVELLATA),
];
const POSITIONS: SitePositions = new Map([
  ['s01', { latitude: 42.583, longitude: 8.725 }],
  ['s07', { latitude: 43.2617, longitude: 5.2958 }],
]);

async function catalogue(repository: SitesRepository): Promise<SiteEntry[]> {
  return buildSiteCatalogue({
    dives: DIVES,
    positions: POSITIONS,
    overlay: await repository.read(),
  });
}

function entryOf(entries: readonly SiteEntry[], id: string): SiteEntry {
  const entry = entries.find(({ site }) => site.id === id);
  if (!entry) throw new Error(`No site ${id}`);
  return entry;
}

const DRAFT: SiteDraft = {
  name: '  Grotte aux Corbs ',
  region: ' Calvi · Corse ',
  type: 'grotte',
  depthMinM: null,
  depthMaxM: null,
  position: null,
  accessNotes: '  ',
};

describe('buildSiteCatalogue', () => {
  it('lists the sites of the log with their position, dives and statistics', async () => {
    const entries = await catalogue(createMemorySitesRepository());

    expect(entries.map(({ site }) => site.id)).toStrictEqual(['s01', 'x1', 's07']);
    const revellata = entryOf(entries, 's01');
    expect(revellata.site).toMatchObject({
      name: 'Pointe de la Revellata',
      region: 'Calvi · Corse',
      zone: 'mediterranee',
      position: { latitude: 42.583, longitude: 8.725 },
      createdVia: 'full',
    });
    expect(revellata.dives.map(({ id }) => id)).toStrictEqual(['d5', 'd1']);
    expect(revellata.stats).toMatchObject({ diveCount: 2, maxDepth: { depthM: 25, number: 5 } });
    expect(entryOf(entries, 'x1').site).toMatchObject({
      region: null,
      zone: 'autre',
      position: null,
      createdVia: 'quick',
    });
  });
});

describe('createSite and updateSite', () => {
  it('creates a site without dive, trimmed, with its zone', async () => {
    const repository = createMemorySitesRepository();
    const site = await createSite(repository, DRAFT, { id: 'new', createdVia: 'quick', now: NOW });

    expect(site).toStrictEqual({
      id: 'new',
      name: 'Grotte aux Corbs',
      region: 'Calvi · Corse',
      zone: 'mediterranee',
      type: 'grotte',
      depthMinM: null,
      depthMaxM: null,
      position: null,
      accessNotes: null,
      createdVia: 'quick',
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });
    expect(entryOf(await catalogue(repository), 'new').stats.diveCount).toBe(0);
  });

  it('refuses a site without a name', async () => {
    const repository = createMemorySitesRepository();
    await expect(
      createSite(repository, { ...DRAFT, name: '  ' }, { id: 'new', createdVia: 'full', now: NOW }),
    ).rejects.toThrow('A site needs a name.');
    expect((await repository.read()).saved.size).toBe(0);
  });

  it('places a site of the API and keeps its dives', async () => {
    const repository = createMemorySitesRepository();
    const typo = entryOf(await catalogue(repository), 'x1').site;
    const position = { latitude: 42.5794, longitude: 8.7262 };

    await updateSite(repository, typo, { ...DRAFT, name: 'Revelata', position }, NOW);

    const placed = entryOf(await catalogue(repository), 'x1');
    expect(placed.site).toMatchObject({ position, zone: 'mediterranee', createdVia: 'quick' });
    expect(placed.site.updatedAt).toBe(NOW.toISOString());
    expect(placed.stats.diveCount).toBe(2);
  });
});

describe('mergeSites', () => {
  it('moves the dives to the target, completes its empty fields and deletes the source', async () => {
    const repository = createMemorySitesRepository();
    // The source has what the target lacks (type, access notes) and a region of its own.
    await updateSite(
      repository,
      entryOf(await catalogue(repository), 'x1').site,
      {
        ...DRAFT,
        name: 'Revelata',
        region: 'Corse',
        type: 'tombant',
        accessNotes: 'Mouillage au phare.',
      },
      NOW,
    );
    const before = await catalogue(repository);

    const merged = await mergeSites(
      repository,
      entryOf(before, 'x1').site,
      entryOf(before, 's01').site,
      NOW,
    );

    const after = await catalogue(repository);
    expect(after.map(({ site }) => site.id)).toStrictEqual(['s01', 's07']);
    const target = entryOf(after, 's01');
    expect(target.site).toStrictEqual(merged);
    // Kept from the target: name, region, position; completed from the source: type, notes.
    expect(target.site).toMatchObject({
      name: 'Pointe de la Revellata',
      region: 'Calvi · Corse',
      position: { latitude: 42.583, longitude: 8.725 },
      type: 'tombant',
      accessNotes: 'Mouillage au phare.',
      updatedAt: NOW.toISOString(),
    });
    expect(target.dives.map(({ id }) => id)).toStrictEqual(['d5', 'd4', 'd2', 'd1']);
    expect(target.stats).toMatchObject({ diveCount: 4, maxDepth: { depthM: 41, number: 4 } });
  });

  it('follows earlier merges: the dives of a site merged into the source go to the target', async () => {
    const repository = createMemorySitesRepository();
    const entries = await catalogue(repository);
    await mergeSites(repository, entryOf(entries, 'x1').site, entryOf(entries, 's07').site, NOW);
    const middle = await catalogue(repository);
    await mergeSites(repository, entryOf(middle, 's07').site, entryOf(middle, 's01').site, NOW);

    const after = await catalogue(repository);
    expect(after.map(({ site }) => site.id)).toStrictEqual(['s01']);
    expect(entryOf(after, 's01').stats.diveCount).toBe(5);
  });

  it('refuses to merge a site into itself', async () => {
    const site = MOCK_SITES.revellata;
    await expect(mergeSites(createMemorySitesRepository(), site, site, NOW)).rejects.toThrow();
  });
});

describe('deleteSite', () => {
  it('refuses to delete a site with dives', async () => {
    const repository = createMemorySitesRepository();

    const result = await deleteSite(repository, entryOf(await catalogue(repository), 's01'));

    expect(result).toStrictEqual({ status: 'refused', diveCount: 2 });
    expect(entryOf(await catalogue(repository), 's01').stats.diveCount).toBe(2);
  });

  it('deletes a site without dive', async () => {
    const repository = createMemorySitesRepository();
    await createSite(repository, DRAFT, { id: 'new', createdVia: 'quick', now: NOW });

    const result = await deleteSite(repository, entryOf(await catalogue(repository), 'new'));

    expect(result).toStrictEqual({ status: 'deleted' });
    expect((await catalogue(repository)).map(({ site }) => site.id)).not.toContain('new');
  });
});
