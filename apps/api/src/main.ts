import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { LogSafeLogger } from './common/logging/log-safe-logger';
import type { AppConfigService } from './config/app-config.service';
import { configureApp } from './configure-app';

const logger = new LogSafeLogger(process.env['NODE_ENV']);

async function bootstrap(): Promise<void> {
  // From the very first line of the boot, so that no library logs a stack in production (§9.10).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger });
  const config = app.get<AppConfigService>(ConfigService);

  configureApp(app, { trustProxy: config.get('TRUST_PROXY', { infer: true }) });
  // Closes the database pool cleanly on SIGTERM / SIGINT.
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
}

// Without this, Node prints the rejection itself, stack and message included (e.g. the final
// TypeORM connection error, which names the database host and port).
bootstrap().catch((error: unknown) => {
  logger.fatal('Bootstrap failed', error, 'Bootstrap');
  process.exitCode = 1;
});
