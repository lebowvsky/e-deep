import type { DiveDetail, DiveLogResponse } from '@e-deep/shared';
import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { CurrentDiverGuard, CurrentDiverId } from '../../common/auth/current-diver.guard';
import { DiveLogService } from './dive-log.service';

/** Dive log of the current diver. The owner always comes from the guard, never from the request. */
@Controller('dives')
@UseGuards(CurrentDiverGuard)
export class DivesController {
  constructor(private readonly diveLogService: DiveLogService) {}

  /** `GET /api/dives`: every live dive of the current diver, latest first. */
  @Get()
  findAll(@CurrentDiverId() diverId: string): Promise<DiveLogResponse> {
    return this.diveLogService.findAll(diverId);
  }

  /** `GET /api/dives/:id`: one live dive of the current diver, by event id (404 otherwise). */
  @Get(':id')
  findOne(
    @CurrentDiverId() diverId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DiveDetail> {
    return this.diveLogService.findOne(diverId, id);
  }
}
