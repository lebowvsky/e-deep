import type { DiveWriteBuddy, DiveWriteRequest, DiveWriteResponse } from '@e-deep/shared';
import { NotFoundException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import { diveWriteRequest } from '../../../test/support/dive-write-request';
import { IdentifierConflictError, InvalidReferenceError } from '../../common/errors/domain-errors';
import { Buddy } from '../buddies/buddy.entity';
import type { BuddiesService } from '../buddies/buddies.service';
import { CertificationLevel } from '../certification-levels/certification-level.entity';
import { DiveSite } from '../dive-sites/dive-site.entity';
import type { DiveSitesService } from '../dive-sites/dive-sites.service';
import type { DiveEvent } from './dive-event.entity';
import type { DiveLogService } from './dive-log.service';
import type { DiveParticipation } from './dive-participation.entity';
import { toDiveWrite } from './dive-write.mapper';
import { DiveWriteService } from './dive-write.service';
import type { Dive, DiveLookup, DiveWrite } from './dive.types';
import type { DivesService } from './dives.service';

const DIVER_ID = '01900000-0000-7000-8000-000000000001';
const OTHER_DIVER_ID = '01900000-0000-7000-8000-000000000002';
const BUDDY_ID = '01900000-0000-7000-8000-0000000000b1';
const MERGED_SITE_ID = '01900000-0000-7000-8000-0000000000c1';
const TARGET_SITE_ID = '01900000-0000-7000-8000-0000000000c2';
const N3_ID = 'level-n3';
const SAVED: DiveWriteResponse = { id: 'dive', number: 12, updatedAt: '2026-11-18T10:00:00.000Z' };

const UUID = /^[0-9a-f-]{36}$/;

/** Rows the fake manager finds, by entity. */
interface StoredRows {
  sites?: Partial<DiveSite>[];
  buddies?: Partial<Buddy>[];
  /** Buddies as read under lock, when they changed since the unlocked read. */
  lockedBuddies?: Partial<Buddy>[] | undefined;
}

function setup(lookup: DiveLookup, rows: StoredRows = {}) {
  const findBy = (entity: unknown, where: Record<string, unknown>, locked = false): unknown => {
    const matches = (row: Record<string, unknown>) =>
      Object.entries(where).every(([key, value]) => row[key] === value);
    if (entity === DiveSite) return rows.sites?.find(matches) ?? null;
    if (entity === Buddy) {
      return ((locked ? rows.lockedBuddies : undefined) ?? rows.buddies)?.find(matches) ?? null;
    }
    if (entity === CertificationLevel) {
      return where['agency'] === 'FFESSM' && where['code'] === 'N3' ? { id: N3_ID } : null;
    }
    throw new Error('Unexpected entity');
  };
  const manager = {
    query: jest.fn().mockResolvedValue([]),
    findOneBy: jest.fn((entity: unknown, where: Record<string, unknown>) =>
      Promise.resolve(findBy(entity, where)),
    ),
    findOne: jest.fn(
      (entity: unknown, { where, lock }: { where: Record<string, unknown>; lock?: unknown }) =>
        Promise.resolve(findBy(entity, where, lock !== undefined)),
    ),
  };
  const dataSource = {
    transaction: (run: (m: EntityManager) => Promise<unknown>) =>
      run(manager as unknown as EntityManager),
  };
  const dives = {
    findDiveForWriteIn: jest.fn().mockResolvedValue(lookup),
    upsertDiveIn: jest.fn().mockResolvedValue({ status: 'applied' }),
  };
  const sites = { upsertIn: jest.fn().mockResolvedValue({ status: 'applied' }) };
  const buddies = { upsertIn: jest.fn().mockResolvedValue({ status: 'applied' }) };
  const diveLog = { numberOfIn: jest.fn().mockResolvedValue(SAVED) };
  const service = new DiveWriteService(
    dataSource as unknown as DataSource,
    dives as unknown as DivesService,
    sites as unknown as DiveSitesService,
    buddies as unknown as BuddiesService,
    diveLog as unknown as DiveLogService,
  );
  return { service, manager, dives, sites, buddies, diveLog };
}

function writtenDive(dives: { upsertDiveIn: jest.Mock }): DiveWrite {
  const [call] = dives.upsertDiveIn.mock.calls as [EntityManager, string, DiveWrite, Date][];
  if (call === undefined) {
    throw new Error('No dive written');
  }
  expect(call[1]).toBe(DIVER_ID);
  return call[2];
}

/** The stored dive written from `request`, live unless `deletedAt` is given. */
function stored(request: DiveWriteRequest, deletedAt: Date | null = null): Dive {
  const write = toDiveWrite(request, { id: 'participation-1', certificationLevelId: 'level-n2' });
  return {
    event: { ...write.event, creatorId: DIVER_ID, deletedAt } as unknown as DiveEvent,
    participation: { ...write.participation, deletedAt } as unknown as DiveParticipation,
    buddyIds: write.buddyIds,
    observations: write.observations,
  };
}

function buddy(values: Partial<DiveWriteBuddy> = {}): DiveWriteBuddy {
  return {
    id: BUDDY_ID,
    firstName: 'Lucas',
    lastName: 'Bernard',
    levelCode: null,
    isNew: false,
    ...values,
  };
}

describe('DiveWriteService', () => {
  describe('create', () => {
    it('creates the new site (quick) and buddies, then the dive, and answers its number', async () => {
      const { service, manager, dives, sites, buddies, diveLog } = setup({ status: 'absent' });
      const request = diveWriteRequest({
        site: { name: 'Tombant des Américains', isNew: true },
        buddies: [buddy({ isNew: true, levelCode: 'N3' })],
      });

      const creation = await service.create(DIVER_ID, request);

      expect(creation).toEqual({ outcome: 'created', saved: SAVED });
      expect(sites.upsertIn).toHaveBeenCalledWith(
        expect.anything(),
        DIVER_ID,
        {
          id: request.site.id,
          name: 'Tombant des Américains',
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
          baseUpdatedAt: null,
          deletedAt: null,
        },
        expect.any(Date),
      );
      expect(buddies.upsertIn).toHaveBeenCalledWith(
        expect.anything(),
        DIVER_ID,
        {
          id: BUDDY_ID,
          firstName: 'Lucas',
          lastName: 'Bernard',
          linkedDiverId: null,
          certificationLevelId: N3_ID,
          baseUpdatedAt: null,
          deletedAt: null,
        },
        expect.any(Date),
      );
      const write = writtenDive(dives);
      expect(write.event.id).toBe(request.event.id);
      expect(write.participation.id).toMatch(UUID);
      expect(write.participation.certificationLevelId).toBeNull();
      expect(write.buddyIds).toEqual([BUDDY_ID]);
      // Numbered within the transaction: a concurrent deletion cannot turn it into a 404.
      expect(diveLog.numberOfIn).toHaveBeenCalledWith(manager, DIVER_ID, request.event.id);
    });

    it('writes the buddies sorted by id, whatever their order and case', async () => {
      const first = '01900000-0000-7000-8000-0000000000a1';
      const second = '01900000-0000-7000-8000-0000000000B1';
      const third = '01900000-0000-7000-8000-0000000000c1';
      const { service, buddies } = setup({ status: 'absent' });
      const request = diveWriteRequest({
        buddies: [third, second, first].map((id) => buddy({ id, isNew: true })),
      });

      await service.create(DIVER_ID, request);

      const written = (buddies.upsertIn.mock.calls as [unknown, string, { id: string }][]).map(
        ([, , write]) => write.id,
      );
      expect(written).toEqual([first, second, third]);
    });

    it('leaves a site or a buddy already created by the diver as is', async () => {
      const request = diveWriteRequest({
        site: { isNew: true },
        buddies: [buddy({ isNew: true, levelCode: 'N3' })],
      });
      const { service, sites, buddies, dives } = setup(
        { status: 'absent' },
        {
          sites: [{ id: request.site.id, ownerId: DIVER_ID }],
          buddies: [{ id: BUDDY_ID, ownerId: DIVER_ID }],
        },
      );

      await service.create(DIVER_ID, request);

      expect(sites.upsertIn).not.toHaveBeenCalled();
      expect(buddies.upsertIn).not.toHaveBeenCalled();
      expect(dives.upsertDiveIn).toHaveBeenCalledTimes(1);
    });

    it.each(['site', 'buddy'] as const)(
      "refuses to create a %s with another diver's id, like an unknown reference (D-24)",
      async (kind) => {
        const request = diveWriteRequest({
          site: { isNew: kind === 'site' },
          buddies: [buddy({ isNew: true })],
        });
        const foreign = { ownerId: OTHER_DIVER_ID };
        const { service, dives } = setup(
          { status: 'absent' },
          kind === 'site'
            ? { sites: [{ id: request.site.id, ...foreign }] }
            : { buddies: [{ id: BUDDY_ID, ...foreign }] },
        );

        await expect(service.create(DIVER_ID, request)).rejects.toThrow(InvalidReferenceError);
        expect(dives.upsertDiveIn).not.toHaveBeenCalled();
      },
    );

    it('refuses an unknown level code for a new buddy', async () => {
      const { service, dives } = setup({ status: 'absent' });
      const request = diveWriteRequest({ buddies: [buddy({ isNew: true, levelCode: 'PADI' })] });

      await expect(service.create(DIVER_ID, request)).rejects.toThrow(InvalidReferenceError);
      expect(dives.upsertDiveIn).not.toHaveBeenCalled();
    });

    it('answers a replayed creation without writing', async () => {
      const request = diveWriteRequest({
        site: { isNew: true },
        buddies: [buddy({ isNew: true })],
      });
      const { service, manager, dives, sites, buddies, diveLog } = setup({
        status: 'own',
        dive: stored(request),
      });

      expect(await service.create(DIVER_ID, request)).toEqual({
        outcome: 'replayed',
        saved: SAVED,
      });
      expect(diveLog.numberOfIn).toHaveBeenCalledWith(manager, DIVER_ID, request.event.id);
      expect(sites.upsertIn).not.toHaveBeenCalled();
      expect(buddies.upsertIn).not.toHaveBeenCalled();
      expect(dives.upsertDiveIn).not.toHaveBeenCalled();
    });

    it('writes a dive on a merged site to its target (RG-36), without recreating the site', async () => {
      const request = diveWriteRequest({ site: { id: MERGED_SITE_ID, isNew: true } });
      const { service, dives, sites } = setup(
        { status: 'absent' },
        { sites: [{ id: MERGED_SITE_ID, ownerId: DIVER_ID, mergedIntoId: TARGET_SITE_ID }] },
      );

      await service.create(DIVER_ID, request);

      expect(sites.upsertIn).not.toHaveBeenCalled();
      expect(writtenDive(dives).event.siteId).toBe(TARGET_SITE_ID);
    });

    it('answers a creation replayed after its site was merged as the same creation', async () => {
      const request = diveWriteRequest({ site: { id: MERGED_SITE_ID } });
      const merged = stored({
        ...request,
        event: { ...request.event, siteId: TARGET_SITE_ID },
        site: { ...request.site, id: TARGET_SITE_ID },
      });
      const { service, dives } = setup(
        { status: 'own', dive: merged },
        { sites: [{ id: MERGED_SITE_ID, ownerId: DIVER_ID, mergedIntoId: TARGET_SITE_ID }] },
      );

      expect(await service.create(DIVER_ID, request)).toEqual({
        outcome: 'replayed',
        saved: SAVED,
      });
      expect(dives.upsertDiveIn).not.toHaveBeenCalled();
    });

    it.each<[string, (request: DiveWriteRequest) => DiveLookup]>([
      [
        'another content',
        (request) => ({
          status: 'own',
          dive: stored({
            ...request,
            participation: { ...request.participation, durationMin: 40 },
          }),
        }),
      ],
      ['a deleted dive', (request) => ({ status: 'own', dive: stored(request, new Date()) })],
      ["another diver's event", () => ({ status: 'foreign' })],
    ])('refuses an id already taken by %s', async (_label, lookupOf) => {
      const request = diveWriteRequest();
      const { service, dives, diveLog } = setup(lookupOf(request));

      await expect(service.create(DIVER_ID, request)).rejects.toThrow(IdentifierConflictError);
      expect(dives.upsertDiveIn).not.toHaveBeenCalled();
      expect(diveLog.numberOfIn).not.toHaveBeenCalled();
    });
  });

  describe('replace', () => {
    it('rewrites the dive under its participation and level snapshot', async () => {
      const request = diveWriteRequest({ baseUpdatedAt: '2026-07-16T07:30:00.000Z' });
      const { service, manager, dives, diveLog } = setup({ status: 'own', dive: stored(request) });

      expect(await service.replace(DIVER_ID, request.event.id, request)).toEqual(SAVED);

      expect(writtenDive(dives).participation).toMatchObject({
        id: 'participation-1',
        certificationLevelId: 'level-n2',
        baseUpdatedAt: new Date('2026-07-16T07:30:00.000Z'),
        deletedAt: null,
      });
      expect(diveLog.numberOfIn).toHaveBeenCalledWith(manager, DIVER_ID, request.event.id);
    });

    it.each<[string, (request: DiveWriteRequest) => DiveLookup]>([
      ['absent', () => ({ status: 'absent' })],
      ['deleted', (request) => ({ status: 'own', dive: stored(request, new Date()) })],
      ["another diver's", () => ({ status: 'foreign' })],
    ])('answers 404 for a dive %s, without writing', async (_label, lookupOf) => {
      const request = diveWriteRequest({ site: { isNew: true } });
      const { service, dives, sites } = setup(lookupOf(request));

      await expect(service.replace(DIVER_ID, request.event.id, request)).rejects.toThrow(
        NotFoundException,
      );
      expect(sites.upsertIn).not.toHaveBeenCalled();
      expect(dives.upsertDiveIn).not.toHaveBeenCalled();
    });

    it('answers 404 should the write be rejected as a stale restore', async () => {
      const request = diveWriteRequest();
      const { service, dives } = setup({ status: 'own', dive: stored(request) });
      dives.upsertDiveIn.mockResolvedValue({ status: 'rejected' });

      await expect(service.replace(DIVER_ID, request.event.id, request)).rejects.toThrow(
        NotFoundException,
      );
    });

    describe('level of an existing buddy (D-21)', () => {
      const contact = {
        id: BUDDY_ID,
        ownerId: DIVER_ID,
        firstName: 'Lucas',
        lastName: 'Bernard',
        linkedDiverId: null,
        certificationLevelId: null,
        updatedAt: new Date('2026-07-01T00:00:00.000Z'),
        deletedAt: null,
      };

      function replaceWith(
        levelCode: string | null,
        buddies: Partial<Buddy>[] = [contact],
        lockedBuddies?: Partial<Buddy>[],
      ) {
        const request = diveWriteRequest({ buddies: [buddy({ levelCode })] });
        const doubles = setup({ status: 'own', dive: stored(request) }, { buddies, lockedBuddies });
        return {
          ...doubles,
          run: () => doubles.service.replace(DIVER_ID, request.event.id, request),
        };
      }

      function lockedReads(manager: { findOne: jest.Mock }): unknown[] {
        return (manager.findOne.mock.calls as [unknown, { lock?: unknown }][])
          .filter(([entity, { lock }]) => entity === Buddy && lock !== undefined)
          .map(([entity]) => entity);
      }

      it('rewrites the contact sheet with the new level only, read again under lock', async () => {
        const renamed = { ...contact, firstName: 'Luc', updatedAt: new Date('2026-07-02') };
        const { run, buddies, manager } = replaceWith('N3', [contact], [renamed]);

        await run();

        expect(lockedReads(manager)).toHaveLength(1);
        expect(buddies.upsertIn).toHaveBeenCalledWith(
          expect.anything(),
          DIVER_ID,
          {
            id: BUDDY_ID,
            firstName: 'Luc',
            lastName: 'Bernard',
            linkedDiverId: null,
            certificationLevelId: N3_ID,
            baseUpdatedAt: renamed.updatedAt,
            deletedAt: null,
          },
          expect.any(Date),
        );
      });

      it('neither locks nor writes when the level is unchanged or not given', async () => {
        const unchanged = replaceWith('N3', [{ ...contact, certificationLevelId: N3_ID }]);
        await unchanged.run();
        expect(unchanged.buddies.upsertIn).not.toHaveBeenCalled();
        expect(lockedReads(unchanged.manager)).toEqual([]);

        const notGiven = replaceWith(null);
        await notGiven.run();
        expect(notGiven.buddies.upsertIn).not.toHaveBeenCalled();
        expect(lockedReads(notGiven.manager)).toEqual([]);
      });

      it('writes nothing when the level was set meanwhile, as seen under lock', async () => {
        const { run, buddies } = replaceWith(
          'N3',
          [contact],
          [{ ...contact, certificationLevelId: N3_ID }],
        );

        await run();

        expect(buddies.upsertIn).not.toHaveBeenCalled();
      });

      it("refuses another diver's buddy or an unknown level", async () => {
        await expect(replaceWith('N3', []).run()).rejects.toThrow(InvalidReferenceError);
        await expect(replaceWith('X9').run()).rejects.toThrow(InvalidReferenceError);
      });
    });
  });
});
