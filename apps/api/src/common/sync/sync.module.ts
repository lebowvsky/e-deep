import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfigService } from '../../config/app-config.service';
import { SYNC_SETTINGS, type SyncSettings } from './sync-settings';

/** Provides the synchronisation settings, read from the validated environment. */
@Global()
@Module({
  providers: [
    {
      provide: SYNC_SETTINGS,
      inject: [ConfigService],
      useFactory: (config: AppConfigService): SyncSettings => ({
        purgeHorizonDays: config.get('SYNC_PURGE_HORIZON_DAYS', { infer: true }),
      }),
    },
  ],
  exports: [SYNC_SETTINGS],
})
export class SyncModule {}
