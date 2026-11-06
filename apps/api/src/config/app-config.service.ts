import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from './environment';

/**
 * `ConfigService` typed against the validated environment.
 * Use `config.get('PORT', { infer: true })` to get a typed, non-undefined value.
 */
export type AppConfigService = ConfigService<EnvironmentVariables, true>;
