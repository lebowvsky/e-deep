import { describe, expect, it } from 'vitest';
import { elise, lucas, makeDive, thao } from '../mocks/diveFixture';
import { SELF } from '../mocks/roster';
import { describeDiveInLog } from './diveInsights';

const otherSite = {
  id: 's02',
  name: 'La Bibliothèque',
  place: 'Saint-Raphaël · Var',
  region: 'var',
  regionName: 'Var',
};

// Latest first, like the API; numbers 1 to 4.
const log = [
  makeDive({ number: 4, depthMaxM: 18, team: [SELF, lucas, thao] }),
  makeDive({ number: 3, depthMaxM: 42, site: otherSite, team: [SELF, thao] }),
  makeDive({ number: 2, depthMaxM: 30, team: [SELF, lucas] }),
  makeDive({ number: 1, depthMaxM: 12, team: [SELF] }),
];

const at = (number: number) => {
  const dive = log.find((entry) => entry.number === number);
  if (!dive) throw new Error(`No dive ${number}`);
  return dive;
};

describe('describeDiveInLog', () => {
  it('gives the chronological neighbours, by logbook number', () => {
    const insights = describeDiveInLog(log, at(3));
    expect(insights.previous).toStrictEqual({
      id: 'd2',
      number: 2,
      siteName: 'Pointe de la Revellata',
    });
    expect(insights.next).toStrictEqual({
      id: 'd4',
      number: 4,
      siteName: 'Pointe de la Revellata',
    });
  });

  it('has no previous dive for the first one, no next dive for the latest one', () => {
    expect(describeDiveInLog(log, at(1)).previous).toBeNull();
    expect(describeDiveInLog(log, at(4)).next).toBeNull();
  });

  it('skips the gaps of the numbering', () => {
    const gapped = log.filter((dive) => dive.number !== 3);
    expect(describeDiveInLog(gapped, at(2)).next?.number).toBe(4);
  });

  it('flags the deepest dive of the log as the personal best, ties included', () => {
    expect(describeDiveInLog(log, at(3)).isPersonalBest).toBe(true);
    expect(describeDiveInLog(log, at(2)).isPersonalBest).toBe(false);
    const tie = makeDive({ number: 5, depthMaxM: 42 });
    expect(describeDiveInLog([tie, ...log], tie).isPersonalBest).toBe(true);
  });

  it('counts the dives on the same site and their deepest one', () => {
    expect(describeDiveInLog(log, at(4)).site).toStrictEqual({ diveCount: 3, maxDepthM: 30 });
    expect(describeDiveInLog(log, at(3)).site).toStrictEqual({ diveCount: 1, maxDepthM: 42 });
  });

  it('counts the dives shared with each buddy of the team, never with the user', () => {
    const { sharedDives } = describeDiveInLog(log, at(4));
    expect(sharedDives.get(lucas.id)).toBe(2);
    expect(sharedDives.get(thao.id)).toBe(2);
    expect(sharedDives.has(SELF.id)).toBe(false);
    expect(sharedDives.has(elise.id)).toBe(false);
  });

  it('reads the fresh detail, not the stale copy of the dive in the cached log', () => {
    // The log still has d4 at 50 m with Élise; the detail says 18 m with Lucas and Thao.
    const stale = log.map((entry) =>
      entry.number === 4 ? { ...entry, depthMaxM: 50, team: [SELF, elise] } : entry,
    );
    const insights = describeDiveInLog(stale, at(4));
    expect(insights.isPersonalBest).toBe(false);
    expect(insights.site).toStrictEqual({ diveCount: 3, maxDepthM: 30 });
    expect(insights.sharedDives.get(lucas.id)).toBe(2);
    expect(insights.sharedDives.get(thao.id)).toBe(2);
    expect(insights.sharedDives.has(elise.id)).toBe(false);
  });

  it('still counts the dive itself when the cached log does not have it yet', () => {
    const fresh = makeDive({ number: 5, depthMaxM: 50, team: [SELF, lucas, elise] });
    const insights = describeDiveInLog(log, fresh);
    expect(insights.previous?.number).toBe(4);
    expect(insights.next).toBeNull();
    expect(insights.isPersonalBest).toBe(true);
    // Three Revellata dives in the log, plus this one.
    expect(insights.site).toStrictEqual({ diveCount: 4, maxDepthM: 50 });
    expect(insights.sharedDives.get(lucas.id)).toBe(3);
    expect(insights.sharedDives.get(elise.id)).toBe(1);
  });
});
