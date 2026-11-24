import { AccessControlModule } from './common/auth/access-control.module';
import { SyncModule } from './common/sync/sync.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthHttpModule } from './modules/auth/auth-http.module';
import { AuthModule } from './modules/auth/auth.module';
import { BuddiesModule } from './modules/buddies/buddies.module';
import { ConsentsModule } from './modules/consents/consents.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CertificationLevelsModule } from './modules/certification-levels/certification-levels.module';
import { DiveSitesModule } from './modules/dive-sites/dive-sites.module';
import { DiversModule } from './modules/divers/divers.module';
import { DivesModule } from './modules/dives/dives.module';
import { HealthModule } from './modules/health/health.module';

/**
 * Every module of the application but the infrastructure (`ConfigModule.forRoot`, which reads and
 * validates `.env` as soon as `app.module.ts` is imported, and `DatabaseModule`). `AppModule`
 * imports them; the route inventory test mounts exactly these on a fake infrastructure, so a route
 * added to any of them is inventoried.
 */
export const APPLICATION_MODULES = [
  SyncModule,
  HealthModule,
  CertificationLevelsModule,
  DiversModule,
  DiveSitesModule,
  BuddiesModule,
  DivesModule,
  DashboardModule,
  AccountsModule,
  AuthModule,
  AuthHttpModule,
  ConsentsModule,
  // The global guards (`APP_GUARD`): `OriginGuard`, `JsonBodyGuard`, then `SessionGuard`.
  AccessControlModule,
];
