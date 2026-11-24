import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/** Read model of the diver's dashboard; relies on the global `DataSource`. */
@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
