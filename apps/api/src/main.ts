import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { AppConfigService } from './config/app-config.service';
import { configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<AppConfigService>(ConfigService);

  configureApp(app, { corsOrigins: config.get('CORS_ORIGINS', { infer: true }) });
  // Closes the database pool cleanly on SIGTERM / SIGINT.
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
