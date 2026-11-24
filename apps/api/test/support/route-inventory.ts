import { RequestMethod, type INestApplication } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../src/common/auth/public.decorator';
import { routePath } from '../../src/common/auth/route-audience';
import { routeHandlers } from '../../src/common/auth/route-handlers';
import { GLOBAL_PREFIX } from '../../src/configure-app';

export type RouteMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** A route of the application, as Nest registers it. */
export interface InventoriedRoute {
  readonly method: RouteMethod;
  /** With the global prefix and the parameters as declared: `/api/dives/:id`. */
  readonly path: string;
  /** `GET /api/dives/:id`. */
  readonly key: string;
  readonly isPublic: boolean;
}

const METHODS: ReadonlyMap<RequestMethod, RouteMethod> = new Map([
  [RequestMethod.GET, 'GET'],
  [RequestMethod.POST, 'POST'],
  [RequestMethod.PUT, 'PUT'],
  [RequestMethod.DELETE, 'DELETE'],
  [RequestMethod.PATCH, 'PATCH'],
]);

/**
 * Every route handler of the application (`DiscoveryService`, `MetadataScanner`, `Reflector`),
 * sorted by key. The application must import `DiscoveryModule`. A route of an unsupported method
 * (`ALL`, `HEAD`…) fails: the inventory would not know how to call it.
 */
export function inventoryRoutes(app: INestApplication): InventoriedRoute[] {
  const reflector = app.get(Reflector);
  return routeHandlers(app.get(DiscoveryService), new MetadataScanner(), reflector)
    .map(({ controller, controllerName, methodName, handler, requestMethod }) => {
      const method = METHODS.get(requestMethod);
      if (method === undefined) {
        throw new Error(`Unsupported method on ${controllerName}.${methodName}`);
      }
      const path = `/${GLOBAL_PREFIX}/${routePath(reflector, controller, handler)}`;
      const isPublic =
        reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [handler, controller]) ===
        true;
      return { method, path, key: `${method} ${path}`, isPublic };
    })
    .sort((left, right) => left.key.localeCompare(right.key));
}

/** The path with every `:param` replaced by `value` (a UUID by default). */
export function concretePath(path: string, value = '01900000-0000-7000-8000-0000000000ff'): string {
  return path.replace(/:[A-Za-z]+/g, value);
}

/** The supertest method of a route method: `request(server)[SUPERTEST_METHODS[route.method]](…)`. */
export const SUPERTEST_METHODS = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  DELETE: 'delete',
  PATCH: 'patch',
} as const satisfies Record<RouteMethod, string>;

/** Whether a response body is the `{ statusCode, code }` error of the contract with this code. */
export function hasErrorCode(body: unknown, code: string): boolean {
  return typeof body === 'object' && body !== null && 'code' in body && body.code === code;
}
