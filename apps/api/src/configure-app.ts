import type { NestExpressApplication } from '@nestjs/platform-express';
import { LogSafeExceptionFilter } from './common/filters/log-safe-exception.filter';
import { createValidationPipe } from './common/validation/validation-pipe';

export const GLOBAL_PREFIX = 'api';

export interface AppSettings {
  readonly corsOrigins: string[];
  /** Number of reverse-proxy hops Express trusts for `req.ip` / `req.protocol`. */
  readonly trustProxy: number;
}

/** HTTP setup shared by `main.ts` and the e2e tests, so tests exercise the real pipeline. */
export function configureApp(
  app: NestExpressApplication,
  { corsOrigins, trustProxy }: AppSettings,
): void {
  // Do not advertise the framework.
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.setGlobalPrefix(GLOBAL_PREFIX);
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new LogSafeExceptionFilter(app.getHttpAdapter()));
  app.enableCors({ origin: corsOrigins });
}
