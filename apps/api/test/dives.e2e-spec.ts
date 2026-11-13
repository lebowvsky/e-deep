import type { DiveDetail, DiveLogResponse, DiveSummary } from '@e-deep/shared';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource, type EntityManager } from 'typeorm';
import { CurrentDiverGuard } from '../src/common/auth/current-diver.guard';
import { configureApp } from '../src/configure-app';
import type { DiveDetailRow, DiveTeamRow } from '../src/modules/dives/dive-contract.mapper';
import { DIVE_LOG_MAX, DiveLogService } from '../src/modules/dives/dive-log.service';
import { DivesController } from '../src/modules/dives/dives.controller';

const DIVER_ID = '01900000-0000-7000-8000-000000000001';
const EVENT_ID = '01900000-0000-7000-8000-0000000000aa';
const UNKNOWN_ID = '01900000-0000-7000-8000-0000000000ff';

const ROW: DiveDetailRow = {
  id: EVENT_ID,
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
  visibility_m: 25,
  has_decompression: false,
  stops_ok: true,
  site_latitude: '27.734100',
  site_longitude: '34.256400',
};

const TEAM: DiveTeamRow[] = [
  { participation_id: 'participation-1', id: 'buddy-1', first_name: 'Lucas', last_name: 'Moreau' },
];

const SUMMARY: DiveSummary = {
  id: EVENT_ID,
  number: 1,
  date: '2026-07-14T21:00:00+03:00',
  utcOffsetMinutes: 180,
  site: { id: 'site-1', name: 'Ras Mohammed', locality: 'Sharm el-Sheikh', region: 'Mer Rouge' },
  depthMaxM: 32.5,
  durationMin: 52,
  temperatureC: 24.5,
  gasMix: 'NITROX32',
  notes: null,
  buddies: [{ id: 'buddy-1', firstName: 'Lucas', lastName: 'Moreau' }],
};

/** Raw queries of `DiveLogService` (through the transaction manager). */
const query = jest.fn<Promise<unknown>, [string, unknown[]]>();
/** `CurrentDiverGuard` lookup of the first diver. */
const find = jest.fn<Promise<{ id: string }[]>, []>();
let devAuthStub = true;

/** Stands in for the database: no connection, the real `DiveLogService` and guard run on it. */
const fakeDataSource = {
  manager: { find },
  transaction: (_isolation: string, run: (manager: EntityManager) => Promise<unknown>) =>
    run({ query } as unknown as EntityManager),
};

describe('/api/dives (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DivesController],
      providers: [
        DiveLogService,
        CurrentDiverGuard,
        { provide: DataSource, useValue: fakeDataSource },
        { provide: ConfigService, useValue: { get: () => devAuthStub } },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, { corsOrigins: ['http://localhost:5173'] });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    devAuthStub = true;
    query.mockReset();
    find.mockReset();
    find.mockResolvedValue([{ id: DIVER_ID }]);
  });

  describe('GET /api/dives', () => {
    it('returns the log of the current diver', async () => {
      query.mockResolvedValueOnce([ROW]).mockResolvedValueOnce(TEAM);

      const response = await request(app.getHttpServer()).get('/api/dives').expect(200);

      expect(response.body).toStrictEqual({ dives: [SUMMARY] } satisfies DiveLogResponse);
      // The owner comes from the guard, never from the request.
      expect(query.mock.calls[0]?.[1]).toStrictEqual([DIVER_ID, DIVE_LOG_MAX]);
    });

    it('returns an empty log', async () => {
      query.mockResolvedValueOnce([]);

      const response = await request(app.getHttpServer()).get('/api/dives').expect(200);

      expect(response.body).toStrictEqual({ dives: [] });
    });

    it('returns 401 when no diver can be resolved (stub disabled)', async () => {
      devAuthStub = false;

      const response = await request(app.getHttpServer()).get('/api/dives').expect(401);

      expect(response.body).toStrictEqual({ message: 'Unauthorized', statusCode: 401 });
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/dives/:id', () => {
    it('returns the dive of the current diver', async () => {
      query.mockResolvedValueOnce([ROW]).mockResolvedValueOnce(TEAM);

      const response = await request(app.getHttpServer()).get(`/api/dives/${EVENT_ID}`).expect(200);

      expect(response.body).toStrictEqual({
        ...SUMMARY,
        site: { ...SUMMARY.site, latitude: 27.7341, longitude: 34.2564 },
        visibilityM: 25,
        hadDecompression: false,
        stopsOk: true,
      } satisfies DiveDetail);
      expect(query.mock.calls[0]?.[1]).toStrictEqual([DIVER_ID, EVENT_ID]);
    });

    it('returns a generic 404 for a dive that is not a live dive of the diver', async () => {
      query.mockResolvedValueOnce([]);

      const response = await request(app.getHttpServer())
        .get(`/api/dives/${UNKNOWN_ID}`)
        .expect(404);

      expect(response.body).toStrictEqual({
        message: 'Dive not found',
        error: 'Not Found',
        statusCode: 404,
      });
      expect(JSON.stringify(response.body)).not.toContain(UNKNOWN_ID);
    });

    it('returns 400 for an id that is not a UUID, without querying', async () => {
      const response = await request(app.getHttpServer()).get('/api/dives/abc').expect(400);

      expect(response.body).toMatchObject({ statusCode: 400 });
      expect(query).not.toHaveBeenCalled();
    });

    it('returns 401 when no diver can be resolved (stub disabled)', async () => {
      devAuthStub = false;

      await request(app.getHttpServer()).get(`/api/dives/${EVENT_ID}`).expect(401);
      expect(query).not.toHaveBeenCalled();
    });
  });
});
