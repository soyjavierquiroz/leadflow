import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
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
import { IdentityTokenService } from './identity-token.service';
import { LeadCaptureAssignmentService } from './lead-capture-assignment.service';
import {
  buildPublicWhatsappHandoff,
  resolvePublicHandoffConfig,
} from './reveal-handoff.utils';

const publicRuntimeInclude = {
  domain: true,
  team: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
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

type RuntimePublicationRecord = Prisma.FunnelPublicationGetPayload<{
  include: typeof publicRuntimeInclude;
}>;

type PromoPathRoute = {
  campaignSlug: string;
  runtimePathPrefix: string;
  publicationResolutionPath: string;
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

type RuntimeAssignmentPayload = {
  id: string;
  ownershipKey: string | null;
  status: string;
  reason: string;
  assignedAt: string;
  sponsor: {
    id: string;
    displayName: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
  };
} | null;

type RuntimeAdvisorPayload = {
  name: string;
  role: string | null;
  phone: string | null;
  photoUrl: string | null;
  bio: string | null;
  whatsappUrl: string | null;
} | null;

type RuntimeSponsorContext = {
  leadId: string | null;
  assignment: RuntimeAssignmentPayload;
  advisor: RuntimeAdvisorPayload;
  assignedSponsor: NonNullable<RuntimeAssignmentPayload>['sponsor'] | null;
  handoff: {
    sponsor: NonNullable<RuntimeAssignmentPayload>['sponsor'] | null;
    whatsappPhone: string | null;
    whatsappMessage: string | null;
    whatsappUrl: string | null;
  };
} | null;

const asJsonRecord = (value: Prisma.JsonValue | null | undefined) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : null;

const readJsonString = (value: Prisma.JsonValue | null | undefined) =>
  typeof value === 'string' ? value.trim() : '';

const findRuntimeBlockSetting = (
  value: Prisma.JsonValue | null | undefined,
  blockType: string,
  settingKey: string,
): string => {
  const visit = (node: Prisma.JsonValue | null | undefined): string => {
    if (!node) {
      return '';
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (found) {
          return found;
        }
      }
      return '';
    }

    const record = asJsonRecord(node);
    if (!record) {
      return '';
    }

    if (readJsonString(record.type) === blockType) {
      const settings =
        asJsonRecord(record.settings) ?? asJsonRecord(record.settingsJson);
      const settingValue = readJsonString(settings?.[settingKey]);
      if (settingValue) {
        return settingValue;
      }
    }

    for (const child of Object.values(record)) {
      const found = visit(child);
      if (found) {
        return found;
      }
    }

    return '';
  };

  return visit(value);
};

const readNullableString = (
  value: RuntimePublicationRecord,
  key:
    | 'metaPixelId'
    | 'tiktokPixelId'
    | 'seoTitle'
    | 'seoDescription'
    | 'ogImageUrl'
    | 'faviconUrl',
) => {
  const candidate = (value as RuntimePublicationRecord &
    Partial<
      Record<
        | 'metaPixelId'
        | 'tiktokPixelId'
        | 'seoTitle'
        | 'seoDescription'
        | 'ogImageUrl'
        | 'faviconUrl',
        unknown
      >
    >)[key];

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

const slugifyCampaignName = (value: string | null | undefined) =>
  normalizePersonalLinkSegment(
    (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
  );

const parsePromoPathRoute = (path: string): PromoPathRoute | null => {
  const segments = pathSegments(path);

  if (segments[0] !== 'promo') {
    return null;
  }

  const campaignSlug = normalizePersonalLinkSegment(segments[1]);
  if (!campaignSlug) {
    return null;
  }

  const publicationSegments = segments.slice(2);

  return {
    campaignSlug,
    runtimePathPrefix: `/promo/${campaignSlug}`,
    publicationResolutionPath:
      publicationSegments.length > 0
        ? `/${publicationSegments.join('/')}`
        : '/',
  };
};

const parseAdvisorRefPathRoute = (
  path: string,
): AdvisorRefPathRoute | null => {
  const segments = pathSegments(path);

  if (segments[0] !== 'ref') {
    return null;
  }

  const sponsorSlug = normalizePersonalLinkSegment(segments[1]);
  if (!sponsorSlug) {
    return null;
  }

  const publicationSegments = segments.slice(2);

  return {
    sponsorSlug,
    runtimePathPrefix: `/ref/${sponsorSlug}`,
    publicationResolutionPath:
      publicationSegments.length > 0
        ? `/${publicationSegments.join('/')}`
        : '/',
  };
};

const extractRawQueryParam = (
  value: string | null | undefined,
  key: string,
) => {
  if (!value?.trim()) {
    return null;
  }

  const trimmed = value.trim();

  try {
    return new URL(trimmed).searchParams.get(key)?.trim() || null;
  } catch {
    const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

    try {
      return (
        new URL(path, 'https://runtime.local').searchParams.get(key)?.trim() ||
        null
      );
    } catch {
      return null;
    }
  }
};

@Injectable()
export class PublicFunnelRuntimeService {
  private readonly logger = new Logger(PublicFunnelRuntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly identityTokenService: IdentityTokenService,
  ) {}

  async resolveByHostAndPath(
    host: string,
    path: string,
  ): Promise<PublicRuntimePayload> {
    const normalizedHost = normalizeHost(host);
    const normalizedPath = normalizePath(path);
    const promoPathRoute = parsePromoPathRoute(path);
    const advisorRefPathRoute = parseAdvisorRefPathRoute(path);
    const publicationResolutionPath =
      promoPathRoute?.publicationResolutionPath ??
      advisorRefPathRoute?.publicationResolutionPath ??
      normalizedPath;

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

    const promoPublication = promoPathRoute
      ? await this.resolvePromoPublication(publications, promoPathRoute)
      : null;

    const matchingPublication =
      promoPublication ??
      publications
        .filter((publication) =>
          matchesPublicationPath(
            publicationResolutionPath,
            publication.pathPrefix,
          ),
        )
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
      publicationId: matchingPublication.id,
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

  private async resolvePromoPublication(
    publications: RuntimePublicationRecord[],
    promoPathRoute: PromoPathRoute,
  ) {
    const publicationIds = publications.map((publication) => publication.id);
    if (publicationIds.length === 0) {
      return null;
    }

    const now = new Date();
    const candidateWheels = await this.prisma.adWheel.findMany({
      where: {
        publicationId: {
          in: publicationIds,
        },
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
        name: true,
        publicationId: true,
      },
    });
    const wheel = candidateWheels.find(
      (candidate) =>
        normalizePersonalLinkSegment(candidate.id) ===
          promoPathRoute.campaignSlug ||
        slugifyCampaignName(candidate.name) === promoPathRoute.campaignSlug,
    );

    return (
      publications.find(
        (publication) => publication.id === wheel?.publicationId,
      ) ?? null
    );
  }

  async resolveEntryContextForPublication(input: {
    workspaceId: string;
    teamId: string;
    publicationId: string;
    publicationPathPrefix: string;
    requestedPath: string;
    tx?: Prisma.TransactionClient | PrismaService;
  }): Promise<ResolvedRuntimeEntryContext> {
    const normalizedPath = normalizePath(input.requestedPath);
    const promoPathRoute = parsePromoPathRoute(input.requestedPath);
    const advisorRefPathRoute = parseAdvisorRefPathRoute(input.requestedPath);
    const prismaClient = input.tx ?? this.prisma;
    const promoPrefixMatchesPublication = Boolean(promoPathRoute);
    const pathReferralPrefixMatchesPublication = advisorRefPathRoute
      ? matchesPublicationPath(
          advisorRefPathRoute.publicationResolutionPath,
          input.publicationPathPrefix,
        )
      : false;

    if (promoPathRoute && promoPrefixMatchesPublication) {
      const now = new Date();
      const adWheelCandidates = await prismaClient.adWheel.findMany({
        where: {
          teamId: input.teamId,
          publicationId: input.publicationId,
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
          name: true,
        },
      });
      const adWheel = adWheelCandidates.find(
        (candidate) =>
          normalizePersonalLinkSegment(candidate.id) ===
            promoPathRoute.campaignSlug ||
          slugifyCampaignName(candidate.name) === promoPathRoute.campaignSlug,
      );

      if (adWheel) {
        return {
          entryMode: 'paid_ads',
          trafficLayer: 'PAID_WHEEL',
          forcedSponsorId: null,
          adWheelId: adWheel.id,
          browserPixelsEnabled: true,
          attributionType: 'promo',
          attributionSlug: promoPathRoute.campaignSlug,
          runtimePathPrefix: promoPathRoute.runtimePathPrefix,
          referralQueryParam: null,
        };
      }

      throw new NotFoundException({
        code: 'PUBLIC_PROMO_NOT_FOUND',
        message: `No active promo campaign matched ${normalizedPath}.`,
      });
    }

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
          attributionType: 'ref',
          attributionSlug: advisorRefPathRoute.sponsorSlug,
          runtimePathPrefix: advisorRefPathRoute.runtimePathPrefix,
          referralQueryParam: null,
        };
      }

      throw new NotFoundException({
        code: 'PUBLIC_SPONSOR_NOT_FOUND',
        message: `No active public sponsor matched ${normalizedPath}.`,
      });
    }

    return {
      entryMode: 'paid_ads',
      trafficLayer: 'ORGANIC',
      forcedSponsorId: null,
      adWheelId: null,
      browserPixelsEnabled: true,
      attributionType: 'organic',
      attributionSlug: null,
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
        attributionType: 'organic',
        attributionSlug: null,
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

  private async buildRuntimePayload(
    publication: RuntimePublicationRecord,
    requestedHost: string,
    requestedPath: string,
    entryContext: ResolvedRuntimeEntryContext,
  ): Promise<PublicRuntimePayload> {
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
    const baseHandoff = resolvePublicHandoffConfig(effectiveHandoffStrategy);
    const handoffWhatsappText = findRuntimeBlockSetting(
      currentStep.blocksJson as Prisma.JsonValue,
      'whatsapp_handoff_cta',
      'whatsappText',
    );
    const handoff = {
      ...baseHandoff,
      messageTemplate: handoffWhatsappText || baseHandoff.messageTemplate,
    };
    const runtimeSponsorContext = await this.resolveRuntimeSponsorContext({
      publication,
      requestedHost,
      requestedPath,
      currentStepPath: currentStep.path,
      handoff,
    });
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
      team: {
        id: publication.team.id,
        name: publication.team.name,
        description: publication.team.description,
      },
      entryContext: {
        entryMode: entryContext.entryMode,
        trafficLayer: entryContext.trafficLayer,
        forcedSponsorId: entryContext.forcedSponsorId,
        adWheelId: entryContext.adWheelId,
        browserPixelsEnabled: entryContext.browserPixelsEnabled,
        attributionType: entryContext.attributionType,
        attributionSlug: entryContext.attributionSlug,
        runtimePathPrefix: entryContext.runtimePathPrefix,
        referralQueryParam: null,
      },
      publication: {
        id: publication.id,
        pathPrefix: publication.pathPrefix,
        isPrimary: publication.isPrimary,
        trackingProfileId: publication.trackingProfileId,
        handoffStrategyId: publication.handoffStrategyId,
        metaPixelId: readNullableString(publication, 'metaPixelId'),
        tiktokPixelId: readNullableString(publication, 'tiktokPixelId'),
        seoTitle: readNullableString(publication, 'seoTitle'),
        seoDescription: readNullableString(publication, 'seoDescription'),
        ogImageUrl: readNullableString(publication, 'ogImageUrl'),
        faviconUrl: readNullableString(publication, 'faviconUrl'),
        nextStepPath: nextStep?.path ?? null,
        manifestVersion: publication.manifestVersion,
        runtimeHealthStatus: publication.runtimeHealthStatus,
      },
      theme,
      funnel: {
        id: publication.funnelInstance.id,
        name: publication.funnelInstance.name,
        code: publication.funnelInstance.code,
        status: publication.funnelInstance.status,
        structuralType: publication.funnelInstance.structuralType,
        conversionContract: publication.funnelInstance.conversionContract,
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
      handoff: {
        ...handoff,
        sponsor: runtimeSponsorContext?.handoff.sponsor ?? null,
        whatsappPhone: runtimeSponsorContext?.handoff.whatsappPhone ?? null,
        whatsappMessage: runtimeSponsorContext?.handoff.whatsappMessage ?? null,
        whatsappUrl: runtimeSponsorContext?.handoff.whatsappUrl ?? null,
      },
      leadId: runtimeSponsorContext?.leadId ?? null,
      assignment: runtimeSponsorContext?.assignment ?? null,
      advisor: runtimeSponsorContext?.advisor ?? null,
      assignedSponsor: runtimeSponsorContext?.assignedSponsor ?? null,
      currentStep,
      nextStep,
      previousStep,
      steps,
    } as PublicRuntimePayload;
  }

  private async resolveRuntimeSponsorContext(input: {
    publication: RuntimePublicationRecord;
    requestedHost: string;
    requestedPath: string;
    currentStepPath: string;
    handoff: ReturnType<typeof resolvePublicHandoffConfig>;
  }): Promise<RuntimeSponsorContext> {
    const trackedLeadContext = await this.resolveTrackedLeadContext(input);
    if (trackedLeadContext) {
      return trackedLeadContext;
    }

    const entryContextLead = await this.resolveEntryContextAssignmentContext({
      publication: input.publication,
      entryContext: input.publication
        ? await this.resolveEntryContextForPublication({
            workspaceId: input.publication.workspaceId,
            teamId: input.publication.teamId,
            publicationId: input.publication.id,
            publicationPathPrefix: input.publication.pathPrefix,
            requestedPath: input.requestedPath,
          })
        : null,
      currentStepPath: input.currentStepPath,
      handoff: input.handoff,
    });

    if (entryContextLead) {
      return entryContextLead;
    }

    throw new ConflictException({
      code: 'ASSIGNED_SPONSOR_REQUIRED',
      message: `No assigned sponsor could be resolved for publication ${input.publication.id}.`,
    });
  }

  private async resolveTrackedLeadContext(input: {
    publication: RuntimePublicationRecord;
    requestedPath: string;
    currentStepPath: string;
    handoff: ReturnType<typeof resolvePublicHandoffConfig>;
  }): Promise<RuntimeSponsorContext> {
    const ctxToken = extractRawQueryParam(input.requestedPath, 'ctx');
    if (!ctxToken) {
      return null;
    }

    try {
      const token = this.identityTokenService.verifyToken(ctxToken);
      if (token.publicationId !== input.publication.id) {
        return null;
      }

      const lead = await this.prisma.lead.findUnique({
        where: {
          id: token.leadId,
        },
        include: {
          currentAssignment: {
            include: {
              sponsor: true,
            },
          },
        },
      });

      if (!lead?.currentAssignment?.sponsor) {
        throw new ConflictException({
          code: 'LEAD_ASSIGNMENT_REQUIRED',
          message: `Lead ${token.leadId} does not have an active assignment.`,
        });
      }

      return this.buildRuntimeSponsorContextFromAssignment({
        leadId: lead.id,
        leadName: lead.fullName,
        leadEmail: lead.email,
        leadPhone: lead.phone,
        sponsor: lead.currentAssignment.sponsor,
        advisor: {
          id: lead.currentAssignment.sponsor.id,
          sponsorId: lead.currentAssignment.sponsor.id,
          name: lead.currentAssignment.sponsor.displayName,
          role: 'Asesor',
          bio: 'Asesor',
          phone: lead.currentAssignment.sponsor.phone,
          photoUrl: lead.currentAssignment.sponsor.avatarUrl,
        },
        assignment: {
          id: lead.currentAssignment.id,
          ownershipKey: lead.currentAssignment.ownershipKey,
          status: lead.currentAssignment.status,
          reason: lead.currentAssignment.reason,
          assignedAt: lead.currentAssignment.assignedAt,
        },
        publicationName: input.publication.funnelInstance.name,
        publicationPath: input.currentStepPath,
        handoff: input.handoff,
      });
    } catch (error) {
      this.logger.warn(
        `Runtime ctx hydration failed for publication ${input.publication.id}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    }
  }

  private async resolveEntryContextAssignmentContext(input: {
    publication: RuntimePublicationRecord;
    entryContext: ResolvedRuntimeEntryContext | null;
    currentStepPath: string;
    handoff: ReturnType<typeof resolvePublicHandoffConfig>;
  }): Promise<RuntimeSponsorContext | null> {
    if (!input.entryContext) {
      return null;
    }

    const engine = this.getAssignmentEngineBridge();
    const tx = this.prisma;
    const publication = input.publication as any;

    if (input.entryContext.forcedSponsorId) {
      const sponsor = await (engine as any).resolveForcedSponsorOrThrow(
        tx,
        publication,
        input.entryContext.forcedSponsorId,
      );
      const advisor =
        (await (engine as any).resolveAssignedAdvisorBySponsorId(
          tx,
          publication,
          sponsor.id,
        )) ?? (engine as any).toPublicAssignedAdvisorFromSponsor(sponsor);

      return this.buildRuntimeSponsorContextFromAssignment({
        leadId: null,
        leadName: null,
        leadEmail: null,
        leadPhone: null,
        sponsor,
        advisor,
        assignment: {
          id: `runtime-forced-${sponsor.id}`,
          ownershipKey: null,
          status: 'assigned',
          reason: 'manual',
          assignedAt: new Date(),
        },
        publicationName: input.publication.funnelInstance.name,
        publicationPath: input.currentStepPath,
        handoff: input.handoff,
      });
    }

    if (
      input.entryContext.trafficLayer === 'PAID_WHEEL' &&
      input.entryContext.adWheelId
    ) {
      try {
        const sponsor = await this.resolveActivePaidWheelSponsorOrThrow({
          publication: input.publication,
          adWheelId: input.entryContext.adWheelId,
        });
        const advisor =
          (await (engine as any).resolveAssignedAdvisorBySponsorId(
            tx,
            publication,
            sponsor.id,
          )) ?? (engine as any).toPublicAssignedAdvisorFromSponsor(sponsor);

        return this.buildRuntimeSponsorContextFromAssignment({
          leadId: null,
          leadName: null,
          leadEmail: null,
          leadPhone: null,
          sponsor,
          advisor,
          assignment: {
            id: `runtime-wheel-${sponsor.id}`,
            ownershipKey: null,
            status: 'assigned',
            reason: 'rotation',
            assignedAt: new Date(),
          },
          publicationName: input.publication.funnelInstance.name,
          publicationPath: input.currentStepPath,
          handoff: input.handoff,
        });
      } catch (error) {
        this.logger.warn(
          `Paid wheel runtime resolution fallback triggered for publication ${input.publication.id}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    }

    const directAdvisor = await this.resolveDirectRuntimeAdvisorOrThrow(
      input.publication,
    );
    const sponsor = directAdvisor.sponsor;

    if (!sponsor) {
      throw new ConflictException({
        code: 'ADVISOR_SPONSOR_REQUIRED',
        message: `Resolved advisor ${directAdvisor.id} does not have an active sponsor.`,
      });
    }

    return this.buildRuntimeSponsorContextFromAssignment({
      leadId: null,
      leadName: null,
      leadEmail: null,
      leadPhone: null,
      sponsor,
      advisor: {
        id: directAdvisor.id,
        sponsorId: sponsor.id,
        name: sponsor.displayName ?? directAdvisor.fullName,
        role: directAdvisor.role === 'TEAM_ADMIN' ? 'Propietario del equipo' : 'Asesor',
        bio: directAdvisor.role === 'TEAM_ADMIN' ? 'Propietario del equipo' : 'Asesor',
        phone: sponsor.phone ?? null,
        photoUrl: sponsor.avatarUrl ?? null,
      },
      assignment: {
        id: `runtime-direct-${sponsor.id}`,
        ownershipKey: null,
        status: 'assigned',
        reason: directAdvisor.role === 'TEAM_ADMIN' ? 'fallback' : 'rotation',
        assignedAt: new Date(),
      },
      publicationName: input.publication.funnelInstance.name,
      publicationPath: input.currentStepPath,
      handoff: input.handoff,
    });
  }

  private buildRuntimeSponsorContextFromAssignment(input: {
    leadId: string | null;
    leadName: string | null;
    leadEmail: string | null;
    leadPhone: string | null;
    sponsor: {
      id: string;
      displayName: string;
      email: string | null;
      phone: string | null;
      avatarUrl: string | null;
    };
    advisor: {
      id: string;
      sponsorId: string;
      name: string;
      role: string;
      bio: string;
      phone: string | null;
      photoUrl: string | null;
    };
    assignment: {
      id: string;
      ownershipKey: string | null;
      status: string;
      reason: string;
      assignedAt: Date;
    };
    publicationName: string;
    publicationPath: string;
    handoff: ReturnType<typeof resolvePublicHandoffConfig>;
  }): RuntimeSponsorContext {
    const sponsor = {
      id: input.sponsor.id,
      displayName: input.sponsor.displayName,
      email: input.sponsor.email,
      phone: input.sponsor.phone,
      avatarUrl: input.sponsor.avatarUrl,
    };
    const whatsappHandoff = buildPublicWhatsappHandoff({
      handoff: input.handoff,
      sponsor: input.sponsor,
      leadName: input.leadName,
      leadEmail: input.leadEmail,
      leadPhone: input.leadPhone,
      funnelName: input.publicationName,
      publicationPath: input.publicationPath,
      ownershipKey: input.assignment.ownershipKey,
    });

    return {
      leadId: input.leadId,
      assignment: {
        id: input.assignment.id,
        ownershipKey: input.assignment.ownershipKey,
        status: input.assignment.status,
        reason: input.assignment.reason,
        assignedAt: input.assignment.assignedAt.toISOString(),
        sponsor,
      },
      advisor: {
        name: input.advisor.name,
        role: input.advisor.role,
        phone: input.advisor.phone,
        photoUrl: input.advisor.photoUrl,
        bio: input.advisor.bio,
        whatsappUrl: whatsappHandoff.whatsappUrl,
      },
      assignedSponsor: sponsor,
      handoff: {
        sponsor,
        whatsappPhone: whatsappHandoff.whatsappPhone,
        whatsappMessage: whatsappHandoff.whatsappMessage,
        whatsappUrl: whatsappHandoff.whatsappUrl,
      },
    };
  }

  private getAssignmentEngineBridge() {
    return Object.create(LeadCaptureAssignmentService.prototype) as any;
  }

  private async resolveDirectRuntimeAdvisorOrThrow(
    publication: RuntimePublicationRecord,
  ) {
    const engine = this.getAssignmentEngineBridge();
    return (engine as any).resolveFallbackTeamAdminOrThrow(
      this.prisma,
      publication,
    );
  }

  private async resolveActivePaidWheelSponsorOrThrow(input: {
    publication: RuntimePublicationRecord;
    adWheelId: string;
  }) {
    const now = new Date();
    const [wheel] = await this.prisma.$queryRaw<
      Array<{
        currentTurnPosition: number;
        sequenceVersion: number;
      }>
    >(Prisma.sql`
      SELECT
        aw."currentTurnPosition",
        aw."sequenceVersion"
      FROM "AdWheel" aw
      WHERE aw.id = ${input.adWheelId}
        AND aw."teamId" = ${input.publication.teamId}
        AND (aw."publicationId" = ${input.publication.id} OR aw."publicationId" IS NULL)
        AND aw.status = 'ACTIVE'
        AND aw."startDate" <= ${now}
        AND aw."endDate" >= ${now}
      LIMIT 1
    `);

    if (!wheel) {
      throw new ConflictException({
        code: 'NO_ACTIVE_AD_WHEEL',
        message: `Ad wheel ${input.adWheelId} is not active for publication ${input.publication.id}.`,
      });
    }

    const totalTurns = await this.prisma.adWheelTurn.count({
      where: {
        adWheelId: input.adWheelId,
        sequenceVersion: wheel.sequenceVersion,
      },
    });

    if (totalTurns === 0) {
      throw new ConflictException({
        code: 'NO_ACTIVE_AD_WHEEL_TURNS',
        message: `Ad wheel ${input.adWheelId} does not have turns available for publication ${input.publication.id}.`,
      });
    }

    const currentPosition =
      ((Math.max(1, wheel.currentTurnPosition) - 1) % totalTurns) + 1;
    const [turn] = await this.prisma.$queryRaw<
      Array<{
        sponsorId: string;
        displayName: string;
        email: string | null;
        phone: string | null;
        avatarUrl: string | null;
      }>
    >(Prisma.sql`
      SELECT
        awt."sponsorId",
        s."displayName",
        s.email,
        s.phone,
        s."avatarUrl"
      FROM "AdWheelTurn" awt
      INNER JOIN "Sponsor" s
        ON s.id = awt."sponsorId"
      INNER JOIN "AdWheelParticipant" awp
        ON awp."adWheelId" = awt."adWheelId"
       AND awp."sponsorId" = awt."sponsorId"
      WHERE awt."adWheelId" = ${input.adWheelId}
        AND awt."sequenceVersion" = ${wheel.sequenceVersion}
        AND s."isActive" = true
        AND s.status = 'active'
        AND s."availabilityStatus" = 'available'
        AND awp."seatCount" > 0
      ORDER BY
        CASE WHEN awt.position >= ${currentPosition} THEN 0 ELSE 1 END,
        awt.position ASC
      LIMIT 1
    `);

    if (!turn) {
      throw new ConflictException({
        code: 'NO_ELIGIBLE_AD_WHEEL_SPONSOR',
        message: `Ad wheel ${input.adWheelId} could not resolve an eligible sponsor for publication ${input.publication.id}.`,
      });
    }

    return {
      id: turn.sponsorId,
      displayName: turn.displayName,
      email: turn.email,
      phone: turn.phone,
      avatarUrl: turn.avatarUrl,
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
