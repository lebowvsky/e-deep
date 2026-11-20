import type {
  ApiDomainErrorResponse,
  ApiValidationErrorResponse,
  SiteListResponse,
  SiteResponse,
} from '@e-deep/shared';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { CurrentDiverGuard } from '../src/common/auth/current-diver.guard';
import {
  IdentifierConflictError,
  InvalidReferenceError,
  MergeIntoSelfError,
  SiteInUseError,
} from '../src/common/errors/domain-errors';
import { configureApp } from '../src/configure-app';
import { DiveSitesController } from '../src/modules/dive-sites/dive-sites.controller';
import { DiveSitesService, siteNotFound } from '../src/modules/dive-sites/dive-sites.service';
import { siteCreateRequest } from './support/site-request';

const DIVER_ID = '01900000-0000-7000-8000-000000000001';
const SITE_ID = '01900000-0000-7000-8000-0000000000a1';
const TARGET_ID = '01900000-0000-7000-8000-0000000000a2';

const SITE: SiteResponse = {
  id: SITE_ID,
  name: 'Pointe de la Revellata',
  locality: 'Calvi',
  region: 'Corse',
  area: 'Méditerranée',
  latitude: 42.583,
  longitude: 8.725,
  type: 'tombant',
  depthMinM: 15,
  depthMaxM: 60,
  accessNotes: 'Mouillage au pied du phare.',
  createdVia: 'full',
  createdAt: '2026-04-01T08:00:00.000Z',
  updatedAt: '2026-04-02T09:30:00.000Z',
};

/** The service has its own database tests: here, the HTTP contract only. */
const sites = {
  list: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  replace: jest.fn(),
  merge: jest.fn(),
  remove: jest.fn(),
};
/** `CurrentDiverGuard` lookup of the first diver. */
const find = jest.fn<Promise<{ id: string }[]>, []>();
let devAuthStub = true;

const NOT_FOUND = { message: 'Site not found', error: 'Not Found', statusCode: 404 };

describe('/api/sites (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DiveSitesController],
      providers: [
        CurrentDiverGuard,
        { provide: DiveSitesService, useValue: sites },
        { provide: DataSource, useValue: { manager: { find } } },
        { provide: ConfigService, useValue: { get: () => devAuthStub } },
      ],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, { corsOrigins: ['http://localhost:5173'], trustProxy: 0 });
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

  const server = () => request(app.getHttpServer());
  const { createdVia: _origin, ...replacement } = siteCreateRequest({ id: SITE_ID });
  const creation = siteCreateRequest({ id: SITE_ID });

  describe('GET /api/sites', () => {
    it('lists the sites of the current diver', async () => {
      sites.list.mockResolvedValue({ sites: [SITE] } satisfies SiteListResponse);

      const response = await server().get('/api/sites').expect(200);

      expect(response.body).toStrictEqual({ sites: [SITE] });
      expect(response.headers['cache-control']).toBe('no-store');
      // The owner comes from the guard, never from the request.
      expect(sites.list).toHaveBeenCalledWith(DIVER_ID);
    });

    it('answers 401 without a current diver (stub disabled)', async () => {
      devAuthStub = false;

      const response = await server().get('/api/sites').expect(401);

      expect(response.headers['cache-control']).toBe('no-store');
      expect(sites.list).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/sites/:id', () => {
    it('returns a site of the current diver', async () => {
      sites.findOne.mockResolvedValue(SITE);

      const response = await server().get(`/api/sites/${SITE_ID}`).expect(200);

      expect(response.body).toStrictEqual(SITE);
      expect(sites.findOne).toHaveBeenCalledWith(DIVER_ID, SITE_ID);
    });

    it('answers a generic 404, without the id', async () => {
      sites.findOne.mockRejectedValue(siteNotFound());

      const response = await server().get(`/api/sites/${SITE_ID}`).expect(404);

      expect(response.body).toStrictEqual(NOT_FOUND);
      expect(response.text).not.toContain(SITE_ID);
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('answers 400 for an id that is not a UUID, without querying', async () => {
      await server().get('/api/sites/abc').expect(400);
      expect(sites.findOne).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/sites', () => {
    it('creates the site for the current diver (201)', async () => {
      sites.create.mockResolvedValue({ outcome: 'created', site: SITE });

      const response = await server().post('/api/sites').send(creation).expect(201);

      expect(response.body).toStrictEqual(SITE);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(sites.create).toHaveBeenCalledWith(DIVER_ID, creation);
    });

    it('answers a replayed creation with 200 and the same body', async () => {
      sites.create.mockResolvedValue({ outcome: 'replayed', site: SITE });

      const response = await server().post('/api/sites').send(creation).expect(200);

      expect(response.body).toStrictEqual(SITE);
    });

    it('answers 400 with errors per field, never the values', async () => {
      const secret = 'Passage sous la falaise';
      const { region: _region, ...withoutRegion } = siteCreateRequest({
        accessNotes: `${secret}${'x'.repeat(2000)}`,
        longitude: null,
        depthMinM: 40,
        depthMaxM: 30,
      });
      const body = { ...withoutRegion, type: 'recif', createdVia: 'map' };

      const response = await server().post('/api/sites').send(body).expect(400);

      expect(response.body).toStrictEqual({
        statusCode: 400,
        code: 'validation-failed',
        fieldErrors: {
          region: ['required'],
          latitude: ['pair'],
          type: ['in'],
          depthMinM: ['depth-range'],
          accessNotes: ['length'],
          createdVia: ['in'],
        },
      } satisfies ApiValidationErrorResponse);
      expect(response.text).not.toContain(secret);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(sites.create).not.toHaveBeenCalled();
    });

    it('answers 409 identifier-conflict for an id already taken', async () => {
      sites.create.mockRejectedValue(new IdentifierConflictError());

      const response = await server().post('/api/sites').send(creation).expect(409);

      expect(response.body).toStrictEqual({
        statusCode: 409,
        code: 'identifier-conflict',
      } satisfies ApiDomainErrorResponse);
    });

    it('answers 401 without a current diver (stub disabled)', async () => {
      devAuthStub = false;

      await server().post('/api/sites').send(creation).expect(401);
      expect(sites.create).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/sites/:id', () => {
    it('replaces the site of the current diver (200)', async () => {
      sites.replace.mockResolvedValue(SITE);

      const response = await server().put(`/api/sites/${SITE_ID}`).send(replacement).expect(200);

      expect(response.body).toStrictEqual(SITE);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(sites.replace).toHaveBeenCalledWith(DIVER_ID, replacement);
    });

    it('accepts the route id in another case', async () => {
      sites.replace.mockResolvedValue(SITE);

      await server().put(`/api/sites/${SITE_ID.toUpperCase()}`).send(replacement).expect(200);
    });

    it('answers 400 when the id of the route is not the id of the body', async () => {
      const response = await server().put(`/api/sites/${TARGET_ID}`).send(replacement).expect(400);

      expect(response.body).toStrictEqual({
        statusCode: 400,
        code: 'validation-failed',
        fieldErrors: { id: ['matches-route'] },
      } satisfies ApiValidationErrorResponse);
      expect(sites.replace).not.toHaveBeenCalled();
    });

    it('answers 400 validation-failed for an id that is not a UUID', async () => {
      const response = await server().put('/api/sites/abc').send(replacement).expect(400);

      expect(response.body).toStrictEqual({
        statusCode: 400,
        code: 'validation-failed',
        fieldErrors: { id: ['uuid'] },
      });
    });

    it('refuses an origin: it cannot change (RG-34)', async () => {
      const response = await server().put(`/api/sites/${SITE_ID}`).send(creation).expect(400);

      expect(response.body).toMatchObject({ fieldErrors: { createdVia: ['unknown'] } });
    });

    it('answers the generic 404 for a site that is not a live one of the diver', async () => {
      sites.replace.mockRejectedValue(siteNotFound());

      const response = await server().put(`/api/sites/${SITE_ID}`).send(replacement).expect(404);

      expect(response.body).toStrictEqual(NOT_FOUND);
    });
  });

  describe('POST /api/sites/:id/merge', () => {
    it('merges the site and answers the target (200)', async () => {
      const target = { ...SITE, id: TARGET_ID };
      sites.merge.mockResolvedValue(target);

      const response = await server()
        .post(`/api/sites/${SITE_ID}/merge`)
        .send({ targetId: TARGET_ID })
        .expect(200);

      expect(response.body).toStrictEqual(target);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(sites.merge).toHaveBeenCalledWith(DIVER_ID, SITE_ID, TARGET_ID);
    });

    it('answers 400 for a missing or invalid target', async () => {
      const response = await server().post(`/api/sites/${SITE_ID}/merge`).send({}).expect(400);

      expect(response.body).toMatchObject({ fieldErrors: { targetId: ['required'] } });
      expect(sites.merge).not.toHaveBeenCalled();
    });

    it.each<[string, Error, number, unknown]>([
      ['a source that is not a live site of the diver', siteNotFound(), 404, NOT_FOUND],
      [
        'the source itself as target',
        new MergeIntoSelfError(),
        422,
        { statusCode: 422, code: 'merge-into-self' },
      ],
      [
        'a target that is not a live site of the diver',
        new InvalidReferenceError(),
        422,
        { statusCode: 422, code: 'invalid-reference' },
      ],
    ])('answers %s with %i', async (_case, error, status, body) => {
      sites.merge.mockRejectedValue(error);

      const response = await server()
        .post(`/api/sites/${SITE_ID}/merge`)
        .send({ targetId: TARGET_ID })
        .expect(status);

      expect(response.body).toStrictEqual(body);
    });
  });

  describe('DELETE /api/sites/:id', () => {
    it('deletes the site (204)', async () => {
      sites.remove.mockResolvedValue(true);

      const response = await server().delete(`/api/sites/${SITE_ID}`).expect(204);

      expect(response.text).toBe('');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(sites.remove).toHaveBeenCalledWith(DIVER_ID, SITE_ID);
    });

    it('answers the generic 404 when no live site of the diver was deleted', async () => {
      sites.remove.mockResolvedValue(false);

      const response = await server().delete(`/api/sites/${SITE_ID}`).expect(404);

      expect(response.body).toStrictEqual(NOT_FOUND);
    });

    it('answers 409 site-in-use while a live dive uses the site (RG-37)', async () => {
      sites.remove.mockRejectedValue(new SiteInUseError());

      const response = await server().delete(`/api/sites/${SITE_ID}`).expect(409);

      expect(response.body).toStrictEqual({ statusCode: 409, code: 'site-in-use' });
    });

    it('answers 401 without a current diver (stub disabled)', async () => {
      devAuthStub = false;

      await server().delete(`/api/sites/${SITE_ID}`).expect(401);
      expect(sites.remove).not.toHaveBeenCalled();
    });
  });
});
