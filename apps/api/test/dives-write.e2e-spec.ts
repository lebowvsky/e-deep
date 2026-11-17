import type {
  ApiDomainErrorResponse,
  ApiValidationErrorResponse,
  DiveWriteResponse,
} from '@e-deep/shared';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { CurrentDiverGuard } from '../src/common/auth/current-diver.guard';
import { IdentifierConflictError, InvalidReferenceError } from '../src/common/errors/domain-errors';
import { configureApp } from '../src/configure-app';
import { DiveLogService, diveNotFound } from '../src/modules/dives/dive-log.service';
import { DiveWriteService } from '../src/modules/dives/dive-write.service';
import { DivesController } from '../src/modules/dives/dives.controller';
import { diveWriteRequest } from './support/dive-write-request';

const DIVER_ID = '01900000-0000-7000-8000-000000000001';
const SITE_ID = '01900000-0000-7000-8000-0000000000a1';
const OTHER_ID = '01900000-0000-7000-8000-0000000000ff';
const SAVED: DiveWriteResponse = {
  id: '01900000-0000-7000-8000-0000000000aa',
  number: 128,
  updatedAt: '2026-11-18T09:00:00.000Z',
};

/** The orchestration has its own unit and database tests: here, the HTTP contract only. */
const diveWriteService = { create: jest.fn(), replace: jest.fn() };
/** `CurrentDiverGuard` lookup of the first diver. */
const find = jest.fn<Promise<{ id: string }[]>, []>();
let devAuthStub = true;

describe('/api/dives writes (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DivesController],
      providers: [
        CurrentDiverGuard,
        { provide: DiveWriteService, useValue: diveWriteService },
        { provide: DiveLogService, useValue: {} },
        { provide: DataSource, useValue: { manager: { find } } },
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
    jest.resetAllMocks();
    find.mockResolvedValue([{ id: DIVER_ID }]);
  });

  const body = diveWriteRequest({ event: { id: SAVED.id, siteId: SITE_ID } });

  describe('POST /api/dives', () => {
    it('creates the dive for the current diver (201)', async () => {
      diveWriteService.create.mockResolvedValue({ outcome: 'created', saved: SAVED });

      const response = await request(app.getHttpServer()).post('/api/dives').send(body).expect(201);

      expect(response.body).toStrictEqual(SAVED);
      expect(response.headers['cache-control']).toBe('no-store');
      // The owner comes from the guard, never from the request.
      expect(diveWriteService.create).toHaveBeenCalledWith(DIVER_ID, body);
    });

    it('answers a replayed creation with 200 and the same body', async () => {
      diveWriteService.create.mockResolvedValue({ outcome: 'replayed', saved: SAVED });

      const response = await request(app.getHttpServer()).post('/api/dives').send(body).expect(200);

      expect(response.body).toStrictEqual(SAVED);
    });

    it('answers 400 with field errors, never the values', async () => {
      const secret = 'Calvi Plongée';
      const invalid = diveWriteRequest({
        event: { diveCenter: `${secret}${'x'.repeat(120)}` },
        participation: { safetyStopDurationMin: 3 },
      });
      const { participation } = invalid;
      const { maxDepthM: _absent, ...withoutDepth } = participation;

      const response = await request(app.getHttpServer())
        .post('/api/dives')
        .send({ ...invalid, participation: withoutDepth })
        .expect(400);

      expect(response.body).toStrictEqual({
        statusCode: 400,
        code: 'validation-failed',
        fieldErrors: {
          'event.diveCenter': ['length'],
          'participation.maxDepthM': ['required'],
          'participation.safetyStopDurationMin': ['pair'],
        },
      } satisfies ApiValidationErrorResponse);
      expect(response.text).not.toContain(secret);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(diveWriteService.create).not.toHaveBeenCalled();
    });

    it('answers 400 when the event site is not the site of the request', async () => {
      const mismatch = { ...body, site: { ...body.site, id: OTHER_ID } };

      const response = await request(app.getHttpServer())
        .post('/api/dives')
        .send(mismatch)
        .expect(400);

      expect(response.body).toStrictEqual({
        statusCode: 400,
        code: 'validation-failed',
        fieldErrors: { 'event.siteId': ['matches-site'] },
      });
      expect(diveWriteService.create).not.toHaveBeenCalled();
    });

    it('answers 409 identifier-conflict for an id already taken', async () => {
      diveWriteService.create.mockRejectedValue(new IdentifierConflictError());

      const response = await request(app.getHttpServer()).post('/api/dives').send(body).expect(409);

      expect(response.body).toStrictEqual({
        statusCode: 409,
        code: 'identifier-conflict',
      } satisfies ApiDomainErrorResponse);
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('answers 401 without a current diver (stub disabled)', async () => {
      devAuthStub = false;

      await request(app.getHttpServer()).post('/api/dives').send(body).expect(401);
      expect(diveWriteService.create).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/dives/:id', () => {
    it('replaces the dive of the current diver (200)', async () => {
      diveWriteService.replace.mockResolvedValue(SAVED);

      const response = await request(app.getHttpServer())
        .put(`/api/dives/${SAVED.id}`)
        .send(body)
        .expect(200);

      expect(response.body).toStrictEqual(SAVED);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(diveWriteService.replace).toHaveBeenCalledWith(DIVER_ID, SAVED.id, body);
    });

    it('answers 400 when the id of the route is not the id of the event', async () => {
      const response = await request(app.getHttpServer())
        .put(`/api/dives/${OTHER_ID}`)
        .send(body)
        .expect(400);

      expect(response.body).toStrictEqual({
        statusCode: 400,
        code: 'validation-failed',
        fieldErrors: { 'event.id': ['matches-route'] },
      });
      expect(diveWriteService.replace).not.toHaveBeenCalled();
    });

    it('answers 400 for an id that is not a UUID', async () => {
      await request(app.getHttpServer()).put('/api/dives/abc').send(body).expect(400);
      expect(diveWriteService.replace).not.toHaveBeenCalled();
    });

    it('answers the generic 404 of the detail for a dive that is not a live one of the diver', async () => {
      diveWriteService.replace.mockRejectedValue(diveNotFound());

      const response = await request(app.getHttpServer())
        .put(`/api/dives/${SAVED.id}`)
        .send(body)
        .expect(404);

      expect(response.body).toStrictEqual({
        message: 'Dive not found',
        error: 'Not Found',
        statusCode: 404,
      });
      expect(response.text).not.toContain(SAVED.id);
    });

    it('answers 422 invalid-reference for a site or buddy that is not the diver’s', async () => {
      diveWriteService.replace.mockRejectedValue(new InvalidReferenceError());

      const response = await request(app.getHttpServer())
        .put(`/api/dives/${SAVED.id}`)
        .send(body)
        .expect(422);

      expect(response.body).toStrictEqual({ statusCode: 422, code: 'invalid-reference' });
    });

    it('answers 401 without a current diver (stub disabled)', async () => {
      devAuthStub = false;

      const response = await request(app.getHttpServer())
        .put(`/api/dives/${SAVED.id}`)
        .send(body)
        .expect(401);

      expect(response.headers['cache-control']).toBe('no-store');
      expect(diveWriteService.replace).not.toHaveBeenCalled();
    });
  });
});
