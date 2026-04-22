import { Logger, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import { AppModule } from './app.module';
import { getApiRuntimeConfig } from './config/runtime';
import { PrismaService } from './prisma/prisma.service';

const CORS_DOMAIN_CACHE_TTL_MS = 5 * 60 * 1000;

const normalizeOrigin = (value: string) => value.trim().replace(/\/+$/, '');

const normalizeHost = (value: string) =>
  value.trim().toLowerCase().replace(/:\d+$/, '');

const readOriginHost = (origin: string) => {
  try {
    return normalizeHost(new URL(origin).host);
  } catch {
    return null;
  }
};

const isDomainOriginAllowed = async (
  prisma: PrismaService,
  origin: string,
): Promise<boolean> => {
  const originHost = readOriginHost(origin);
  if (!originHost) {
    return false;
  }

  const matchingDomain = await prisma.domain.findFirst({
    where: {
      status: 'active',
      OR: [
        {
          normalizedHost: originHost,
        },
        {
          host: originHost,
        },
        {
          canonicalHost: originHost,
        },
      ],
    },
    select: {
      id: true,
    },
  });

  return Boolean(matchingDomain);
};

async function bootstrap() {
  const runtimeConfig = getApiRuntimeConfig();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 1_048_576,
    }),
  );
  const fastify = app.getHttpAdapter().getInstance();
  const prisma = app.get(PrismaService);
  const explicitOrigins = new Set(
    runtimeConfig.corsAllowedOrigins.map((origin) => normalizeOrigin(origin)),
  );
  const domainCorsCache = new Map<
    string,
    {
      allowed: boolean;
      expiresAt: number;
    }
  >();

  fastify.removeContentTypeParser('application/json');
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (request: unknown, body: string, done: (error: Error | null, value?: unknown) => void) => {
      if (typeof body !== 'string' || body.trim().length === 0) {
        done(null, {});
        return;
      }

      try {
        done(null, JSON.parse(body) as unknown);
      } catch (error) {
        done(error instanceof Error ? error : new Error('Invalid JSON body.'));
      }
    },
  );

  await app.register(cookie);

  app.setGlobalPrefix(runtimeConfig.globalPrefix, {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (explicitOrigins.has(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      const cachedDecision = domainCorsCache.get(normalizedOrigin);
      if (cachedDecision && cachedDecision.expiresAt > Date.now()) {
        callback(null, cachedDecision.allowed);
        return;
      }

      void isDomainOriginAllowed(prisma, normalizedOrigin)
        .then((allowed) => {
          domainCorsCache.set(normalizedOrigin, {
            allowed,
            expiresAt: Date.now() + CORS_DOMAIN_CACHE_TTL_MS,
          });
          callback(null, allowed);
        })
        .catch((error: unknown) => {
          Logger.error(
            `Dynamic CORS lookup failed for origin ${normalizedOrigin}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
            'Bootstrap',
          );
          callback(error as Error, false);
        });
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.listen(runtimeConfig.port, runtimeConfig.host);

  Logger.log(
    `${runtimeConfig.appName} running on http://${runtimeConfig.host}:${runtimeConfig.port}`,
    'Bootstrap',
  );
  Logger.log(`Global prefix: /${runtimeConfig.globalPrefix}`, 'Bootstrap');
}

void bootstrap();
