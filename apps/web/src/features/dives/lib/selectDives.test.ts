import { describe, expect, it } from 'vitest';
import { SELF } from '../mocks/roster';
import { elise, lucas, makeDive, thao } from '../mocks/diveFixture';
import type { DivesQuery } from '../types';
import { DEFAULT_QUERY } from './query';
import { computeFacets, describeLog, selectDives, sortDives, summarize } from './selectDives';

const now = new Date(2026, 3, 10); // 10 April 2026

const marseille = {
  id: 's06',
  name: 'Les Moyades',
  place: 'Riou · Marseille',
  region: 'marseille' as const,
};
const brittanyWreck = {
  id: 's18',
  name: 'Épave de l’Amoco Cadiz',
  place: 'Portsall · Bretagne',
  region: 'bretagne' as const,
};

const dives = [
  makeDive({
    number: 1,
    date: '2024-08-02T10:00:00+02:00',
    site: brittanyWreck,
    depthMaxM: 28,
    durationMin: 40,
    team: [SELF, elise],
  }),
  makeDive({
    number: 2,
    date: '2025-03-15T10:00:00+01:00',
    site: marseille,
    depthMaxM: 35,
    durationMin: 38,
    gasMix: 'NITROX32',
    team: [SELF, lucas, thao],
  }),
  makeDive({
    number: 3,
    date: '2025-03-16T14:30:00+01:00',
    depthMaxM: 18,
    durationMin: 55,
    notes: 'Mérou curieux.',
  }),
  makeDive({
    number: 4,
    date: '2026-04-05T10:00:00+02:00',
    depthMaxM: 42,
    durationMin: 38,
    team: [SELF, lucas, thao, elise],
  }),
  makeDive({
    number: 5,
    date: '2026-04-08T10:30:00+02:00',
    depthMaxM: 27,
    durationMin: 41,
    gasMix: 'NITROX36',
  }),
];

const select = (patch: Partial<DivesQuery>) =>
  selectDives(dives, { ...DEFAULT_QUERY, ...patch }, now);
const numbers = (patch: Partial<DivesQuery>) =>
  select({ size: 50, ...patch }).items.map((d) => d.number);

describe('selectDives — filters', () => {
  it('keeps everything without filter, most recent first', () => {
    expect(numbers({})).toEqual([5, 4, 3, 2, 1]);
  });

  it('filters by region, depth range (inclusive), gas family and dive team', () => {
    expect(numbers({ regions: ['corse'] })).toEqual([5, 4, 3]);
    expect(numbers({ regions: ['corse', 'marseille'] })).toEqual([5, 4, 3, 2]);
    expect(numbers({ depthMin: 27, depthMax: 35 })).toEqual([5, 2, 1]);
    expect(numbers({ depthMin: 40 })).toEqual([4]);
    expect(numbers({ gases: ['nitrox'] })).toEqual([5, 2]);
    expect(numbers({ gases: ['air', 'other'] })).toEqual([4, 3, 1]);
    // Dived with Lucas AND Thao.
    expect(numbers({ with: [lucas.id, thao.id] })).toEqual([4, 2]);
  });

  it('filters by period: last 12 months or a calendar year', () => {
    expect(numbers({ period: '12m' })).toEqual([5, 4]);
    expect(numbers({ period: '2025' })).toEqual([3, 2]);
  });

  it('searches site, place, team members and notes, without accents or case', () => {
    expect(numbers({ q: 'EPAVE' })).toEqual([1]);
    expect(numbers({ q: 'riou' })).toEqual([2]);
    expect(numbers({ q: 'élise' })).toEqual([4, 1]);
    expect(numbers({ q: 'merou' })).toEqual([3]);
    // Every word must match.
    expect(numbers({ q: 'lucas marchand' })).toEqual([4]);
  });

  it('combines the filters', () => {
    expect(numbers({ regions: ['corse'], depthMin: 20, depthMax: 40, with: [lucas.id] })).toEqual([
      5,
    ]);
  });
});

describe('selectDives — sort and pagination', () => {
  it('sorts by date, depth or duration', () => {
    expect(sortDives(dives, 'date').map((d) => d.number)).toEqual([1, 2, 3, 4, 5]);
    expect(sortDives(dives, '-depth').map((d) => d.number)).toEqual([4, 2, 1, 5, 3]);
    // Same duration (38 min): the most recent first.
    expect(sortDives(dives, '-duration').map((d) => d.number)).toEqual([3, 5, 1, 4, 2]);
  });

  it('slices the requested page and counts the pages', () => {
    const page2 = select({ size: 10, page: 1 });
    expect(page2).toMatchObject({ total: 5, page: 1, pageCount: 1 });

    const many = Array.from({ length: 23 }, (_unused, index) => makeDive({ number: index + 1 }));
    const result = selectDives(many, { ...DEFAULT_QUERY, page: 3 }, now);
    expect(result).toMatchObject({ total: 23, page: 3, pageCount: 3 });
    expect(result.items.map((d) => d.number)).toEqual([3, 2, 1]);
  });

  it('clamps a page beyond the last one', () => {
    expect(select({ page: 9 })).toMatchObject({ page: 1, pageCount: 1 });
  });
});

describe('selectDives — summary', () => {
  it('is computed on the whole filtered selection, not on the page', () => {
    const result = select({ regions: ['corse'], size: 10, page: 1 });
    expect(result.summary).toMatchObject({
      count: 3,
      totalMinutes: 41 + 38 + 55,
      avgDepthM: (27 + 42 + 18) / 3,
      maxDepthM: 42,
      sites: 1,
    });
    expect(result.summary.byMonth).toEqual({
      '2026-04': { count: 2, minutes: 79 },
      '2025-03': { count: 1, minutes: 55 },
    });

    const firstPage = selectDives(
      Array.from({ length: 12 }, (_unused, index) =>
        makeDive({ number: index + 1, durationMin: 10 }),
      ),
      DEFAULT_QUERY,
      now,
    );
    expect(firstPage.items).toHaveLength(10);
    expect(firstPage.summary).toMatchObject({ count: 12, totalMinutes: 120 });
  });

  it('is empty (no average, no max) without result', () => {
    expect(summarize([])).toEqual({
      count: 0,
      totalMinutes: 0,
      avgDepthM: null,
      maxDepthM: null,
      sites: 0,
      byMonth: {},
    });
  });
});

describe('selectDives — no result', () => {
  it('suggests removing the filter that brings back the most dives', () => {
    const result = select({ q: 'épave', regions: ['bretagne'], depthMin: 40 });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.relaxation).toEqual({ filter: 'depth', total: 1 });
  });

  it('has no suggestion when there are results or when no single removal helps', () => {
    expect(select({ regions: ['corse'] }).relaxation).toBeNull();
    expect(select({ q: 'atlantide', regions: ['esterel'] }).relaxation).toBeNull();
  });
});

describe('facets and log overview', () => {
  it('counts the dives per region and per member, most frequent first', () => {
    const facets = computeFacets(dives);
    expect(facets.regions).toEqual({ corse: 3, var: 0, marseille: 1, esterel: 0, bretagne: 1 });
    expect(facets.members.map(({ member, count }) => [member.firstName, count])).toEqual([
      ['Lucas', 4],
      ['Élise', 2],
      ['Thao', 2],
    ]);
  });

  it('describes the whole log', () => {
    expect(describeLog(dives)).toEqual({
      totalDives: 5,
      firstDiveDate: '2024-08-02T10:00:00+02:00',
      diverCount: 3,
    });
    expect(describeLog([])).toEqual({ totalDives: 0, firstDiveDate: null, diverCount: 0 });
  });
});
