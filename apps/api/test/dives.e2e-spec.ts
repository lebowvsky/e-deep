import type { DiveDetail, DiveLogResponse, DiveSummary } from '@e-deep/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { DataSource, type EntityManager } from 'typeorm';
import { configureApp } from '../src/configure-app';
import type {
  DiveDetailRow,
  DiveDetailTeamRow,
  DiveObservationRow,
  DiveTeamRow,
} from '../src/modules/dives/dive-contract.mapper';
import { DIVE_LOG_MAX, DiveLogService } from '../src/modules/dives/dive-log.service';
import { DiveWriteService } from '../src/modules/dives/dive-write.service';
import { DivesController } from '../src/modules/dives/dives.controller';
import {
  ADMIN_COOKIE,
  STAFF_SESSION,
  WEB_COOKIE,
  accessControlProviders,
  onboardingFakes,
  resetAccessControlFakes,
  sameOrigin,
  sessionFakes,
  signIn,
} from './support/access-control';

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
  site_area: 'Mer Rouge',
  level_agency: 'FFESSM',
  level_code: 'N2',
  level_label: 'Niveau 2',
  entry_type: 'BOAT',
  time_of_day: 'NIGHT',
  weather: 'SUNNY',
  air_temperature_c: '28.5',
  sea_state: 'SLIGHT',
  current_strength: 'MODERATE',
  dive_center: 'Ras Diving',
  surface_water_temperature_c: '26.0',
  safety_stop_duration_min: 3,
  safety_stop_depth_m: '5.0',
  is_repetitive: false,
  o2_percent: null,
  tank_volume_l: '12.0',
  tank_material: 'ALUMINIUM',
  start_pressure_bar: 200,
  end_pressure_bar: 60,
  suit_type: 'WET',
  suit_thickness_mm: '5.0',
  weight_kg: null,
  created_at: new Date('2026-07-14T20:00:00.000Z'),
  updated_at: new Date('2026-07-16T07:30:00.000Z'),
};

const DETAIL_TEAM: DiveDetailTeamRow[] = [
  {
    participation_id: 'participation-1',
    id: 'buddy-1',
    first_name: 'Lucas',
    last_name: 'Moreau',
    level_agency: 'FFESSM',
    level_code: 'N3',
    level_label: 'Niveau 3',
  },
];

const OBSERVATIONS: DiveObservationRow[] = [
  { position: 0, label: 'Napoléon', count: 1 },
  { position: 1, label: 'Raies pastenague', count: null },
];

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
  entryType: 'BOAT',
  diveCenter: 'Ras Diving',
};

/** Raw queries of `DiveLogService` (through the transaction manager). */
const query = jest.fn<Promise<unknown>, [string, unknown[]]>();
/** The session cookie of the request; `undefined`: none. */
let cookie: string | undefined;

/** Stands in for the database: no connection, the real `DiveLogService` runs on it. */
const fakeDataSource = {
  transaction: (_isolation: string, run: (manager: EntityManager) => Promise<unknown>) =>
    run({ query } as unknown as EntityManager),
};

describe('/api/dives (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DivesController],
      providers: [
        DiveLogService,
        ...accessControlProviders(),
        // The writes have their own suite (`dives-write.e2e-spec.ts`).
        { provide: DiveWriteService, useValue: {} },
        { provide: DataSource, useValue: fakeDataSource },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, { trustProxy: 0 });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    cookie = WEB_COOKIE;
    query.mockReset();
    resetAccessControlFakes();
    signIn();
  });

  /** Same-origin requests, with the web cookie of the signed-in diver unless `cookie` is cleared. */
  const server = () => {
    const agent = sameOrigin(app);
    return cookie === undefined ? agent : agent.set('Cookie', cookie);
  };

  describe('GET /api/dives', () => {
    it('returns the log of the current diver', async () => {
      query.mockResolvedValueOnce([ROW]).mockResolvedValueOnce(TEAM);

      const response = await server().get('/api/dives').expect(200);

      expect(response.body).toStrictEqual({ dives: [SUMMARY] } satisfies DiveLogResponse);
      expect(response.headers['cache-control']).toBe('no-store');
      // The owner comes from the guard, never from the request.
      expect(query.mock.calls[0]?.[1]).toStrictEqual([DIVER_ID, DIVE_LOG_MAX]);
    });

    it('returns an empty log', async () => {
      query.mockResolvedValueOnce([]);

      const response = await server().get('/api/dives').expect(200);

      expect(response.body).toStrictEqual({ dives: [] });
    });

    it('returns 401 when no diver can be resolved (no session cookie)', async () => {
      cookie = undefined;

      const response = await server().get('/api/dives').expect(401);

      expect(response.body).toStrictEqual({ statusCode: 401, code: 'unauthenticated' });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('access control (global SessionGuard)', () => {
    it.each([
      ['profile-required', 'onboarding-required'],
      ['consent-required', 'consent-required'],
    ])('403 %s → %s on the dive log, no-store, without querying', async (status, code) => {
      onboardingFakes.statusOf.mockResolvedValue(status);

      const response = await server().get('/api/dives').expect(403);

      expect(response.body).toStrictEqual({ statusCode: 403, code });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(onboardingFakes.statusOf).toHaveBeenCalledWith(DIVER_ID);
      expect(query).not.toHaveBeenCalled();
    });

    it('401 with the admin cookie only: a web route reads the web cookie', async () => {
      cookie = ADMIN_COOKIE;
      signIn(STAFF_SESSION);

      const response = await server().get('/api/dives').expect(401);

      expect(response.body).toStrictEqual({ statusCode: 401, code: 'unauthenticated' });
      expect(sessionFakes.resolve).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/dives/:id', () => {
    it('returns the dive of the current diver with every detail field', async () => {
      query
        .mockResolvedValueOnce([ROW])
        .mockResolvedValueOnce(DETAIL_TEAM)
        .mockResolvedValueOnce(OBSERVATIONS);

      const response = await server().get(`/api/dives/${EVENT_ID}`).expect(200);

      expect(response.body).toStrictEqual({
        ...SUMMARY,
        site: { ...SUMMARY.site, latitude: 27.7341, longitude: 34.2564, area: 'Mer Rouge' },
        buddies: [
          {
            id: 'buddy-1',
            firstName: 'Lucas',
            lastName: 'Moreau',
            level: { agency: 'FFESSM', code: 'N3', label: 'Niveau 3' },
          },
        ],
        visibilityM: 25,
        hadDecompression: false,
        stopsOk: true,
        diverLevel: { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' },
        entryType: 'BOAT',
        timeOfDay: 'NIGHT',
        weather: 'SUNNY',
        airTemperatureC: 28.5,
        seaState: 'SLIGHT',
        currentStrength: 'MODERATE',
        diveCenter: 'Ras Diving',
        surfaceTemperatureC: 26,
        safetyStopDurationMin: 3,
        safetyStopDepthM: 5,
        isRepetitive: false,
        o2Percent: null,
        tankVolumeL: 12,
        tankMaterial: 'ALUMINIUM',
        startPressureBar: 200,
        endPressureBar: 60,
        suitType: 'WET',
        suitThicknessMm: 5,
        weightKg: null,
        observations: [
          { label: 'Napoléon', count: 1 },
          { label: 'Raies pastenague', count: null },
        ],
        createdAt: '2026-07-14T20:00:00.000Z',
        updatedAt: '2026-07-16T07:30:00.000Z',
      } satisfies DiveDetail);
      expect(query.mock.calls[0]?.[1]).toStrictEqual([DIVER_ID, EVENT_ID]);
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('returns a generic 404 for a dive that is not a live dive of the diver', async () => {
      query.mockResolvedValueOnce([]);

      const response = await server().get(`/api/dives/${UNKNOWN_ID}`).expect(404);

      expect(response.body).toStrictEqual({
        message: 'Dive not found',
        error: 'Not Found',
        statusCode: 404,
      });
      expect(JSON.stringify(response.body)).not.toContain(UNKNOWN_ID);
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('returns a generic 400 for an id that is not valid percent-encoding, never echoing it', async () => {
      const marker = 'zq-path-marker';

      const response = await server().get(`/api/dives/%FF${marker}`).expect(400);

      expect(response.body).toStrictEqual({
        statusCode: 400,
        code: 'validation-failed',
        fieldErrors: { _path: ['malformed'] },
      });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.text).not.toContain(marker);
      expect(query).not.toHaveBeenCalled();
    });

    it('returns 400 for an id that is not a UUID, without querying', async () => {
      const response = await server().get('/api/dives/abc').expect(400);

      expect(response.body).toMatchObject({ statusCode: 400 });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(query).not.toHaveBeenCalled();
    });

    it('returns 401 when no diver can be resolved (no session cookie)', async () => {
      cookie = undefined;

      await server().get(`/api/dives/${EVENT_ID}`).expect(401);
      expect(query).not.toHaveBeenCalled();
    });
  });
});
