import type { DashboardResponse } from '@e-deep/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentDiverGuard, CurrentDiverId } from '../../common/auth/current-diver.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(CurrentDiverGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** `GET /api/dashboard`: dashboard of the current diver. */
  @Get()
  get(@CurrentDiverId() diverId: string): Promise<DashboardResponse> {
    return this.dashboardService.getDashboard(diverId);
  }
}
