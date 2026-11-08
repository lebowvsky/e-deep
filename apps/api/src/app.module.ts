import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnvironmentVariables, validateEnvironment } from './config/environment';
import { SyncModule } from './common/sync/sync.module';
import { DatabaseModule } from './database/database.module';
import { BuddiesModule } from './modules/buddies/buddies.module';
import { CertificationLevelsModule } from './modules/certification-levels/certification-levels.module';
import { DiveSitesModule } from './modules/dive-sites/dive-sites.module';
import { DiversModule } from './modules/divers/divers.module';
import { DivesModule } from './modules/dives/dives.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // `apps/api/.env`, whatever the working directory (same file as the TypeORM CLI).
      envFilePath: join(__dirname, '..', '.env'),
      validate: (rawEnvironment) => validateEnvironment(EnvironmentVariables, rawEnvironment),
    }),
    DatabaseModule,
    SyncModule,
    HealthModule,
    CertificationLevelsModule,
    DiversModule,
    DiveSitesModule,
    BuddiesModule,
    DivesModule,
  ],
})
export class AppModule {}
