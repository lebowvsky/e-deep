import type { DiveWriteRequest } from '@e-deep/shared';
import { diveWriteRequest } from '../../../test/support/dive-write-request';
import type { DiveEvent } from './dive-event.entity';
import type { DiveParticipation } from './dive-participation.entity';
import { isSameDiveWrite, toDiveWrite } from './dive-write.mapper';
import type { Dive } from './dive.types';

const BUDDY_A = '01900000-0000-7000-8000-00000000000a';
const BUDDY_B = '01900000-0000-7000-8000-00000000000b';
const IDENTITY = { id: 'participation-1', certificationLevelId: 'level-n2' };

function request(overrides: Parameters<typeof diveWriteRequest>[0] = {}): DiveWriteRequest {
  return diveWriteRequest({
    buddies: [
      { id: BUDDY_B, firstName: 'Lucas', lastName: 'Bernard', levelCode: null, isNew: false },
      { id: BUDDY_A, firstName: 'Thao', lastName: 'Nguyen', levelCode: 'N3', isNew: true },
    ],
    observations: [
      { label: ' Mérou brun ', count: 2 },
      { label: 'Corb', count: null },
    ],
    ...overrides,
  });
}

/** The dive as stored after writing `source` (what `upsertDive` reads back). */
function storedDive(source: DiveWriteRequest): Dive {
  const write = toDiveWrite(source, IDENTITY);
  return {
    event: { ...write.event, creatorId: 'diver-1' } as unknown as DiveEvent,
    participation: {
      ...write.participation,
      diveEventId: write.event.id,
      diverId: 'diver-1',
    } as unknown as DiveParticipation,
    buddyIds: [...write.buddyIds].sort(),
    observations: write.observations.map(({ label, count }) => ({ label: label.trim(), count })),
  };
}

describe('toDiveWrite', () => {
  it('maps the request to a live aggregate with the identity chosen by the server', () => {
    const source = request({ baseUpdatedAt: '2026-07-16T07:30:00.123Z' });

    const write = toDiveWrite(source, IDENTITY);

    expect(write.event).toEqual({
      ...source.event,
      startedAt: new Date('2026-04-09T08:05:00.000Z'),
      baseUpdatedAt: new Date('2026-07-16T07:30:00.123Z'),
      deletedAt: null,
    });
    expect(write.participation).toEqual({
      ...source.participation,
      ...IDENTITY,
      baseUpdatedAt: new Date('2026-07-16T07:30:00.123Z'),
      deletedAt: null,
    });
    expect(write.buddyIds).toEqual([BUDDY_B, BUDDY_A]);
    expect(write.observations).toEqual([
      { label: ' Mérou brun ', count: 2 },
      { label: 'Corb', count: null },
    ]);
  });

  it('keeps nothing of the identity object but its id and level', () => {
    const entity = { ...IDENTITY, maxDepthM: 99, notes: 'stored' };

    const write = toDiveWrite(request(), entity);

    expect(write.participation.maxDepthM).toBe(32.5);
    expect(write.participation.notes).toBeNull();
  });

  it('leaves a creation without base', () => {
    const write = toDiveWrite(request(), { id: 'p', certificationLevelId: null });

    expect(write.event.baseUpdatedAt).toBeNull();
    expect(write.participation).toMatchObject({ baseUpdatedAt: null, certificationLevelId: null });
  });
});

describe('isSameDiveWrite', () => {
  it('recognises the stored dive written from the same request', () => {
    const source = request();
    expect(isSameDiveWrite(toDiveWrite(source, IDENTITY), storedDive(source))).toBe(true);
  });

  it('compares the instant, the dive team as a set and uuids whatever their case', () => {
    const source = request();
    const replay = request({
      event: {
        ...source.event,
        siteId: source.event.siteId.toUpperCase(),
        startedAt: '2026-04-09T08:05:00.000Z',
      },
      buddies: [...source.buddies].reverse().map((buddy) => ({
        ...buddy,
        id: buddy.id.toUpperCase(),
      })),
    });

    expect(isSameDiveWrite(toDiveWrite(replay, IDENTITY), storedDive(source))).toBe(true);
  });

  it('ignores the participation identity and level, decided by the server', () => {
    const source = request();
    const write = toDiveWrite(source, { id: 'another', certificationLevelId: null });

    expect(isSameDiveWrite(write, storedDive(source))).toBe(true);
  });

  it.each<[string, Parameters<typeof diveWriteRequest>[0]]>([
    ['the instant', { event: { startedAt: '2026-04-09T10:06:00+02:00' } }],
    ['the offset', { event: { utcOffsetMinutes: 60 } }],
    ['the site', { event: { siteId: BUDDY_A } }],
    ['a condition', { event: { weather: 'SUNNY' } }],
    ['a measure', { participation: { maxDepthM: 32.4 } }],
    ['a nullable detail', { participation: { weightKg: 4 } }],
    ['the notes', { participation: { notes: 'Belle plongée' } }],
    ['the dive team', { buddies: [] }],
    [
      'the order of the observations',
      {
        observations: [
          { label: 'Corb', count: null },
          { label: 'Mérou brun', count: 2 },
        ],
      },
    ],
    [
      'an observation count',
      {
        observations: [
          { label: 'Mérou brun', count: 3 },
          { label: 'Corb', count: null },
        ],
      },
    ],
  ])('detects a different %s', (_label, overrides) => {
    const source = request();
    const changed = request({
      ...overrides,
      event: { ...source.event, ...overrides?.event },
      participation: { ...source.participation, ...overrides?.participation },
    });

    expect(isSameDiveWrite(toDiveWrite(changed, IDENTITY), storedDive(source))).toBe(false);
  });
});
