import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule, type TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { AppConfigService } from '../config/app-config.service';
import type { DatabaseEnvironment } from '../config/environment';
import { buildDataSourceOptions } from './database.options';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: AppConfigService): TypeOrmModuleOptions => ({
        ...buildDataSourceOptions(readDatabaseEnvironment(config)),
        // Entities registered through `TypeOrmModule.forFeature()` are picked up automatically.
        autoLoadEntities: true,
      }),
    }),
  ],
})
export class DatabaseModule {}

function readDatabaseEnvironment(config: AppConfigService): DatabaseEnvironment {
  return {
    DATABASE_HOST: config.get('DATABASE_HOST', { infer: true }),
    DATABASE_PORT: config.get('DATABASE_PORT', { infer: true }),
    DATABASE_USER: config.get('DATABASE_USER', { infer: true }),
    DATABASE_PASSWORD: config.get('DATABASE_PASSWORD', { infer: true }),
    DATABASE_NAME: config.get('DATABASE_NAME', { infer: true }),
  };
}
