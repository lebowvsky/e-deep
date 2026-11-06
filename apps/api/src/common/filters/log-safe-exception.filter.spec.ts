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
});
