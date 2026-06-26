import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { getApiRuntimeConfig } from '../../config/runtime';
import { PrismaService } from '../../prisma/prisma.service';
import {
  normalizeDomainHost,
  normalizePublicationPathPrefix,
} from '../shared/publication-resolution.utils';
import type { JsonValue } from '../shared/domain.types';

const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

type CloneMasterFunnelInstanceToTeamParams = {
  sourceFunnelInstanceId: string;
  targetWorkspaceId: string;
  targetTeamId: string;
  targetSponsorId?: string;
  requestedPath?: string;
  publicationName?: string;
  createdByUserId?: string;
  templateKey?: string;
  blueprintKey?: string;
  templateLabel?: string;
  templateDescription?: string;
  instanceCode?: string;
  createPublication?: boolean;
};

type CloneMasterFunnelInstanceToTeamResult = {
  funnelId: string;
  funnelInstanceId: string;
  publicationId: string | null;
  publicUrl?: string | null;
  pathPrefix: string | null;
  stepIdMap: Record<string, string>;
};

const secretKeyFragments = [
  'secret',
  'token',
  'authorization',
  'cookie',
  'api-key',
  'apikey',
  'access-token',
  'access_token',
  'accesstoken',
  'capi',
  'pixel',
  'webhook',
] as const;

const stepReferenceKeys = new Set([
  'stepId',
  'sourceStepId',
  'targetStepId',
  'nextStepId',
  'fromStepId',
  'toStepId',
  'entryStepId',
  'conversionStepId',
  'fallbackStepId',
]);

const signedUrlKeyFragments = [
  'x-amz-',
  'x-goog-',
  'signature',
  'expires',
  'policy',
  'token',
  'access_token',
] as const;

const isSecretKey = (key: string) => {
  const normalized = key.trim().toLowerCase();

  return secretKeyFragments.some((fragment) => normalized.includes(fragment));
};

const isSignedUrl = (value: string) => {
  if (!/^https?:\/\//i.test(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    const query = url.searchParams.toString().toLowerCase();

    return signedUrlKeyFragments.some((fragment) => query.includes(fragment));
  } catch {
    return false;
  }
};

const sanitizeAndRewriteJson = (
  value: Prisma.JsonValue | null | undefined,
  stepIdMap: Map<string, string>,
): JsonValue => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeAndRewriteJson(entry, stepIdMap));
  }

  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') {
      return stepIdMap.get(value) ?? value;
    }

    return (value ?? null) as JsonValue;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isSecretKey(key))
      .map(([key, entryValue]) => {
        if (
          typeof entryValue === 'string' &&
          (stepReferenceKeys.has(key) || stepIdMap.has(entryValue))
        ) {
          return [key, stepIdMap.get(entryValue) ?? entryValue];
        }

        if (typeof entryValue === 'string' && isSignedUrl(entryValue)) {
          return [key, null];
        }

        return [key, sanitizeAndRewriteJson(entryValue, stepIdMap)];
      }),
  ) as JsonValue;
};

const slugifySegment = (value: string | null | undefined, fallback: string) => {
  const normalized = (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
};

@Injectable()
export class FunnelMasterClonerService {
  constructor(private readonly prisma: PrismaService) {}

  async cloneMasterFunnelInstanceToTeam(
    params: CloneMasterFunnelInstanceToTeamParams,
  ): Promise<CloneMasterFunnelInstanceToTeamResult> {
    return this.prisma.$transaction((tx) =>
      this.cloneMasterFunnelInstanceToTeamInTransaction(tx, params),
    );
  }

  async cloneMasterFunnelInstanceToTeamInTransaction(
    tx: Prisma.TransactionClient,
    params: CloneMasterFunnelInstanceToTeamParams,
  ): Promise<CloneMasterFunnelInstanceToTeamResult> {
    const source = await tx.funnelInstance.findUnique({
      where: {
        id: params.sourceFunnelInstanceId,
      },
      include: {
        template: true,
        funnel: true,
        steps: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    if (!source) {
      throw new NotFoundException({
        code: 'FUNNEL_ARSENAL_SOURCE_INSTANCE_NOT_FOUND',
        message:
          'The source funnel instance for this arsenal template was not found.',
      });
    }

    const targetTeam = await tx.team.findUnique({
      where: {
        id: params.targetTeamId,
      },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        code: true,
      },
    });

    if (!targetTeam || targetTeam.workspaceId !== params.targetWorkspaceId) {
      throw new NotFoundException({
        code: 'FUNNEL_ARSENAL_TARGET_TEAM_NOT_FOUND',
        message: 'The target team for this master funnel clone was not found.',
      });
    }

    const shouldCreatePublication = params.createPublication !== false;
    const publicationTarget = shouldCreatePublication
      ? await this.resolvePublicationTarget(tx, {
          workspaceId: params.targetWorkspaceId,
          teamId: params.targetTeamId,
          teamSlug: targetTeam.code || targetTeam.name,
          requestedPath: params.requestedPath,
        })
      : null;
    const stepIdMap = this.reserveStepIdMap(source.steps);
    const stepIdLookup = new Map(Object.entries(stepIdMap));
    const instanceName =
      params.publicationName ??
      params.templateLabel ??
      source.name ??
      'Funnel del Arsenal';
    const instanceCode =
      params.instanceCode ??
      `arsenal-${slugifySegment(params.templateKey, source.code)}`;
    const seoTitle = instanceName;
    const seoDescription =
      params.templateDescription ?? source.funnel?.description ?? null;

    const funnel = await tx.funnel.create({
      data: {
        workspaceId: params.targetWorkspaceId,
        name: instanceName,
        description: params.templateDescription ?? source.funnel?.description,
        code: instanceCode,
        thumbnailUrl: source.thumbnailUrl,
        config: toInputJson(
          sanitizeAndRewriteJson(
            {
              ...((source.funnel?.config ?? {}) as Record<
                string,
                Prisma.JsonValue
              >),
              source: 'funnel_arsenal_master_clone',
              templateKey: params.templateKey ?? null,
              blueprintKey: params.blueprintKey ?? null,
              clonedFromFunnelId: source.funnelId,
              clonedFromFunnelInstanceId: source.id,
              createdByUserId: params.createdByUserId ?? null,
            },
            stepIdLookup,
          ),
        ),
        status: 'active',
        isTemplate: false,
        stages: source.funnel?.stages ?? ['captured', 'qualified', 'assigned'],
        entrySources: source.funnel?.entrySources ?? [
          'manual',
          'form',
          'landing_page',
          'api',
        ],
        defaultTeamId: params.targetTeamId,
        defaultRotationPoolId: null,
      },
    });

    const funnelInstance = await tx.funnelInstance.create({
      data: {
        workspaceId: params.targetWorkspaceId,
        teamId: params.targetTeamId,
        templateId: source.templateId,
        funnelId: funnel.id,
        name: instanceName,
        code: instanceCode,
        thumbnailUrl: source.thumbnailUrl,
        status: 'active',
        structuralType: source.structuralType,
        conversionContract: toInputJson(
          sanitizeAndRewriteJson(
            {
              ...((source.conversionContract ?? {}) as Record<
                string,
                Prisma.JsonValue
              >),
              source: 'funnel_arsenal_master_clone',
              templateKey: params.templateKey ?? null,
              clonedFromFunnelInstanceId: source.id,
            },
            stepIdLookup,
          ),
        ),
        rotationPoolId: null,
        trackingProfileId: null,
        handoffStrategyId: null,
        settingsJson: toInputJson(
          sanitizeAndRewriteJson(source.settingsJson, stepIdLookup),
        ),
        mediaMap: toInputJson(
          sanitizeAndRewriteJson(source.mediaMap, stepIdLookup),
        ),
      },
    });

    for (const step of source.steps) {
      await tx.funnelStep.create({
        data: {
          id: stepIdMap[step.id],
          workspaceId: params.targetWorkspaceId,
          teamId: params.targetTeamId,
          funnelInstanceId: funnelInstance.id,
          stepType: step.stepType,
          slug: step.slug,
          position: step.position,
          isEntryStep: step.isEntryStep,
          isConversionStep: step.isConversionStep,
          blocksJson: toInputJson(
            sanitizeAndRewriteJson(step.blocksJson, stepIdLookup),
          ),
          mediaMap: toInputJson(
            sanitizeAndRewriteJson(step.mediaMap, stepIdLookup),
          ),
          settingsJson: toInputJson(
            sanitizeAndRewriteJson(step.settingsJson, stepIdLookup),
          ),
        },
      });
    }

    if (!publicationTarget) {
      return {
        funnelId: funnel.id,
        funnelInstanceId: funnelInstance.id,
        publicationId: null,
        publicUrl: null,
        pathPrefix: null,
        stepIdMap,
      };
    }

    const publication = await tx.funnelPublication.create({
      data: {
        workspaceId: params.targetWorkspaceId,
        teamId: params.targetTeamId,
        domainId: publicationTarget.domainId,
        funnelInstanceId: funnelInstance.id,
        trackingProfileId: null,
        handoffStrategyId: null,
        seoTitle,
        seoDescription,
        ogImageUrl: null,
        faviconUrl: null,
        manifestVersion: 1,
        runtimeHealthStatus: 'healthy',
        metaPixelId: null,
        tiktokPixelId: null,
        metaCapiToken: null,
        tiktokAccessToken: null,
        pathPrefix: publicationTarget.pathPrefix,
        status: 'active',
        isActive: true,
        isPrimary: false,
      },
      select: {
        id: true,
        pathPrefix: true,
        domain: {
          select: {
            host: true,
          },
        },
      },
    });

    return {
      funnelId: funnel.id,
      funnelInstanceId: funnelInstance.id,
      publicationId: publication.id,
      publicUrl: this.toPublicUrl(
        publication.domain.host,
        publication.pathPrefix,
      ),
      pathPrefix: publication.pathPrefix,
      stepIdMap,
    };
  }

  async resolvePublicationTarget(
    client: PrismaClientLike,
    input: {
      workspaceId: string;
      teamId: string;
      teamSlug: string;
      requestedPath?: string;
    },
  ) {
    const customDomain = await client.domain.findFirst({
      where: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        status: 'active',
        NOT: {
          domainType: 'system_subdomain',
        },
      },
      select: {
        id: true,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    if (customDomain) {
      return {
        domainId: customDomain.id,
        pathPrefix: await this.resolveAvailablePathPrefix(
          client,
          customDomain.id,
          input.requestedPath,
        ),
      };
    }

    const platformDomain = await this.resolvePlatformDomain(client, input);
    const teamSlug = slugifySegment(input.teamSlug, input.teamId);
    const basePath = normalizePublicationPathPrefix(input.requestedPath ?? '/');
    const platformPath =
      basePath === '/' ? `/u/${teamSlug}` : `/u/${teamSlug}${basePath}`;

    return {
      domainId: platformDomain.id,
      pathPrefix: await this.resolveAvailablePathPrefix(
        client,
        platformDomain.id,
        platformPath,
      ),
    };
  }

  private async resolvePlatformDomain(
    client: PrismaClientLike,
    input: {
      workspaceId: string;
      teamId: string;
    },
  ) {
    const configuredUrl = getApiRuntimeConfig().publicRefBaseUrl;
    const host = normalizeDomainHost(new URL(configuredUrl).host);

    return client.domain.upsert({
      where: {
        normalizedHost: host,
      },
      create: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        host,
        normalizedHost: host,
        status: 'active',
        onboardingStatus: 'active',
        domainType: 'system_subdomain',
        isPrimary: false,
        canonicalHost: host,
        redirectToPrimary: false,
        verificationStatus: 'verified',
        sslStatus: 'active',
        verificationMethod: 'none',
      },
      update: {
        status: 'active',
        onboardingStatus: 'active',
        domainType: 'system_subdomain',
        verificationStatus: 'verified',
        sslStatus: 'active',
      },
      select: {
        id: true,
        host: true,
      },
    });
  }

  private async resolveAvailablePathPrefix(
    client: PrismaClientLike,
    domainId: string,
    requestedPath?: string | null,
  ) {
    const basePath = normalizePublicationPathPrefix(requestedPath ?? '/');
    const suffixBase = basePath === '/' ? '/info' : basePath;

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const pathPrefix =
        attempt === 0 ? basePath : `${suffixBase}-${attempt + 1}`;
      const conflict = await client.funnelPublication.findFirst({
        where: {
          domainId,
          pathPrefix,
        },
        select: {
          id: true,
        },
      });

      if (!conflict) {
        return pathPrefix;
      }
    }

    throw new ConflictException({
      code: 'FUNNEL_ARSENAL_PATH_CONFLICT',
      message: 'We could not generate an available publication path.',
    });
  }

  private reserveStepIdMap(steps: { id: string }[]) {
    const entries = steps.map((step) => [step.id, randomUUID()] as const);

    return Object.fromEntries(entries);
  }

  private toPublicUrl(host: string, pathPrefix: string) {
    return `https://${host}${pathPrefix === '/' ? '/' : pathPrefix}`;
  }
}

export type {
  CloneMasterFunnelInstanceToTeamParams,
  CloneMasterFunnelInstanceToTeamResult,
};
