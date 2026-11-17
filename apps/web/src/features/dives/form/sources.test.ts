import { describe, expect, it } from 'vitest';
import { elise, lucas, makeDive, thao } from '../mocks/diveFixture';
import { SELF } from '../mocks/roster';
import { buildDiveFormSources, proposeSurfaceInterval, takenNumbers } from './sources';

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
  const sources = buildDiveFormSources(log);

  it('lists my sites with their dive counts, most dived first', () => {
    expect(sources.sites).toEqual([
      { id: 's01', name: 'Pointe de la Revellata', place: 'Calvi · Corse', diveCount: 2 },
      { id: 's02', name: 'La Bibliothèque', place: 'Calvi · Corse', diveCount: 1 },
    ]);
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
    expect(buildDiveFormSources([]).maxNumber).toBe(0);
    expect(sources.diveCenters).toEqual([]);
    expect(sources.species).toEqual([]);
  });

  it('gives the numbers taken by the other dives', () => {
    expect(takenNumbers(log, 'd2')).toEqual(new Set([1, 3]));
    expect(takenNumbers(log, null)).toEqual(new Set([1, 2, 3]));
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
});
