import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { json } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { EnvService } from './modules/env/env.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const env = app.get(EnvService);
  const logger = new Logger('Bootstrap');

  app.use(helmet());
  app.use(json({ limit: '256kb' }));

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({ origin: env.get('CORS_ORIGIN') });

  const port = env.get('PORT');
  await app.listen(port, '127.0.0.1');
  logger.log(`Backend running on http://127.0.0.1:${port}/api`);
}

bootstrap();
