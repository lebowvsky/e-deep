import type { HealthResponse } from '@e-deep/shared';
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { HealthService } from './health.service';

/** Liveness of the API and its database: public, no personal data. */
@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
