import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { AdminAuthController } from './admin-auth.controller';
import { AuthController } from './auth.controller';
import { AuthModule } from './auth.module';

/**
 * Routes of the sign-up, sign-in and sign-out (`/auth/*`, `/admin/auth/*`, §3). Separate from
 * `AuthModule` because they answer `MeResponse`, built by `AccountsModule`, which itself depends
 * on `AuthModule`: hosting them there would be a module cycle.
 */
@Module({
  imports: [AuthModule, AccountsModule],
  controllers: [AuthController, AdminAuthController],
})
export class AuthHttpModule {}
