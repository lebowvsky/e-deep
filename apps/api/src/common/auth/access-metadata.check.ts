import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { routeHandlers } from './route-handlers';
import { ROLES_KEY } from './roles.decorator';

/**
 * Fails the boot on a contradictory access declaration: a route both `@Public()` and `@Roles(…)`
 * (on the handler or its controller). The `SessionGuard` would serve it without a session, so the
 * roles would silently mean nothing.
 */
@Injectable()
export class AccessMetadataCheck implements OnModuleInit {
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit(): void {
    const contradictions = routeHandlers(this.discovery, new MetadataScanner(), this.reflector)
      .filter(({ controller, handler }) => {
        const targets = [handler, controller];
        return (
          this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, targets) === true &&
          this.reflector.getAllAndOverride<unknown>(ROLES_KEY, targets) !== undefined
        );
      })
      .map(({ controllerName, methodName }) => `${controllerName}.${methodName}`);
    if (contradictions.length > 0) {
      throw new Error(`@Public() and @Roles() on the same route: ${contradictions.join(', ')}`);
    }
  }
}
