import { PATH_METADATA } from '@nestjs/common/constants';
import type { Reflector } from '@nestjs/core';
import type { SessionAudience } from '../../modules/auth/session-audiences';

/** First path segment of every back-office route (`/api/admin/*`, D37). */
const ADMIN_SEGMENT = 'admin';

/** A controller class or a handler method: what `Reflector.get` reads the metadata of. */
export type RouteTarget = Parameters<Reflector['get']>[1];

/**
 * Path of a route relative to the global prefix, from the Nest metadata of its controller and
 * handler (`'admin/me'`, `'dives/:id'`). Read from the code, never from the request URL, so a
 * crafted URL cannot change the audience.
 *
 * @throws {Error} for a controller or handler declaring several paths: they could mix audiences,
 *   so the guard refuses to guess (a generic 500, fail closed).
 */
export function routePath(
  reflector: Reflector,
  controller: RouteTarget,
  handler: RouteTarget,
): string {
  return [controller, handler]
    .map((target) => reflector.get<unknown>(PATH_METADATA, target))
    .map(singlePath)
    .flatMap((part) => part.split('/'))
    .filter((segment) => segment !== '')
    .join('/');
}

/**
 * `/api/admin/*` is the admin audience (admin cookie only), anything else the web one. Compared
 * case-insensitively, as Express routes: `@Controller('Admin/x')` serves `/api/admin/x`.
 */
export function audienceOfPath(path: string): SessionAudience {
  return path.split('/')[0]?.toLowerCase() === ADMIN_SEGMENT ? 'admin' : 'web';
}

function singlePath(metadata: unknown): string {
  if (metadata === undefined) {
    return '';
  }
  if (typeof metadata === 'string') {
    return metadata;
  }
  if (Array.isArray(metadata) && metadata.length === 1) {
    const only: unknown = metadata[0];
    if (typeof only === 'string') {
      return only;
    }
  }
  throw new Error('Unsupported route path metadata: one string path per controller and handler');
}
