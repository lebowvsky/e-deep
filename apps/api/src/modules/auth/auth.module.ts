import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CLOCK, systemClock } from '../../common/time/clock';
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

/**
 * Sessions, sign-in and sign-up (D33 to D35, D39). The password hasher (dummy hash) and the policy
 * (compromised list) are built once at boot by async factories. No controller until lot 3.
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
    SessionService,
    AuthEventsService,
    AuthenticationService,
    RegistrationService,
  ],
  exports: [
    CLOCK,
    PasswordHasher,
    PasswordPolicy,
    LoginThrottle,
    SessionService,
    AuthEventsService,
    AuthenticationService,
    RegistrationService,
  ],
})
export class AuthModule {}
