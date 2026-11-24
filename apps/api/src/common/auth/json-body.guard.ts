import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { UnsupportedMediaTypeError } from '../errors/domain-errors';
import { SAFE_METHODS } from './origin.guard';

const JSON_MEDIA_TYPE = 'application/json';

/**
 * Global guard (`APP_GUARD`), after the `OriginGuard`: a state-changing request that carries a
 * body must send it as JSON (D34). A browser can only send `application/json` cross-site after a
 * CORS preflight, which this API never grants, while a plain HTML form can post
 * `application/x-www-form-urlencoded`, `multipart/form-data` or `text/plain` without one: refusing
 * them closes that CSRF path, together with `SameSite=Strict` and the `OriginGuard`.
 *
 * A request carries a body when it has a non-zero `Content-Length` or a `Transfer-Encoding`; one
 * without (`POST /auth/logout`) is accepted whatever its `Content-Type`. The media type is
 * compared case-insensitively, parameters (`; charset=utf-8`) allowed. Otherwise:
 * `415 unsupported-media-type` (the filter adds `no-store`).
 *
 * Express (Nest's default body parsers) has already parsed a urlencoded body at this point, but
 * guards run before any pipe or handler: such a body is never read.
 */
@Injectable()
export class JsonBodyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return false;
    }
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method) || !hasBody(request) || isJson(request)) {
      return true;
    }
    throw new UnsupportedMediaTypeError();
  }
}

function hasBody({ headers }: Request): boolean {
  if (headers['transfer-encoding'] !== undefined) {
    return true;
  }
  const length = headers['content-length'];
  return length !== undefined && length.trim() !== '0';
}

function isJson({ headers }: Request): boolean {
  const mediaType = headers['content-type']?.split(';')[0]?.trim().toLowerCase();
  return mediaType === JSON_MEDIA_TYPE;
}
