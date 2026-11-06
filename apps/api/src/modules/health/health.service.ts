import type { HealthResponse } from '@e-deep/shared';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { errorClassName } from '../../common/logging/error-class-name';

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
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      // GDPR: the driver message may contain connection details: log the error class only.
      this.logger.warn(`Database health check failed (${errorClassName(error)})`);
      return false;
    }
  }
}
