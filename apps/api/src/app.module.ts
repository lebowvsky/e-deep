import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APPLICATION_MODULES } from './application-modules';
import { EnvironmentVariables, validateEnvironment } from './config/environment';
import { DatabaseModule } from './database/database.module';

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
    ...APPLICATION_MODULES,
  ],
})
export class AppModule {}
