import { describe, expect, it } from 'vitest';
import { DEFAULT_QUERY } from '../lib/query';
import { computeFacets, describeLog, selectDives, summarize } from '../lib/selectDives';
import { mockDives } from './dives';
import { generateDives } from './generateDives';

const MOCKUP_ROWS = [
  '#127 2026-04-08 Pointe de la Revellata 42 38 14 AIR MR,LB,TN',
  '#126 2026-04-07 La Bibliothèque 28 46 14 NITROX32 MR,LB,TN,EM,RP',
  '#125 2026-04-06 Épave du B-17 27 41 14 NITROX32 MR,LB,TN,CL',
  '#124 2026-04-05 Punta Bianca 18 52 15 AIR MR,TN',
  '#123 2026-03-22 Les Moyades 35 40 13 AIR MR,EM,HD,NF',
  '#122 2026-03-21 Épave du Liban 32 35 13 AIR MR,EM,RP',
  '#121 2026-03-08 Sec de la Croix 30 42 13 NITROX32 MR,RP,CL,MA,HD,NF',
  '#120 2026-02-15 La Gabinière 38 37 13 AIR MR,SB',
  '#119 2026-02-14 Épave du Donator 39 32 13 AIR MR,SB,JK,MA',
  '#118 2025-12-28 Cap Roux 24 44 14 AIR MR,JK',
];

describe('mocked dive log', () => {
  it('is deterministic', () => {
    expect(generateDives()).toEqual(mockDives);
  });

  it('starts with the 10 rows of the mockup', () => {
    const rows = selectDives(mockDives, DEFAULT_QUERY).items.map(
      (d) =>
        `#${d.number} ${d.date.slice(0, 10)} ${d.site.name} ${d.depthMaxM} ${d.durationMin} ${d.temperatureC} ${d.gasMix} ${d.team.map((m) => m.initials).join(',')}`,
    );
    expect(rows).toEqual(MOCKUP_ROWS);
  });

  it('matches the summary band and the header of the mockup', () => {
    const summary = summarize(mockDives);
    expect(summary).toMatchObject({
      count: 127,
      totalMinutes: 84 * 60 + 23,
      maxDepthM: 42,
      sites: 23,
    });
    expect(summary.avgDepthM?.toFixed(1)).toBe('24.6');
    expect(describeLog(mockDives)).toMatchObject({ totalDives: 127, diverCount: 14 });
    expect(describeLog(mockDives).firstDiveDate?.slice(0, 7)).toBe('2019-06');
  });

  it('numbers the dives chronologically from #1 to #127', () => {
    const byNumber = [...mockDives].sort((a, b) => a.number - b.number);
    expect(byNumber.map((d) => d.number)).toEqual(Array.from({ length: 127 }, (_u, i) => i + 1));
    const days = byNumber.map((d) => d.date.slice(0, 16));
    expect(days).toEqual([...days].sort());
    expect(byNumber.slice(0, 117).every((d) => d.date < '2025-12-28')).toBe(true);
  });

  it('matches the counters of the filters sheet', () => {
    const facets = computeFacets(mockDives);
    expect(facets.regions.map(({ name, count }) => [name, count])).toEqual([
      ['Var', 48],
      ['Corse', 31],
      ['Marseille', 22],
      ['Bretagne', 17],
      ['Esterel', 9],
    ]);
    expect(
      facets.members.slice(0, 3).map(({ member, count }) => [member.firstName, count]),
    ).toEqual([
      ['Lucas', 24],
      ['Thao', 18],
      ['Élise', 11],
    ]);
    expect(facets.members).toHaveLength(14);
    expect(facets.members.slice(3).every(({ count }) => count <= 10)).toBe(true);

    const sheet = {
      ...DEFAULT_QUERY,
      regions: ['corse'],
      depthMin: 20,
      depthMax: 40,
      with: ['b1'],
    };
    expect(selectDives(mockDives, sheet).total).toBe(9);
  });

  it('matches the no-result mockup: 3 wrecks in Brittany, none beyond 40 m', () => {
    const query = { ...DEFAULT_QUERY, q: 'épave', regions: ['bretagne'], depthMin: 40 };
    const result = selectDives(mockDives, query);
    expect(result.total).toBe(0);
    expect(result.relaxation).toEqual({ filter: 'depth', total: 3 });
  });

  it('keeps realistic values: teams of 2 to 6, depths up to 40 m but the 42 m record', () => {
    expect(mockDives.every((d) => d.team.length >= 2 && d.team.length <= 6)).toBe(true);
    expect(mockDives.every((d) => d.team[0]?.isSelf)).toBe(true);
    expect(mockDives.filter((d) => d.depthMaxM > 40).map((d) => d.number)).toEqual([127]);
  });
});
