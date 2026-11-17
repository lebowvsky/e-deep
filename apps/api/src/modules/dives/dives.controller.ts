import type { DiveDetail, DiveLogResponse, DiveWriteResponse } from '@e-deep/shared';
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentDiverGuard, CurrentDiverId } from '../../common/auth/current-diver.guard';
import { validationFailed } from '../../common/validation/field-errors';
import { DiveLogService } from './dive-log.service';
import { DiveWriteService } from './dive-write.service';
import { DiveWriteRequestDto } from './dto/dive-write-request.dto';
import { requestConsistencyErrors } from './dto/validators/request-consistency';

/** Dive log of the current diver. The owner always comes from the guard, never from the request. */
@Controller('dives')
@UseGuards(CurrentDiverGuard)
export class DivesController {
  constructor(
    private readonly diveLogService: DiveLogService,
    private readonly diveWriteService: DiveWriteService,
  ) {}

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

  /**
   * `POST /api/dives`: creates a dive with its new site and buddies (201). The same creation
   * received again answers 200 with the same body (D-24).
   */
  @Post()
  async create(
    @CurrentDiverId() diverId: string,
    @Body() request: DiveWriteRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DiveWriteResponse> {
    assertConsistent(request);
    const { outcome, saved } = await this.diveWriteService.create(diverId, request);
    response.status(outcome === 'created' ? HttpStatus.CREATED : HttpStatus.OK);
    return saved;
  }

  /** `PUT /api/dives/:id`: replaces a live dive of the current diver as a whole (404 otherwise). */
  @Put(':id')
  replace(
    @CurrentDiverId() diverId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() request: DiveWriteRequestDto,
  ): Promise<DiveWriteResponse> {
    assertConsistent(request, id);
    return this.diveWriteService.replace(diverId, id, request);
  }
}

function assertConsistent(request: DiveWriteRequestDto, routeId?: string): void {
  const fieldErrors = requestConsistencyErrors(request, routeId);
  if (Object.keys(fieldErrors).length > 0) {
    throw validationFailed(fieldErrors);
  }
}
