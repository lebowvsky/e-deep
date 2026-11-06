import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/** Relies on the global `DataSource` provided by `DatabaseModule`. */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
