import { Module } from '@nestjs/common';
import { APP_GUARD, DiscoveryModule } from '@nestjs/core';
import { AccountsModule } from '../../modules/accounts/accounts.module';
import { AuthModule } from '../../modules/auth/auth.module';
import { AccessMetadataCheck } from './access-metadata.check';
import { DevAuthStub } from './dev-auth-stub';
import { JsonBodyGuard } from './json-body.guard';
import { OriginGuard } from './origin.guard';
import { SessionGuard } from './session.guard';

/**
 * The global guards (D34, D37), in this order: the `OriginGuard` (no database, refuses a forged
 * request before any session is read or touched), the `JsonBodyGuard` (a body must be JSON), then
 * the `SessionGuard` (refusal by default). `AccessMetadataCheck` refuses at boot a route both
 * `@Public()` and `@Roles()`. Nest runs the `APP_GUARD`s in their registration order, before any controller guard.
 */
@Module({
  imports: [AuthModule, AccountsModule, DiscoveryModule],
  providers: [
    DevAuthStub,
    AccessMetadataCheck,
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: JsonBodyGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AccessControlModule {}
