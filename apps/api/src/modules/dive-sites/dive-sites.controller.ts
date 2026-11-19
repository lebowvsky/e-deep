import type { SiteListResponse, SiteResponse } from '@e-deep/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { isSameUuid } from '../../common/ids/uuid';
import { validationFailed } from '../../common/validation/field-errors';
import { routeIdPipe } from '../../common/validation/route-id-pipe';
import { DiveSitesService, siteNotFound } from './dive-sites.service';
import {
  SiteCreateRequestDto,
  SiteMergeRequestDto,
  SiteWriteRequestDto,
} from './dto/site-write-request.dto';

/**
 * Dive sites of the current diver (D-33). The owner always comes from the guard, never from the
 * request; a site that is not a live one of the diver answers the same 404.
 */
@Controller('sites')
@UseGuards(CurrentDiverGuard)
export class DiveSitesController {
  constructor(private readonly sites: DiveSitesService) {}

  /** `GET /api/sites`: every live site of the current diver, by name. */
  @Get()
  findAll(@CurrentDiverId() diverId: string): Promise<SiteListResponse> {
    return this.sites.list(diverId);
  }

  /** `GET /api/sites/:id`. */
  @Get(':id')
  findOne(
    @CurrentDiverId() diverId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SiteResponse> {
    return this.sites.findOne(diverId, id);
  }

  /** `POST /api/sites`: 201, or 200 when the same creation is received again. */
  @Post()
  async create(
    @CurrentDiverId() diverId: string,
    @Body() request: SiteCreateRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SiteResponse> {
    const { outcome, site } = await this.sites.create(diverId, request);
    response.status(outcome === 'created' ? HttpStatus.CREATED : HttpStatus.OK);
    return site;
  }

  /** `PUT /api/sites/:id`: replaces a live site as a whole. */
  @Put(':id')
  replace(
    @CurrentDiverId() diverId: string,
    @Param('id', routeIdPipe()) id: string,
    @Body() request: SiteWriteRequestDto,
  ): Promise<SiteResponse> {
    if (!isSameUuid(request.id, id)) {
      throw validationFailed({ id: ['matches-route'] });
    }
    return this.sites.replace(diverId, request);
  }

  /** `POST /api/sites/:id/merge`: merges the site into `targetId`, answers the target. */
  @Post(':id/merge')
  @HttpCode(HttpStatus.OK)
  merge(
    @CurrentDiverId() diverId: string,
    @Param('id', routeIdPipe()) id: string,
    @Body() request: SiteMergeRequestDto,
  ): Promise<SiteResponse> {
    return this.sites.merge(diverId, id, request.targetId);
  }

  /** `DELETE /api/sites/:id`: 204; 409 `site-in-use` while a live dive uses it. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentDiverId() diverId: string,
    @Param('id', routeIdPipe()) id: string,
  ): Promise<void> {
    if (!(await this.sites.remove(diverId, id))) {
      throw siteNotFound();
    }
  }
}
