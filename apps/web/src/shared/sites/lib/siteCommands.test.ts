import type { DiveSummary } from '@e-deep/shared';
import { describe, expect, it } from 'vitest';
import type { Site, SiteDraft, SiteEntry } from '@/shared/model/site';
import { createMemorySitesRepository, type MemoryDiveLog } from '../mocks/memorySitesRepository';
import { MOCK_SITES } from '../mocks/sites';
import { buildSiteCatalogue } from './siteCatalogue';
import { createSite, deleteSite, mergeSites, updateSite } from './siteCommands';
import { computeSiteStats } from './siteStats';

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

const REVELLATA = MOCK_SITES.revellata;
const LIBAN = MOCK_SITES.liban;
// Created by its name from the dive form: no region, no position, nothing else.
const TYPO: Site = {
  ...MOCK_SITES.grotteAuxCorbs,
  id: 'x1',
  name: 'Revelata',
  region: null,
  zone: 'autre',
  type: null,
  storedPlace: { locality: null, region: null, area: null },
};
const refOf = ({ id, name, storedPlace }: Site) => ({
  id,
  name,
  locality: storedPlace.locality,
  region: storedPlace.region,
});

/** Latest first, as the API serves the log. */
function newLog(): MemoryDiveLog {
  return {
    dives: [
      summary('d5', 5, refOf(REVELLATA), { entryType: 'BOAT', diveCenter: 'Calvi Plongée' }),
      summary('d4', 4, refOf(TYPO), { depthMaxM: 41 }),
      summary('d3', 3, refOf(LIBAN)),
      summary('d2', 2, refOf(TYPO)),
      summary('d1', 1, refOf(REVELLATA), { entryType: 'BOAT' }),
    ],
  };
}

function setUp() {
  const log = newLog();
  const repository = createMemorySitesRepository({
    sites: [REVELLATA, TYPO, LIBAN],
    log,
    now: () => NOW,
  });
  const catalogue = async () =>
    buildSiteCatalogue({ sites: await repository.list(), dives: log.dives });
  return { log, repository, catalogue };
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
  it('gives every site its dives (latest first), its statistics, most dived first', async () => {
    const { catalogue } = setUp();
    const entries = await catalogue();

    expect(entries.map(({ site }) => site.id)).toStrictEqual(['s01', 'x1', 's07']);
    const revellata = entryOf(entries, 's01');
    expect(revellata.dives.map(({ id }) => id)).toStrictEqual(['d5', 'd1']);
    expect(revellata.stats).toMatchObject({
      diveCount: 2,
      maxDepth: { depthM: 25, number: 5 },
      // Read from the log summary (D32).
      usualEntryType: 'BOAT',
      usualDiveCenter: 'Calvi Plongée',
    });
  });

  it('lists a site without dive, and leaves out the dives of a site it does not know', () => {
    const entries = buildSiteCatalogue({
      sites: [MOCK_SITES.grotteAuxCorbs],
      dives: newLog().dives,
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]?.stats.diveCount).toBe(0);
  });
});

describe('createSite and updateSite', () => {
  it('creates a site without dive, trimmed, with its zone and its origin', async () => {
    const { repository, catalogue } = setUp();
    const site = await createSite(repository, DRAFT, { id: 'new', createdVia: 'quick' });

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
      storedPlace: { locality: 'Calvi', region: 'Corse', area: null },
    });
    expect(entryOf(await catalogue(), 'new').stats.diveCount).toBe(0);
  });

  it('refuses a site without a name', async () => {
    const { repository } = setUp();
    await expect(
      createSite(repository, { ...DRAFT, name: '  ' }, { id: 'new', createdVia: 'full' }),
    ).rejects.toThrow('A site needs a name.');
    expect(await repository.list()).toHaveLength(3);
  });

  it('places a quick site and keeps its dives and its origin', async () => {
    const { repository, catalogue } = setUp();
    const position = { latitude: 42.5794, longitude: 8.7262 };

    await updateSite(repository, TYPO, { ...DRAFT, name: 'Revelata', position });

    const placed = entryOf(await catalogue(), 'x1');
    expect(placed.site).toMatchObject({ position, zone: 'mediterranee', createdVia: 'quick' });
    expect(placed.site.updatedAt).toBe(NOW.toISOString());
    expect(placed.stats.diveCount).toBe(2);
  });
});

describe('mergeSites', () => {
  it('moves the dives to the target, completes its empty fields and deletes the source', async () => {
    const { repository, catalogue, log } = setUp();
    // The source has what the target lacks (access notes), and a region of its own.
    const source = await updateSite(repository, TYPO, {
      ...DRAFT,
      name: 'Revelata',
      region: 'Corse',
      type: 'sec',
      accessNotes: 'Mouillage au phare.',
    });
    const target = await updateSite(repository, REVELLATA, { ...REVELLATA, accessNotes: null });

    const merged = await mergeSites(repository, source, target);

    const after = await catalogue();
    expect(after.map(({ site }) => site.id)).toStrictEqual(['s01', 's07']);
    const revellata = entryOf(after, 's01');
    expect(revellata.site).toStrictEqual(merged);
    // Kept from the target: name, region, type, position; completed from the source: notes.
    expect(revellata.site).toMatchObject({
      name: 'Pointe de la Revellata',
      region: 'Calvi · Corse',
      position: REVELLATA.position,
      type: 'tombant',
      accessNotes: 'Mouillage au phare.',
      updatedAt: NOW.toISOString(),
    });
    expect(revellata.dives.map(({ id }) => id)).toStrictEqual(['d5', 'd4', 'd2', 'd1']);
    expect(revellata.stats).toMatchObject({ diveCount: 4, maxDepth: { depthM: 41, number: 4 } });
    // The log names the target now, as the API joins it.
    expect(log.dives.find(({ id }) => id === 'd4')?.site.name).toBe('Pointe de la Revellata');
  });

  it('refuses to merge a site into itself', async () => {
    const { repository } = setUp();
    await expect(mergeSites(repository, REVELLATA, REVELLATA)).rejects.toThrow();
    await expect(repository.merge('s01', 's01')).rejects.toMatchObject({
      status: 422,
      code: 'merge-into-self',
    });
  });

  it('refuses an unknown source or target, as the API', async () => {
    const { repository } = setUp();
    await expect(repository.merge('nope', 's01')).rejects.toMatchObject({ status: 404 });
    await expect(repository.merge('s01', 'nope')).rejects.toMatchObject({
      status: 422,
      code: 'invalid-reference',
    });
  });
});

describe('deleteSite', () => {
  it('refuses to delete a site with dives, without asking', async () => {
    const { repository, catalogue } = setUp();

    const result = await deleteSite(repository, entryOf(await catalogue(), 's01'));

    expect(result).toStrictEqual({ status: 'refused', diveCount: 2 });
    expect(entryOf(await catalogue(), 's01').stats.diveCount).toBe(2);
  });

  it('is refused when the repository knows dives this log did not have', async () => {
    const { repository, catalogue } = setUp();
    const entry = { ...entryOf(await catalogue(), 's07'), stats: computeSiteStats([]) };

    expect(await deleteSite(repository, entry)).toStrictEqual({ status: 'refused', diveCount: 1 });
    expect((await repository.list()).map(({ id }) => id)).toContain('s07');
  });

  it('deletes a site without dive', async () => {
    const { repository, catalogue } = setUp();
    await createSite(repository, DRAFT, { id: 'new', createdVia: 'quick' });

    const result = await deleteSite(repository, entryOf(await catalogue(), 'new'));

    expect(result).toStrictEqual({ status: 'deleted' });
    expect((await catalogue()).map(({ site }) => site.id)).not.toContain('new');
  });
});
