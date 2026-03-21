import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.enableCors();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');

  Logger.log(`Leadflow API running on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
