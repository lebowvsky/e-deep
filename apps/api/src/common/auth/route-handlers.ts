import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import type { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import type { RouteTarget } from './route-audience';

/** A route handler of a controller, as Nest registers it. */
export interface RouteHandler {
  readonly controller: RouteTarget;
  readonly controllerName: string;
  readonly methodName: string;
  readonly handler: RouteTarget;
  readonly requestMethod: RequestMethod;
}

/** Every route handler of the application's controllers (`DiscoveryService`, `MetadataScanner`). */
export function routeHandlers(
  discovery: DiscoveryService,
  scanner: MetadataScanner,
  reflector: Reflector,
): RouteHandler[] {
  const handlers: RouteHandler[] = [];
  for (const wrapper of discovery.getControllers()) {
    const { metatype } = wrapper;
    const instance: unknown = wrapper.instance;
    if (metatype === null || typeof instance !== 'object' || instance === null) {
      continue;
    }
    const prototype: unknown = Object.getPrototypeOf(instance);
    if (typeof prototype !== 'object' || prototype === null) {
      continue;
    }
    for (const methodName of scanner.getAllMethodNames(prototype)) {
      const handler: unknown = Reflect.get(prototype, methodName);
      if (typeof handler !== 'function') {
        continue;
      }
      const requestMethod = reflector.get<RequestMethod | undefined>(METHOD_METADATA, handler);
      if (requestMethod !== undefined) {
        handlers.push({
          controller: metatype,
          controllerName: metatype.name,
          methodName,
          handler,
          requestMethod,
        });
      }
    }
  }
  return handlers;
}
