import type { CertificationLevelListResponse } from '@e-deep/shared';
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { toCertificationLevelOption } from './certification-level-contract.mapper';
import { CertificationLevelsService } from './certification-levels.service';

/**
 * Reference data, public (§3): no personal data, so no `no-store`. The
 * `/welcome` form lists these levels.
 */
@Controller('certification-levels')
@Public()
export class CertificationLevelsController {
  constructor(private readonly levels: CertificationLevelsService) {}

  /** `GET /api/certification-levels`: the active levels only. */
  @Get()
  async findActive(): Promise<CertificationLevelListResponse> {
    const levels = await this.levels.findActive();
    return { levels: levels.map(toCertificationLevelOption) };
  }
}
