import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { AppConfigService } from '../../config/app-config.service';
import { ForbiddenError } from '../errors/domain-errors';

/** Methods that change nothing (RFC 9110 §9.2.1): never a cross-site request forgery. */
export const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global guard (`APP_GUARD`), before the `SessionGuard`: refuses a state-changing request that
 * the browser did not send from one of our own pages (CSRF, D34). Every unsafe method, public
 * routes included (sign-in, sign-up, sign-out), must carry `Sec-Fetch-Site: same-origin` (set by
 * the browser, unforgeable by a page). Only when the header is absent (older browsers) does an
 * `Origin` listed in `ALLOWED_ORIGINS` stand in for it. Otherwise: `403 forbidden`. Safe methods
 * are not checked.
 *
 * With the cookies in `SameSite=Strict` and JSON bodies, this replaces a CSRF token. The CORS is
 * gone: same origin only (D34). Logs nothing.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(@Inject(ConfigService) config: AppConfigService) {
    this.allowedOrigins = new Set(config.get('ALLOWED_ORIGINS', { infer: true }));
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return false;
    }
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method) || this.isFromOwnPage(request)) {
      return true;
    }
    throw new ForbiddenError();
  }

  private isFromOwnPage(request: Request): boolean {
    const fetchSite = request.headers['sec-fetch-site'];
    // A browser that sends it tells the truth: only `same-origin` passes, whatever the `Origin`.
    if (fetchSite !== undefined) {
      return fetchSite === 'same-origin';
    }
    const { origin } = request.headers;
    return origin !== undefined && this.allowedOrigins.has(origin);
  }
}
