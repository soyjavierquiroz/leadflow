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
  kind: 'prefixed' | 'root';
  sponsorSlug: string;
  runtimePathPrefix: string;
};

type AdvisorRefPathRoute = {
  sponsorSlug: string;
  runtimePathPrefix: string;
  publicationResolutionPath: string;
};

type ResolvedRuntimeEntryContext = PublicRuntimeEntryContext & {
  runtimePathPrefix: string | null;
  referralQueryParam: string | null;
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

const pathSegments = (path: string) =>
  normalizePath(path)
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

const parsePersonalLinkRoute = (path: string): PersonalLinkRoute | null => {
  const segments = pathSegments(path);

  if (segments[0] !== 'a') {
    const sponsorSlug = normalizePersonalLinkSegment(segments[0]);
    if (!sponsorSlug) {
      return null;
    }

    return {
      kind: 'root',
      sponsorSlug,
      runtimePathPrefix: `/${sponsorSlug}`,
    };
  }

  const sponsorSlug = normalizePersonalLinkSegment(segments[1]);
  if (!sponsorSlug) {
    return null;
  }

  return {
    kind: 'prefixed',
    sponsorSlug,
    runtimePathPrefix: `${PERSONAL_LINK_PATH_PREFIX}/${sponsorSlug}`,
  };
};

const parseAdvisorRefPathRoute = (
  path: string,
): AdvisorRefPathRoute | null => {
  const segments = pathSegments(path);
  const refIndex = segments.findIndex((segment) => segment === 'ref');

  if (refIndex < 0) {
    return null;
  }

  const sponsorSlug = normalizePersonalLinkSegment(segments[refIndex + 1]);
  if (!sponsorSlug) {
    return null;
  }

  const publicationSegments = [
    ...segments.slice(0, refIndex),
    ...segments.slice(refIndex + 2),
  ];
  const runtimePrefixSegments = [
    ...segments.slice(0, refIndex),
    'ref',
    sponsorSlug,
  ];

  return {
    sponsorSlug,
    runtimePathPrefix: `/${runtimePrefixSegments.join('/')}`,
    publicationResolutionPath:
      publicationSegments.length > 0
        ? `/${publicationSegments.join('/')}`
        : '/',
  };
};

const extractQueryParam = (
  value: string | null | undefined,
  key: string,
) => {
  if (!value?.trim()) {
    return null;
  }

  const trimmed = value.trim();

  try {
    return normalizePersonalLinkSegment(new URL(trimmed).searchParams.get(key));
  } catch {
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

    try {
      return normalizePersonalLinkSegment(
        new URL(path, 'https://runtime.local').searchParams.get(key),
      );
    } catch {
      return null;
    }
  }
};

const extractAwid = (value: string | null | undefined) => {
  if (!value?.trim()) {
    return null;
  }

  const trimmed = value.trim();

  try {
    return normalizePersonalLinkSegment(
      new URL(trimmed).searchParams.get('awid'),
    );
  } catch {
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

    try {
      return normalizePersonalLinkSegment(
        new URL(path, 'https://runtime.local').searchParams.get('awid'),
      );
    } catch {
      return null;
    }
  }
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
    const advisorRefPathRoute = parseAdvisorRefPathRoute(path);
    const queryReferralSlug = extractQueryParam(path, 'ref');
    const personalLinkRoute =
      advisorRefPathRoute || queryReferralSlug
        ? null
        : parsePersonalLinkRoute(normalizedPath);
    const publicationResolutionPath =
      advisorRefPathRoute?.publicationResolutionPath ?? normalizedPath;

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

    let preResolvedEntryContext: ResolvedRuntimeEntryContext | null = null;
    const rootPublication = personalLinkRoute
      ? publications.find((publication) => publication.pathPrefix === '/')
      : null;

    if (rootPublication) {
      preResolvedEntryContext = await this.resolveEntryContextForPublication({
        workspaceId: rootPublication.workspaceId,
        teamId: rootPublication.teamId,
        publicationPathPrefix: rootPublication.pathPrefix,
        requestedPath: path,
      });
    }

    const matchingPublication =
      preResolvedEntryContext?.trafficLayer === 'DIRECT'
        ? rootPublication
        : publications
            .filter((publication) => {
              if (personalLinkRoute?.kind === 'prefixed') {
                return publication.pathPrefix === '/';
              }

              return matchesPublicationPath(
                publicationResolutionPath,
                publication.pathPrefix,
              );
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

    const entryContext =
      preResolvedEntryContext?.trafficLayer === 'DIRECT' &&
      matchingPublication.id === rootPublication?.id
        ? preResolvedEntryContext
        : await this.resolveEntryContextForPublication({
            workspaceId: matchingPublication.workspaceId,
            teamId: matchingPublication.teamId,
            publicationPathPrefix: matchingPublication.pathPrefix,
            requestedPath: path,
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
    const advisorRefPathRoute = parseAdvisorRefPathRoute(input.requestedPath);
    const queryReferralSlug = extractQueryParam(input.requestedPath, 'ref');
    const personalLinkRoute =
      advisorRefPathRoute || queryReferralSlug
        ? null
        : parsePersonalLinkRoute(normalizedPath);
    const prismaClient = input.tx ?? this.prisma;
    const pathReferralPrefixMatchesPublication = advisorRefPathRoute
      ? matchesPublicationPath(
          advisorRefPathRoute.publicationResolutionPath,
          input.publicationPathPrefix,
        )
      : false;

    if (advisorRefPathRoute && pathReferralPrefixMatchesPublication) {
      const sponsor = await prismaClient.sponsor.findFirst({
        where: {
          workspaceId: input.workspaceId,
          teamId: input.teamId,
          publicSlug: advisorRefPathRoute.sponsorSlug,
          isActive: true,
          status: 'active',
          availabilityStatus: 'available',
        } as Prisma.SponsorWhereInput,
        select: {
          id: true,
        },
      });

      if (sponsor) {
        return {
          entryMode: 'organic_asesor',
          trafficLayer: 'DIRECT',
          forcedSponsorId: sponsor.id,
          adWheelId: null,
          browserPixelsEnabled: false,
          runtimePathPrefix: advisorRefPathRoute.runtimePathPrefix,
          referralQueryParam: null,
        };
      }

      throw new NotFoundException({
        code: 'PUBLIC_SPONSOR_NOT_FOUND',
        message: `No active public sponsor matched ${normalizedPath}.`,
      });
    }

    if (personalLinkRoute && input.publicationPathPrefix === '/') {
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

      if (sponsor) {
        return {
          entryMode: 'organic_asesor',
          trafficLayer: 'DIRECT',
          forcedSponsorId: sponsor.id,
          adWheelId: null,
          browserPixelsEnabled: false,
          runtimePathPrefix: personalLinkRoute.runtimePathPrefix,
          referralQueryParam: null,
        };
      }

      if (personalLinkRoute.kind === 'prefixed') {
        throw new NotFoundException({
          code: 'PUBLIC_SPONSOR_NOT_FOUND',
          message: `No active public sponsor matched ${normalizedPath}.`,
        });
      }
    }

    if (queryReferralSlug) {
      const sponsor = await prismaClient.sponsor.findFirst({
        where: {
          workspaceId: input.workspaceId,
          teamId: input.teamId,
          publicSlug: queryReferralSlug,
          isActive: true,
          status: 'active',
          availabilityStatus: 'available',
        } as Prisma.SponsorWhereInput,
        select: {
          id: true,
        },
      });

      if (sponsor) {
        return {
          entryMode: 'organic_asesor',
          trafficLayer: 'DIRECT',
          forcedSponsorId: sponsor.id,
          adWheelId: null,
          browserPixelsEnabled: false,
          runtimePathPrefix: null,
          referralQueryParam: queryReferralSlug,
        };
      }
    }

    const requestedAdWheelId = extractAwid(input.requestedPath);
    if (requestedAdWheelId) {
      const now = new Date();
      const adWheel = await prismaClient.adWheel.findFirst({
        where: {
          id: requestedAdWheelId,
          teamId: input.teamId,
          status: 'ACTIVE',
          startDate: {
            lte: now,
          },
          endDate: {
            gte: now,
          },
        },
        select: {
          id: true,
        },
      });

      if (adWheel) {
        return {
          entryMode: 'paid_ads',
          trafficLayer: 'PAID_WHEEL',
          forcedSponsorId: null,
          adWheelId: adWheel.id,
          browserPixelsEnabled: true,
          runtimePathPrefix: null,
          referralQueryParam: null,
        };
      }
    }

    return {
      entryMode: 'paid_ads',
      trafficLayer: 'ORGANIC',
      forcedSponsorId: null,
      adWheelId: null,
      browserPixelsEnabled: true,
      runtimePathPrefix: null,
      referralQueryParam: null,
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
        trafficLayer: 'ORGANIC',
        forcedSponsorId: null,
        adWheelId: null,
        browserPixelsEnabled: true,
        runtimePathPrefix: null,
        referralQueryParam: null,
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
    const decorateStepPath = (stepPath: string) => {
      if (!entryContext.referralQueryParam) {
        return stepPath;
      }

      const separator = stepPath.includes('?') ? '&' : '?';
      return `${stepPath}${separator}ref=${encodeURIComponent(
        entryContext.referralQueryParam,
      )}`;
    };
    const relativeStepPath = resolveRelativeStepPath(
      requestedPath,
      effectivePublicationPathPrefix,
    );

    const steps = publication.funnelInstance.steps.map((step) => ({
      slug: normalizeStepSlug(step.slug),
      id: step.id,
      path: decorateStepPath(
        buildPublicationStepPath(
          effectivePublicationPathPrefix,
          step.slug,
          step.isEntryStep,
        ),
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
        trafficLayer: entryContext.trafficLayer,
        forcedSponsorId: entryContext.forcedSponsorId,
        adWheelId: entryContext.adWheelId,
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
