import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  PublicRuntimeEntryContext,
  PublicRuntimePayload,
  PublicRuntimeStep,
} from './public-funnel-runtime.types';
import {
  buildPublicationStepPath,
  comparePublicationPathPrefix,
  matchesPublicationPath,
  normalizeHost,
  normalizePath,
  normalizeStepSlug,
  resolveRelativeStepPath,
} from './public-funnel-runtime.utils';
import { resolvePublicHandoffConfig } from './reveal-handoff.utils';

const publicRuntimeInclude = {
  domain: true,
  trackingProfile: {
    include: {
      conversionEventMappings: true,
    },
  },
  handoffStrategy: true,
  funnelInstance: {
    include: {
      template: true,
      trackingProfile: {
        include: {
          conversionEventMappings: true,
        },
      },
      handoffStrategy: true,
      steps: {
        orderBy: {
          position: 'asc',
        },
      },
    },
  },
} satisfies Prisma.FunnelPublicationInclude;

const PERSONAL_LINK_PATH_PREFIX = '/a';

type RuntimePublicationRecord = Prisma.FunnelPublicationGetPayload<{
  include: typeof publicRuntimeInclude;
}>;

type PersonalLinkRoute = {
  sponsorSlug: string;
  runtimePathPrefix: string;
};

type ResolvedRuntimeEntryContext = PublicRuntimeEntryContext & {
  runtimePathPrefix: string | null;
};

const asJsonRecord = (value: Prisma.JsonValue | null | undefined) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : null;

const readNullableString = (
  value: RuntimePublicationRecord,
  key: 'metaPixelId' | 'tiktokPixelId',
) => {
  const candidate = (value as RuntimePublicationRecord &
    Partial<Record<'metaPixelId' | 'tiktokPixelId', unknown>>)[key];

  return typeof candidate === 'string' ? candidate : null;
};

const normalizePersonalLinkSegment = (value: string | null | undefined) => {
  if (typeof value !== 'string') {
    return null;
  }

  const decoded = decodeURIComponent(value).trim().toLowerCase();
  return decoded.length > 0 ? decoded : null;
};

const parsePersonalLinkRoute = (path: string): PersonalLinkRoute | null => {
  const segments = normalizePath(path)
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments[0] !== 'a') {
    return null;
  }

  const sponsorSlug = normalizePersonalLinkSegment(segments[1]);
  if (!sponsorSlug) {
    return null;
  }

  return {
    sponsorSlug,
    runtimePathPrefix: `${PERSONAL_LINK_PATH_PREFIX}/${sponsorSlug}`,
  };
};

@Injectable()
export class PublicFunnelRuntimeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveByHostAndPath(
    host: string,
    path: string,
  ): Promise<PublicRuntimePayload> {
    const normalizedHost = normalizeHost(host);
    const normalizedPath = normalizePath(path);
    const personalLinkRoute = parsePersonalLinkRoute(normalizedPath);

    if (!normalizedHost) {
      throw new BadRequestException({
        code: 'HOST_REQUIRED',
        message: 'A host is required to resolve a public publication.',
      });
    }

    const publications = await this.prisma.funnelPublication.findMany({
      where: {
        status: 'active',
        isActive: true,
        domain: {
          normalizedHost,
          status: 'active',
        },
        funnelInstance: {
          status: 'active',
        },
      },
      include: publicRuntimeInclude,
    });

    const matchingPublication = publications
      .filter((publication) => {
        if (personalLinkRoute) {
          return publication.pathPrefix === '/';
        }

        return matchesPublicationPath(normalizedPath, publication.pathPrefix);
      })
      .sort((left, right) =>
        comparePublicationPathPrefix(left.pathPrefix, right.pathPrefix),
      )[0];

    if (!matchingPublication) {
      throw new NotFoundException({
        code: 'PUBLICATION_NOT_FOUND',
        message: `No active publication was found for ${normalizedHost}${normalizedPath}.`,
      });
    }

    const entryContext = await this.resolveEntryContextForPublication({
      workspaceId: matchingPublication.workspaceId,
      teamId: matchingPublication.teamId,
      publicationPathPrefix: matchingPublication.pathPrefix,
      requestedPath: normalizedPath,
    });

    return this.buildRuntimePayload(
      matchingPublication,
      normalizedHost,
      normalizedPath,
      entryContext,
    );
  }

  async resolveEntryContextForPublication(input: {
    workspaceId: string;
    teamId: string;
    publicationPathPrefix: string;
    requestedPath: string;
    tx?: Prisma.TransactionClient | PrismaService;
  }): Promise<ResolvedRuntimeEntryContext> {
    const normalizedPath = normalizePath(input.requestedPath);
    const personalLinkRoute = parsePersonalLinkRoute(normalizedPath);

    if (!personalLinkRoute || input.publicationPathPrefix !== '/') {
      return {
        entryMode: 'paid_ads',
        forcedSponsorId: null,
        browserPixelsEnabled: true,
        runtimePathPrefix: null,
      };
    }

    const prismaClient = input.tx ?? this.prisma;
    const sponsor = await prismaClient.sponsor.findFirst({
      where: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        publicSlug: personalLinkRoute.sponsorSlug,
        isActive: true,
        status: 'active',
        availabilityStatus: 'available',
      } as Prisma.SponsorWhereInput,
      select: {
        id: true,
      },
    });

    if (!sponsor) {
      throw new NotFoundException({
        code: 'PUBLIC_SPONSOR_NOT_FOUND',
        message: `No active public sponsor matched ${normalizedPath}.`,
      });
    }

    return {
      entryMode: 'organic_asesor',
      forcedSponsorId: sponsor.id,
      browserPixelsEnabled: false,
      runtimePathPrefix: personalLinkRoute.runtimePathPrefix,
    };
  }

  async getPublicationRuntime(
    publicationId: string,
  ): Promise<PublicRuntimePayload> {
    const publication = await this.prisma.funnelPublication.findUnique({
      where: { id: publicationId },
      include: publicRuntimeInclude,
    });

    if (
      !publication ||
      publication.status !== 'active' ||
      !publication.isActive ||
      publication.domain.status !== 'active'
    ) {
      throw new NotFoundException({
        code: 'PUBLICATION_NOT_FOUND',
        message: `Publication ${publicationId} is not active.`,
      });
    }

    return this.buildRuntimePayload(
      publication,
      publication.domain.host,
      publication.pathPrefix,
      {
        entryMode: 'paid_ads',
        forcedSponsorId: null,
        browserPixelsEnabled: true,
        runtimePathPrefix: null,
      },
    );
  }

  async getStepRuntime(
    publicationId: string,
    stepSlug: string,
  ): Promise<PublicRuntimePayload> {
    const runtime = await this.getPublicationRuntime(publicationId);
    const requestedPath = buildPublicationStepPath(
      runtime.publication.pathPrefix,
      stepSlug,
      false,
    );

    return this.resolveByHostAndPath(runtime.domain.host, requestedPath);
  }

  private buildRuntimePayload(
    publication: RuntimePublicationRecord,
    requestedHost: string,
    requestedPath: string,
    entryContext: ResolvedRuntimeEntryContext,
  ): PublicRuntimePayload {
    const effectivePublicationPathPrefix =
      entryContext.runtimePathPrefix ?? publication.pathPrefix;
    const relativeStepPath = resolveRelativeStepPath(
      requestedPath,
      effectivePublicationPathPrefix,
    );

    const steps = publication.funnelInstance.steps.map((step) => ({
      slug: normalizeStepSlug(step.slug),
      id: step.id,
      path: buildPublicationStepPath(
        effectivePublicationPathPrefix,
        step.slug,
        step.isEntryStep,
      ),
      stepType: step.stepType,
      position: step.position,
      isEntryStep: step.isEntryStep,
      isConversionStep: step.isConversionStep,
      blocksJson: step.blocksJson,
      mediaMap: step.mediaMap,
      settingsJson: step.settingsJson,
    }));

    const entryStep = steps.find((step) => step.isEntryStep) ?? steps[0];
    if (!entryStep) {
      throw new NotFoundException({
        code: 'STEP_NOT_FOUND',
        message: `Publication ${publication.id} does not have any steps.`,
      });
    }

    const normalizedRelativeSlug = normalizeStepSlug(relativeStepPath);
    const currentStep =
      relativeStepPath === '/'
        ? entryStep
        : steps.find((step) => step.slug === normalizedRelativeSlug);

    if (!currentStep) {
      throw new NotFoundException({
        code: 'STEP_NOT_FOUND',
        message: `No published step matched ${requestedHost}${requestedPath}.`,
      });
    }

    const currentIndex = steps.findIndex((step) => step.id === currentStep.id);
    const nextStep = this.toAdjacentStep(steps[currentIndex + 1]);
    const previousStep = this.toAdjacentStep(steps[currentIndex - 1]);

    const effectiveTrackingProfile =
      publication.trackingProfile ?? publication.funnelInstance.trackingProfile;
    const effectiveHandoffStrategy =
      publication.handoffStrategy ?? publication.funnelInstance.handoffStrategy;
    const handoff = resolvePublicHandoffConfig(effectiveHandoffStrategy);
    const theme = this.extractFunnelTheme(
      publication.funnelInstance.settingsJson as Prisma.JsonValue,
    );

    return {
      request: {
        host: requestedHost,
        path: requestedPath,
        publicationPathPrefix: effectivePublicationPathPrefix,
        relativeStepPath,
      },
      domain: {
        id: publication.domain.id,
        host: publication.domain.host,
        normalizedHost: publication.domain.normalizedHost,
        domainType: publication.domain.domainType,
        isPrimary: publication.domain.isPrimary,
        canonicalHost: publication.domain.canonicalHost,
        redirectToPrimary: publication.domain.redirectToPrimary,
      },
      entryContext: {
        entryMode: entryContext.entryMode,
        forcedSponsorId: entryContext.forcedSponsorId,
        browserPixelsEnabled: entryContext.browserPixelsEnabled,
      },
      publication: {
        id: publication.id,
        pathPrefix: publication.pathPrefix,
        isPrimary: publication.isPrimary,
        trackingProfileId: publication.trackingProfileId,
        handoffStrategyId: publication.handoffStrategyId,
        metaPixelId: readNullableString(publication, 'metaPixelId'),
        tiktokPixelId: readNullableString(publication, 'tiktokPixelId'),
      },
      theme,
      funnel: {
        id: publication.funnelInstance.id,
        name: publication.funnelInstance.name,
        code: publication.funnelInstance.code,
        status: publication.funnelInstance.status,
        settingsJson: publication.funnelInstance.settingsJson,
        mediaMap: publication.funnelInstance.mediaMap,
        template: {
          id: publication.funnelInstance.template.id,
          code: publication.funnelInstance.template.code,
          name: publication.funnelInstance.template.name,
          version: publication.funnelInstance.template.version,
          funnelType: publication.funnelInstance.template.funnelType,
          blocksJson: publication.funnelInstance.template.blocksJson,
          mediaMap: publication.funnelInstance.template.mediaMap,
          settingsJson: publication.funnelInstance.template.settingsJson,
          allowedOverridesJson:
            publication.funnelInstance.template.allowedOverridesJson,
        },
      },
      trackingProfile: effectiveTrackingProfile
        ? {
            id: effectiveTrackingProfile.id,
            name: effectiveTrackingProfile.name,
            provider: effectiveTrackingProfile.provider,
            deduplicationMode: effectiveTrackingProfile.deduplicationMode,
            configJson: effectiveTrackingProfile.configJson,
            conversionEventMappings:
              effectiveTrackingProfile.conversionEventMappings.map(
                (mapping) => ({
                  id: mapping.id,
                  internalEventName: mapping.internalEventName,
                  providerEventName: mapping.providerEventName,
                  isBrowserSide: mapping.isBrowserSide,
                  isServerSide: mapping.isServerSide,
                  isCriticalConversion: mapping.isCriticalConversion,
                }),
              ),
          }
        : null,
      handoffStrategy: effectiveHandoffStrategy
        ? {
            id: effectiveHandoffStrategy.id,
            name: effectiveHandoffStrategy.name,
            type: effectiveHandoffStrategy.type,
            settingsJson: effectiveHandoffStrategy.settingsJson,
          }
        : null,
      handoff,
      currentStep,
      nextStep,
      previousStep,
      steps,
    };
  }

  private toAdjacentStep(
    step: PublicRuntimeStep | undefined,
  ): Pick<PublicRuntimeStep, 'id' | 'slug' | 'path' | 'stepType'> | null {
    if (!step) {
      return null;
    }

    return {
      id: step.id,
      slug: step.slug,
      path: step.path,
      stepType: step.stepType,
    };
  }

  private extractFunnelTheme(settingsJson: Prisma.JsonValue): string | null {
    const settings = asJsonRecord(settingsJson);
    const theme = settings?.theme;

    if (typeof theme !== 'string') {
      return null;
    }

    const normalizedTheme = theme.trim();
    return normalizedTheme || null;
  }
}
