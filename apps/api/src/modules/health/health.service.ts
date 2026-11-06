import type { HealthResponse } from '@e-deep/shared';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { errorClassName } from '../../common/logging/error-class-name';

/** Upper bound for the health ping: a hung database must be reported as `down`, not hang the endpoint. */
export const DATABASE_PING_TIMEOUT_MS = 3_000;

class DatabasePingTimeoutError extends Error {
  override readonly name = 'DatabasePingTimeoutError';
}

function rejectAfter(ms: number, onTimer: (timer: NodeJS.Timeout) => void): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    onTimer(setTimeout(() => reject(new DatabasePingTimeoutError()), ms));
  });
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly dataSource: DataSource) {}

  /** Never throws: a database failure is reported as `degraded`, not as an HTTP error. */
  async check(): Promise<HealthResponse> {
    const isDatabaseUp = await this.pingDatabase();
    return {
      status: isDatabaseUp ? 'ok' : 'degraded',
      database: isDatabaseUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
  }

  private async pingDatabase(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.dataSource.query('SELECT 1'),
        rejectAfter(DATABASE_PING_TIMEOUT_MS, (started) => (timer = started)),
      ]);
      return true;
    } catch (error) {
      // GDPR: the driver message may contain connection details: log the error class only.
      this.logger.warn(`Database health check failed (${errorClassName(error)})`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
