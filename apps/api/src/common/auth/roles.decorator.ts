import type { AccountRole } from '@e-deep/shared';
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'auth:roles';

/**
 * Roles allowed on a route (or every route of a controller), on top of the audience (D37). Without
 * it, a web route serves the `diver` role and an admin route every staff role. A session of
 * another role answers `403 forbidden`.
 */
export const Roles = (
  ...roles: readonly [AccountRole, ...AccountRole[]]
): ClassDecorator & MethodDecorator => SetMetadata(ROLES_KEY, roles);
