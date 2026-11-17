import type { INestApplication } from '@nestjs/common';
import { LogSafeExceptionFilter } from './common/filters/log-safe-exception.filter';
import { createValidationPipe } from './common/validation/validation-pipe';

export const GLOBAL_PREFIX = 'api';

export interface AppSettings {
  readonly corsOrigins: string[];
}

/** HTTP setup shared by `main.ts` and the e2e tests, so tests exercise the real pipeline. */
export function configureApp(app: INestApplication, { corsOrigins }: AppSettings): void {
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new LogSafeExceptionFilter(app.getHttpAdapter()));
  app.enableCors({ origin: corsOrigins });
}
