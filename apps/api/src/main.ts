import { Logger, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { AppModule } from './app.module';
import { getApiRuntimeConfig } from './config/runtime';

async function bootstrap() {
  const runtimeConfig = getApiRuntimeConfig();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  await app.register(cookie);

  app.setGlobalPrefix(runtimeConfig.globalPrefix, {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  app.enableCors({
    origin: runtimeConfig.corsAllowedOrigins,
    credentials: true,
  });

  await app.listen(runtimeConfig.port, runtimeConfig.host);

  Logger.log(
    `${runtimeConfig.appName} running on http://${runtimeConfig.host}:${runtimeConfig.port}`,
    'Bootstrap',
  );
  Logger.log(`Global prefix: /${runtimeConfig.globalPrefix}`, 'Bootstrap');
}

void bootstrap();
