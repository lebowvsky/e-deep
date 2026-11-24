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
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentDiverId } from '../../common/auth/current-diver-id.decorator';
import type { DiverId } from '../../common/auth/diver-id';
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
 * Dive sites of the current diver (D-33): web session, complete profile (global `SessionGuard`).
 * The owner always comes from `@CurrentDiverId()`, never from the request; a site that is not a
 * live one of the diver answers the same 404.
 */
@Controller('sites')
export class DiveSitesController {
  constructor(private readonly sites: DiveSitesService) {}

  /** `GET /api/sites`: every live site of the current diver, by name. */
  @Get()
  findAll(@CurrentDiverId() diverId: DiverId): Promise<SiteListResponse> {
    return this.sites.list(diverId);
  }

  /** `GET /api/sites/:id`. */
  @Get(':id')
  findOne(
    @CurrentDiverId() diverId: DiverId,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SiteResponse> {
    return this.sites.findOne(diverId, id);
  }

  /** `POST /api/sites`: 201, or 200 when the same creation is received again. */
  @Post()
  async create(
    @CurrentDiverId() diverId: DiverId,
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
    @CurrentDiverId() diverId: DiverId,
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
    @CurrentDiverId() diverId: DiverId,
    @Param('id', routeIdPipe()) id: string,
    @Body() request: SiteMergeRequestDto,
  ): Promise<SiteResponse> {
    return this.sites.merge(diverId, id, request.targetId);
  }

  /** `DELETE /api/sites/:id`: 204; 409 `site-in-use` while a live dive uses it. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentDiverId() diverId: DiverId,
    @Param('id', routeIdPipe()) id: string,
  ): Promise<void> {
    if (!(await this.sites.remove(diverId, id))) {
      throw siteNotFound();
    }
  }
}
