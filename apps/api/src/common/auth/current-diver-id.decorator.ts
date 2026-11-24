import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ForbiddenError } from '../errors/domain-errors';
import { authContextOf, type AuthContext } from './auth-context';
import type { DiverId } from './diver-id';

function requireAuthContext(context: ExecutionContext): AuthContext {
  const auth = authContextOf(context.switchToHttp().getRequest<Request>());
  if (auth === undefined) {
    // A programming error (decorator on a `@Public` route), never a client one: a generic 500.
    throw new Error('No AuthContext on this route: is it public?');
  }
  return auth;
}

/** The `AuthContext` of the request (D33); the route must not be `@Public`. */
export const CurrentAuth = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => requireAuthContext(context),
);

/**
 * The current diver (D37), the only source of a `DiverId` for the services: never a route
 * parameter nor a body field. A staff account has no diver: `403 forbidden` (unreachable on a web
 * route, whose audience already refuses staff sessions: defence in depth).
 */
export const CurrentDiverId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): DiverId => {
    const { diverId } = requireAuthContext(context);
    if (diverId === null) {
      throw new ForbiddenError();
    }
    return diverId;
  },
);
