import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Marks the response `Cache-Control: no-store` and lets the request through. A guard rather than
 * an interceptor or `@Header`: guards run before the other guards of the route, the pipes and the
 * handler, so the header is also on their errors (401, 400, 429…).
 *
 * Used by the public authentication routes, whose answers carry a `Set-Cookie` or an identity: the
 * global `SessionGuard` sets it on every non-public route, never on a `@Public()` one.
 */
@Injectable()
export class NoStoreGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'no-store');
    return true;
  }
}
