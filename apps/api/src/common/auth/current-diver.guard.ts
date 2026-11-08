import {
  createParamDecorator,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import type { AppConfigService } from '../../config/app-config.service';
import { Diver } from '../../modules/divers/diver.entity';

interface RequestWithDiver extends Request {
  currentDiverId?: string;
}

/**
 * Resolves the diver the request acts for. Single entry point of the future authentication: the
 * session will provide the diver here, and nothing else will change.
 *
 * Until then, a DEVELOPMENT stub (`DEV_AUTH_STUB=true`) picks the first diver created (the seed's
 * Marine Rousseau). Without the stub, every request is refused with a 401.
 */
@Injectable()
export class CurrentDiverGuard implements CanActivate {
  constructor(
    @Inject(ConfigService) private readonly config: AppConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.config.get('DEV_AUTH_STUB', { infer: true })) {
      throw new UnauthorizedException();
    }
    const [diver] = await this.dataSource.manager.find(Diver, {
      select: { id: true },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: 1,
    });
    if (diver === undefined) {
      throw new UnauthorizedException();
    }
    context.switchToHttp().getRequest<RequestWithDiver>().currentDiverId = diver.id;
    return true;
  }
}

/** Id of the diver resolved by `CurrentDiverGuard` (the guard must run on the route). */
export const CurrentDiverId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const diverId = context.switchToHttp().getRequest<RequestWithDiver>().currentDiverId;
    if (diverId === undefined) {
      throw new Error('CurrentDiverGuard did not run on this route');
    }
    return diverId;
  },
);
