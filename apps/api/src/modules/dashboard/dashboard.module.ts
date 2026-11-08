import { Module } from '@nestjs/common';
import { CurrentDiverGuard } from '../../common/auth/current-diver.guard';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/** Read model of the diver's dashboard; relies on the global `DataSource` and `ConfigService`. */
@Module({
  controllers: [DashboardController],
  providers: [DashboardService, CurrentDiverGuard],
})
export class DashboardModule {}
