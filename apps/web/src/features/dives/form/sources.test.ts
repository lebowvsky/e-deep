import { describe, expect, it } from 'vitest';
import { elise, lucas, makeDive, thao } from '../mocks/diveFixture';
import { MOCK_SITES } from '@/shared/sites/mocks/sites';
import {
  createMemorySitesRepository,
  EMPTY_SITES_OVERLAY,
} from '@/shared/sites/repository/sitesRepository';
import { formSourcesOf } from '../mocks/diveFormFixture';
import { SELF } from '../mocks/roster';
import { proposeSurfaceInterval, diveNumberFor, proposeSurfaceIntervalFor } from './sources';

const bibliotheque = {
  id: 's02',
  name: 'La Bibliothèque',
  place: 'Calvi · Corse',
  region: 'corse',
  regionName: 'Corse',
};

const log = [
  makeDive({ number: 1, date: '2026-04-08T09:00:00+02:00', team: [SELF, lucas, thao] }),
  makeDive({ number: 2, date: '2026-04-08T14:00:00+02:00', team: [SELF, lucas], durationMin: 50 }),
  makeDive({
    number: 3,
    date: '2026-04-09T10:00:00+02:00',
    team: [SELF, elise],
    site: bibliotheque,
  }),
];

describe('buildDiveFormSources', () => {
  const sources = formSourcesOf(log);

  it('lists my sites with their dive counts, most dived first', () => {
    expect(sources.sites).toEqual([
      {
        id: 's01',
        name: 'Pointe de la Revellata',
        place: 'Calvi · Corse',
        diveCount: 2,
        isSaved: true,
      },
      { id: 's02', name: 'La Bibliothèque', place: 'Calvi · Corse', diveCount: 1, isSaved: true },
    ]);
  });

  it('gives the regions of my sites and the one of the latest dive', () => {
    expect(sources.regions).toStrictEqual(['Calvi · Corse']);
    // #3, at the Bibliothèque.
    expect(sources.lastRegion).toBe('Calvi · Corse');
    expect(formSourcesOf([]).lastRegion).toBeNull();
  });

  it('adds the sites created on this device, unsaved, and drops the deleted ones', async () => {
    const repository = createMemorySitesRepository();
    await repository.save(MOCK_SITES.grotteAuxCorbs);
    await repository.save({ ...MOCK_SITES.revellata, name: 'La Revellata' });
    await repository.remove('s02');

    const { sites } = formSourcesOf(log, await repository.read());

    expect(sites).toEqual([
      { id: 's01', name: 'La Revellata', place: 'Calvi · Corse', diveCount: 2, isSaved: true },
      {
        id: 's24',
        name: 'Revellata — Grotte aux Corbs',
        place: 'Calvi · Corse',
        diveCount: 0,
        isSaved: false,
      },
    ]);
  });

  it('counts the dives of a merged site on its target', async () => {
    const repository = createMemorySitesRepository();
    await repository.merge('s02', MOCK_SITES.revellata);

    const sources = formSourcesOf(log, await repository.read());

    expect(sources.sites.map(({ id, diveCount }) => [id, diveCount])).toEqual([['s01', 3]]);
    // The latest dive was at the Bibliothèque, merged into the Revellata.
    expect(sources.lastRegion).toBe('Calvi · Corse');
    expect(formSourcesOf(log, EMPTY_SITES_OVERLAY).sites).toHaveLength(2);
  });

  it('lists the divers met by frequency, the diver left out', () => {
    expect(sources.divers.map(({ member, count }) => [member.firstName, count])).toEqual([
      ['Lucas', 2],
      ['Élise', 1],
      ['Thao', 1],
    ]);
    expect(sources.frequentDivers).toHaveLength(3);
  });

  it('gives the highest number, and no dive centre nor species (absent from the log)', () => {
    expect(sources.maxNumber).toBe(3);
    expect(formSourcesOf([]).maxNumber).toBe(0);
    expect(sources.diveCenters).toEqual([]);
    expect(sources.species).toEqual([]);
  });
});

describe('diveNumberFor', () => {
  /** A dive written at +02:00: an edit (`diveId` left out of the count), or a new dive's id. */
  const at = (diveId: string) =>
    ({
      kind: 'update',
      diveId,
      utcOffsetMinutes: 120,
      observationCounts: new Map(),
      isRepetitive: null,
      baseUpdatedAt: '2026-04-09T07:30:00.000Z',
    }) as const;

  it('gives the rank the dive will have in the log, by its start (D26)', () => {
    expect(diveNumberFor(log, { date: '2026-04-10', entryTime: '09:00' }, at('n'), 'n')).toBe(4);
    expect(diveNumberFor(log, { date: '2026-04-08', entryTime: '12:00' }, at('n'), 'n')).toBe(2);
    expect(diveNumberFor(log, { date: '2026-04-01', entryTime: '09:00' }, at('n'), 'n')).toBe(1);
  });

  it('places a dive without immersion at the end of its day, and last without a date', () => {
    expect(diveNumberFor(log, { date: '2026-04-08', entryTime: '' }, at('n'), 'n')).toBe(3);
    expect(diveNumberFor(log, { date: '', entryTime: '' }, { kind: 'create' }, 'n')).toBe(4);
  });

  it('breaks a tie on the start by id, like the API', () => {
    const start = { date: '2026-04-08', entryTime: '14:00' };
    expect(diveNumberFor(log, start, at('a'), 'a')).toBe(2);
    expect(diveNumberFor(log, start, at('z'), 'z')).toBe(3);
  });

  it('moves the edited dive with its new date, itself left out of the count', () => {
    expect(diveNumberFor(log, { date: '2026-04-08', entryTime: '14:00' }, at('d2'), 'n')).toBe(2);
    expect(diveNumberFor(log, { date: '2026-04-10', entryTime: '09:00' }, at('d2'), 'n')).toBe(3);
  });
});

describe('proposeSurfaceInterval', () => {
  it('measures from the end of the previous dive, under 12 h', () => {
    // #2 ends at 14:50.
    expect(proposeSurfaceInterval(log, '2026-04-08T16:20:00+02:00', null)).toBe(90);
    expect(proposeSurfaceInterval(log, '2026-04-09T02:50:00+02:00', null)).toBeNull();
    expect(proposeSurfaceInterval(log, '2026-04-08T08:00:00+02:00', null)).toBeNull();
  });

  it('skips the edited dive itself', () => {
    expect(proposeSurfaceInterval(log, '2026-04-08T14:00:00+02:00', 'd2')).toBe(255);
  });

  it('reads the start of the edited dive in its own offset, and waits for valid values', () => {
    const update = {
      kind: 'update',
      diveId: 'd2',
      utcOffsetMinutes: 120,
      observationCounts: new Map(),
      isRepetitive: null,
      baseUpdatedAt: '2026-04-09T07:30:00.000Z',
    } as const;
    const entry = { date: '2026-04-08', entryTime: '14:00' };
    expect(proposeSurfaceIntervalFor(log, entry, update)).toBe(255);
    expect(proposeSurfaceIntervalFor(log, { ...entry, entryTime: '' }, update)).toBeNull();
    expect(proposeSurfaceIntervalFor(log, { ...entry, date: '' }, { kind: 'create' })).toBeNull();
  });
});
