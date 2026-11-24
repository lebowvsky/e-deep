import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  DomainValidationError,
  InvalidReferenceError,
  UnsupportedContractValueError,
} from '../errors/domain-errors';
import { LogSafeExceptionFilter } from './log-safe-exception.filter';

const SENSITIVE_DETAIL = 'patient diagnosis';

class FakeQueryFailedError extends Error {}

@Controller()
class ThrowingController {
  @Get('unexpected')
  unexpected(): never {
    throw new FakeQueryFailedError(`INSERT ... VALUES ('${SENSITIVE_DETAIL}')`);
  }

  @Get('bad-request')
  badRequest(): never {
    throw new BadRequestException('Invalid input');
  }

  @Get('invalid-reference')
  invalidReference(): never {
    throw new InvalidReferenceError();
  }

  @Get('weak-password')
  weakPassword(): never {
    throw new DomainValidationError({ password: ['compromised'] });
  }

  @Get('unsupported-value')
  unsupportedValue(): never {
    throw new UnsupportedContractValueError();
  }
}

describe('LogSafeExceptionFilter', () => {
  let app: INestApplication<App>;
  let logError: jest.SpyInstance;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ThrowingController],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalFilters(new LogSafeExceptionFilter(app.getHttpAdapter()));
    await app.init();
  });

  beforeEach(() => {
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs only the class name of an unexpected error and replies a generic 500', async () => {
    const response = await request(app.getHttpServer()).get('/unexpected').expect(500);

    expect(response.text).not.toContain(SENSITIVE_DETAIL);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith('Unhandled FakeQueryFailedError');
  });

  it('replies HttpExceptions unchanged without logging them', async () => {
    const response = await request(app.getHttpServer()).get('/bad-request').expect(400);

    expect(response.text).toContain('Invalid input');
    expect(logError).not.toHaveBeenCalled();
  });

  it('replies a business error with its status and code, without logging a 4xx', async () => {
    const response = await request(app.getHttpServer()).get('/invalid-reference').expect(422);

    expect(response.body).toStrictEqual({ statusCode: 422, code: 'invalid-reference' });
    expect(logError).not.toHaveBeenCalled();
  });

  it('replies a business validation error like a DTO one, without logging it', async () => {
    const response = await request(app.getHttpServer()).get('/weak-password').expect(400);

    expect(response.body).toStrictEqual({
      statusCode: 400,
      code: 'validation-failed',
      fieldErrors: { password: ['compromised'] },
    });
    expect(logError).not.toHaveBeenCalled();
  });

  it('logs only the class name of a 5xx business error', async () => {
    const response = await request(app.getHttpServer()).get('/unsupported-value').expect(500);

    expect(response.body).toStrictEqual({ statusCode: 500, code: 'unsupported-contract-value' });
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith('Unhandled UnsupportedContractValueError');
  });
});
