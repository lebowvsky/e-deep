import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

/**
 * Opens a route (or every route of a controller) without a session (D37). The list of public
 * routes is frozen by `test/route-inventory.e2e-spec.ts`: adding one fails it until it is declared
 * there. A public route has no `AuthContext` and no `Cache-Control: no-store` from the guard.
 */
export const Public = (): ClassDecorator & MethodDecorator => SetMetadata(IS_PUBLIC_KEY, true);
