import type { DiveDetail, DiveSummary } from '@e-deep/shared';
import { NotFoundException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import type { DiveDetailRow, DiveSummaryRow, DiveTeamRow } from './dive-contract.mapper';
import { DIVE_LOG_MAX, DiveLogService } from './dive-log.service';

const DIVER_ID = '01900000-0000-7000-8000-000000000001';

const query = jest.fn<Promise<unknown>, [string, unknown[]]>();
const transaction = jest.fn<
  Promise<unknown>,
  [string, (manager: EntityManager) => Promise<unknown>]
>();

const manager = { query } as unknown as EntityManager;
const dataSource = { transaction } as unknown as DataSource;

function summaryRow(values: Partial<DiveSummaryRow> = {}): DiveSummaryRow {
  return {
    id: 'event-1',
    participation_id: 'participation-1',
    number: 1,
    started_at: new Date('2026-07-14T18:00:00.000Z'),
    utc_offset_minutes: 180,
    max_depth_m: '32.50',
    duration_min: 52,
    water_temperature_c: '24.5',
    gas_mix: 'NITROX32',
    notes: null,
    site_id: 'site-1',
    site_name: 'Ras Mohammed',
    site_locality: 'Sharm el-Sheikh',
    site_region: 'Mer Rouge',
    ...values,
  };
}

function detailRow(values: Partial<DiveDetailRow> = {}): DiveDetailRow {
  return {
    ...summaryRow(),
    visibility_m: 25,
    has_decompression: true,
    stops_ok: false,
    site_latitude: '27.734100',
    site_longitude: '34.256400',
    ...values,
  };
}

function teamRow(participationId: string, id: string, firstName: string): DiveTeamRow {
  return { participation_id: participationId, id, first_name: firstName, last_name: 'Durand' };
}

/** SQL and parameters of each `manager.query` call, in order. */
function queries(): { sql: string; parameters: unknown[] }[] {
  return query.mock.calls.map(([sql, parameters]) => ({ sql, parameters }));
}

describe('DiveLogService', () => {
  let service: DiveLogService;

  beforeEach(() => {
    query.mockReset();
    transaction.mockReset();
    transaction.mockImplementation((_isolation, run) => run(manager));
    service = new DiveLogService(dataSource);
  });

  describe('findAll', () => {
    it('runs both queries in one REPEATABLE READ transaction', async () => {
      query.mockResolvedValueOnce([summaryRow()]).mockResolvedValueOnce([]);

      await service.findAll(DIVER_ID);

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(transaction.mock.calls[0]?.[0]).toBe('REPEATABLE READ');
      expect(query).toHaveBeenCalledTimes(2);
    });

    it('maps the rows to the contract in the order returned by the query', async () => {
      const latest = summaryRow({
        id: 'event-2',
        participation_id: 'participation-2',
        number: 2,
        started_at: new Date('2026-08-01T07:30:00.000Z'),
        utc_offset_minutes: 120,
        max_depth_m: '18',
        water_temperature_c: null,
        gas_mix: 'AIR',
        notes: 'Mérous',
        site_locality: null,
      });
      const oldest = summaryRow();
      query
        .mockResolvedValueOnce([latest, oldest])
        .mockResolvedValueOnce([
          teamRow('participation-1', 'buddy-a', 'Lucas'),
          teamRow('participation-1', 'buddy-b', 'Thao'),
        ]);

      const result = await service.findAll(DIVER_ID);

      expect(result).toStrictEqual({
        dives: [
          {
            id: 'event-2',
            number: 2,
            date: '2026-08-01T09:30:00+02:00',
            utcOffsetMinutes: 120,
            site: { id: 'site-1', name: 'Ras Mohammed', locality: null, region: 'Mer Rouge' },
            depthMaxM: 18,
            durationMin: 52,
            temperatureC: null,
            gasMix: 'AIR',
            notes: 'Mérous',
            buddies: [],
          },
          {
            id: 'event-1',
            number: 1,
            date: '2026-07-14T21:00:00+03:00',
            utcOffsetMinutes: 180,
            site: {
              id: 'site-1',
              name: 'Ras Mohammed',
              locality: 'Sharm el-Sheikh',
              region: 'Mer Rouge',
            },
            depthMaxM: 32.5,
            durationMin: 52,
            temperatureC: 24.5,
            gasMix: 'NITROX32',
            notes: null,
            buddies: [
              { id: 'buddy-a', firstName: 'Lucas', lastName: 'Durand' },
              { id: 'buddy-b', firstName: 'Thao', lastName: 'Durand' },
            ],
          },
        ] satisfies DiveSummary[],
      });
    });

    it('filters every query by the owner and caps the log at DIVE_LOG_MAX', async () => {
      query
        .mockResolvedValueOnce([summaryRow(), summaryRow({ participation_id: 'participation-2' })])
        .mockResolvedValueOnce([]);

      await service.findAll(DIVER_ID);

      const [dives, teams] = queries();
      expect(dives?.parameters).toStrictEqual([DIVER_ID, DIVE_LOG_MAX]);
      expect(dives?.sql).toMatch(/p\.diver_id = \$1/);
      expect(dives?.sql).toMatch(/ORDER BY n\.started_at DESC, n\.id DESC\s+LIMIT \$2/);
      expect(teams?.parameters).toStrictEqual([DIVER_ID, ['participation-1', 'participation-2']]);
      expect(teams?.sql).toMatch(/db\.owner_id = \$1/);
    });

    it('does not query the teams when the diver has no dive', async () => {
      query.mockResolvedValueOnce([]);

      await expect(service.findAll(DIVER_ID)).resolves.toStrictEqual({ dives: [] });
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    const EVENT_ID = '01900000-0000-7000-8000-0000000000aa';

    it('maps the detail fields of the dive', async () => {
      query
        .mockResolvedValueOnce([detailRow()])
        .mockResolvedValueOnce([teamRow('participation-1', 'buddy-a', 'Lucas')]);

      const result = await service.findOne(DIVER_ID, EVENT_ID);

      expect(result).toStrictEqual({
        id: 'event-1',
        number: 1,
        date: '2026-07-14T21:00:00+03:00',
        utcOffsetMinutes: 180,
        site: {
          id: 'site-1',
          name: 'Ras Mohammed',
          locality: 'Sharm el-Sheikh',
          region: 'Mer Rouge',
          latitude: 27.7341,
          longitude: 34.2564,
        },
        depthMaxM: 32.5,
        durationMin: 52,
        temperatureC: 24.5,
        gasMix: 'NITROX32',
        notes: null,
        buddies: [{ id: 'buddy-a', firstName: 'Lucas', lastName: 'Durand' }],
        visibilityM: 25,
        hadDecompression: true,
        stopsOk: false,
      } satisfies DiveDetail);
    });

    it('filters both queries by the owner, in one REPEATABLE READ transaction', async () => {
      query.mockResolvedValueOnce([detailRow()]).mockResolvedValueOnce([]);

      await expect(service.findOne(DIVER_ID, EVENT_ID)).resolves.toMatchObject({ buddies: [] });

      expect(transaction.mock.calls[0]?.[0]).toBe('REPEATABLE READ');
      const [dive, teams] = queries();
      expect(dive?.parameters).toStrictEqual([DIVER_ID, EVENT_ID]);
      expect(dive?.sql).toMatch(/p\.diver_id = \$1/);
      expect(dive?.sql).toMatch(/WHERE n\.id = \$2/);
      expect(teams?.parameters).toStrictEqual([DIVER_ID, ['participation-1']]);
    });

    it('throws NotFoundException when no live dive of the diver matches', async () => {
      // Absent, deleted and foreign dives all come back as no row: one single path.
      query.mockResolvedValueOnce([]);

      await expect(service.findOne(DIVER_ID, EVENT_ID)).rejects.toThrow(NotFoundException);
      expect(query).toHaveBeenCalledTimes(1);
    });
  });
});
