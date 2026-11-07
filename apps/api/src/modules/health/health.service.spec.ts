import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { DATABASE_PING_TIMEOUT_MS, HealthService } from './health.service';

// Typed as `unknown`: Jest asymmetric matchers are untyped.
const ISO_TIMESTAMP: unknown = expect.stringMatching(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
);

describe('HealthService', () => {
  const query = jest.fn<Promise<unknown>, [string]>();
  let service: HealthService;

  beforeEach(async () => {
    query.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: DataSource, useValue: { query } }],
    }).compile();
    service = moduleRef.get(HealthService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reports ok when the database answers', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);

    const health = await service.check();

    expect(query).toHaveBeenCalledWith('SELECT 1');
    expect(health).toEqual({ status: 'ok', database: 'up', timestamp: ISO_TIMESTAMP });
  });

  it('reports degraded without throwing when the database fails', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    query.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:5432'));

    const health = await service.check();

    expect(health).toMatchObject({ status: 'degraded', database: 'down' });
    // Only the error class is logged, never the driver message (connection details).
    expect(warn).toHaveBeenCalledWith('Database health check failed (Error)');
  });

  it('reports degraded when the database does not answer in time', async () => {
    jest.useFakeTimers();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    query.mockReturnValue(new Promise<never>(() => undefined));

    const pending = service.check();
    await jest.advanceTimersByTimeAsync(DATABASE_PING_TIMEOUT_MS);
    const health = await pending;
    jest.useRealTimers();

    expect(health).toMatchObject({ status: 'degraded', database: 'down' });
    expect(warn).toHaveBeenCalledWith('Database health check failed (DatabasePingTimeoutError)');
  });
});
