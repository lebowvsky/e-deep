import type { DashboardResponse } from '@e-deep/shared';
import { Controller, Get } from '@nestjs/common';
import { CurrentDiverId } from '../../common/auth/current-diver-id.decorator';
import type { DiverId } from '../../common/auth/diver-id';
import { DashboardService } from './dashboard.service';

/** Dashboard of the current diver: web session, complete profile (global `SessionGuard`). */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** `GET /api/dashboard`: dashboard of the current diver. */
  @Get()
  get(@CurrentDiverId() diverId: DiverId): Promise<DashboardResponse> {
    return this.dashboardService.getDashboard(diverId);
  }
}
