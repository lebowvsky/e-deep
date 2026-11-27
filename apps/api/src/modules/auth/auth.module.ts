import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionCookies } from '../../common/auth/session-cookie';
import { CLOCK, systemClock, type Clock } from '../../common/time/clock';
import type { AppConfigService } from '../../config/app-config.service';
import { DiversModule } from '../divers/divers.module';
import { AuthEvent } from './auth-event.entity';
import { AuthEventsService } from './auth-events.service';
import { AUTH_SETTINGS, type AuthSettings } from './auth-settings';
import { AuthenticationService } from './authentication.service';
import { LoginThrottle } from './login-throttle';
import { loadCompromisedPasswords } from './password/compromised-passwords';
import { PasswordHasher } from './password/password-hasher';
import { PasswordPolicy } from './password/password-policy';
import { RegistrationService } from './registration.service';
import { Session } from './session.entity';
import { SessionService } from './session.service';
import { StaffTotp } from './totp/staff-totp';
import { TotpKeyBootCheck } from './totp/totp-key-boot-check';

/**
 * Sessions, sign-in and sign-up (D33 to D35, D39), the staff second factor (D42). The password
 * hasher (dummy hash) and the policy (compromised list) are built once at boot by async factories;
 * the boot fails when a staff account exists without `TOTP_ENCRYPTION_KEY` (`TotpKeyBootCheck`). No controller here: answering the
 * routes needs the account's `MeResponse` (`AccountsModule`, which depends on this module), so the
 * controllers live in `AuthHttpModule`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Session, AuthEvent]), DiversModule],
  providers: [
    { provide: CLOCK, useValue: systemClock },
    {
      provide: AUTH_SETTINGS,
      inject: [ConfigService],
      useFactory: (config: AppConfigService): AuthSettings => ({
        registrationEnabled: config.get('REGISTRATION_ENABLED', { infer: true }),
      }),
    },
    { provide: PasswordHasher, useFactory: () => PasswordHasher.create() },
    {
      provide: PasswordPolicy,
      useFactory: async () => new PasswordPolicy(await loadCompromisedPasswords()),
    },
    // Monotonic clock by default; one instance per process (in-memory buckets, D35).
    { provide: LoginThrottle, useFactory: () => new LoginThrottle() },
    {
      provide: StaffTotp,
      inject: [ConfigService, CLOCK],
      useFactory: (config: AppConfigService, clock: Clock): StaffTotp =>
        StaffTotp.fromEncodedKey(config.get('TOTP_ENCRYPTION_KEY', { infer: true }), clock),
    },
    TotpKeyBootCheck,
    SessionService,
    AuthEventsService,
    AuthenticationService,
    RegistrationService,
    SessionCookies,
  ],
  exports: [
    CLOCK,
    PasswordHasher,
    PasswordPolicy,
    LoginThrottle,
    StaffTotp,
    SessionService,
    AuthEventsService,
    AuthenticationService,
    RegistrationService,
    SessionCookies,
  ],
})
export class AuthModule {}
