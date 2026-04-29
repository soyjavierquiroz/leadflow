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

const probeBootstrapDatabase = async (prisma: PrismaService) => {
  try {
    Logger.log('Running bootstrap database probe (SELECT 1).', 'Bootstrap');
    await prisma.$queryRawUnsafe('SELECT 1');

    const funnelInstanceColumns = await prisma.$queryRawUnsafe<
      Array<{ column_name: string }>
    >(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'FunnelInstance'
          AND column_name IN ('structuralType', 'conversionContract')
      `,
    );

    const resolvedColumns = funnelInstanceColumns.map((row) => row.column_name);
    Logger.log(
      `Bootstrap schema probe resolved FunnelInstance columns: ${
        resolvedColumns.length > 0 ? resolvedColumns.join(', ') : 'none'
      }.`,
      'Bootstrap',
    );
  } catch (error) {
    Logger.error(
      `Bootstrap database probe failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
      undefined,
      'Bootstrap',
    );
  }
};

async function bootstrap() {
  const runtimeConfig = getApiRuntimeConfig();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 10_485_760,
    }),
  );
  const prisma = app.get(PrismaService);
  const fastify = app.getHttpAdapter().getInstance();
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

  await app.register(cookie);
  await probeBootstrapDatabase(prisma);
  fastify.addContentTypeParser(
    /^multipart\/form-data(?:;.*)?$/i,
    { parseAs: 'buffer', bodyLimit: 10_485_760 },
    (_request, body, done) => {
      done(null, body);
    },
  );

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
