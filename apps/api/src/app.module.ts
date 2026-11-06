import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EnvironmentVariables, validateEnvironment } from './config/environment';
import { DatabaseModule } from './database/database.module';
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
    HealthModule,
  ],
})
export class AppModule {}
