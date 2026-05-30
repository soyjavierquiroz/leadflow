import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPublicationStepPath, normalizePath } from './public-funnel-runtime.utils';
import {
  buildPublicWhatsappHandoff,
  resolveAssignedWhatsappMessageTemplate,
  resolvePublicHandoffConfig,
} from './reveal-handoff.utils';
import { IdentityTokenService } from './identity-token.service';
import { ShortLinkProvider } from './short-link.provider';

type JsonValue = Prisma.JsonValue;

const TRACKED_LINK_APP_KEY = 'leadflow';
const TRACKED_LINK_ACTION = 'open_vsl';
const TRACKED_LINK_PURPOSE = 'vsl_followup';
const TRACKED_LINK_CREATED_BY = 'n8n';
const TRACKED_LINK_UNAVAILABLE_RESPONSE = {
  code: 'TRACKED_LINK_UNAVAILABLE',
  message: 'This tracked link is no longer available.',
};

const asRecord = (value: JsonValue | null | undefined) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : null;

const asString = (value: JsonValue | null | undefined) =>
  typeof value === 'string' ? value.trim() : '';

const isConversionStructuralType = (value: string | null | undefined) =>
  value === 'two_step_conversion' || value === 'multi_step_conversion';

@Injectable()
export class PublicIdentityLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly identityTokenService: IdentityTokenService,
    private readonly shortLinkProvider: ShortLinkProvider,
  ) {}

  async generateTrackedLink(input: { leadId: string; stepKey: string }) {
    const lead = await this.prisma.lead.findUnique({
      where: {
        id: input.leadId,
      },
      include: {
        visitor: true,
        currentAssignment: {
          include: {
            sponsor: true,
          },
        },
        funnelPublication: {
          include: {
            domain: true,
            team: true,
            handoffStrategy: true,
            funnelInstance: {
              include: {
                handoffStrategy: true,
                steps: {
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!lead?.funnelPublication) {
      throw new NotFoundException({
        code: 'TRACKED_LINK_LEAD_NOT_FOUND',
        message: `Lead ${input.leadId} is not linked to a published funnel.`,
      });
    }

    const publication = lead.funnelPublication;
    const steps = publication.funnelInstance.steps;
    const targetStep = this.resolveTargetStep(steps, input.stepKey);

    if (!targetStep) {
      throw new NotFoundException({
        code: 'TRACKED_LINK_STEP_NOT_FOUND',
        message: `No published step matched stepKey "${input.stepKey}".`,
      });
    }

    const targetStepPath = buildPublicationStepPath(
      publication.pathPrefix,
      targetStep.slug,
      targetStep.isEntryStep,
    );
    const now = new Date();
    const assignmentId = lead.currentAssignment?.id ?? null;
    await this.expireActiveTrackedLinks({
      now,
      leadId: lead.id,
      assignmentId,
      funnelStepId: targetStep.id,
      purpose: TRACKED_LINK_PURPOSE,
    });
    const existingTrackedLink = await this.findActiveTrackedLink({
      now,
      leadId: lead.id,
      assignmentId,
      funnelStepId: targetStep.id,
      purpose: TRACKED_LINK_PURPOSE,
    });
    const handoffStrategy =
      publication.handoffStrategy ?? publication.funnelInstance.handoffStrategy;
    const handoffConfig = resolvePublicHandoffConfig(handoffStrategy);
    const customMessageTemplate = resolveAssignedWhatsappMessageTemplate(
      targetStep.blocksJson,
    );
    const sponsor = lead.currentAssignment?.sponsor ?? null;
    const whatsappHandoff = buildPublicWhatsappHandoff({
      handoff: handoffConfig,
      customMessageTemplate,
      sponsor,
      leadName: lead.fullName ?? null,
      leadEmail: lead.email ?? null,
      leadPhone: lead.phone ?? null,
      funnelName: publication.funnelInstance.name,
      teamName: publication.team.name,
      publicationPath: targetStepPath,
      ownershipKey: lead.currentAssignment?.ownershipKey,
    });
    const targetStepResponse = {
      id: targetStep.id,
      slug: targetStep.slug,
      path: targetStepPath,
      stepType: targetStep.stepType,
    };

    if (existingTrackedLink) {
      return {
        leadId: lead.id,
        publicationId: publication.id,
        stepKey: input.stepKey,
        targetStep: targetStepResponse,
        token: null,
        longUrl: existingTrackedLink.longUrl,
        shortUrl: existingTrackedLink.shortUrl,
        url: existingTrackedLink.shortUrl ?? existingTrackedLink.longUrl,
        shortened: Boolean(existingTrackedLink.shortUrl),
        shortLinkProvider: existingTrackedLink.shortLinkProvider,
        whatsappUrl: whatsappHandoff.whatsappUrl,
        cached: true,
        trackedLinkId: existingTrackedLink.id,
        shortCode: existingTrackedLink.shortCode,
      };
    }

    const token = this.identityTokenService.issueToken({
      leadId: lead.id,
      publicationId: publication.id,
      targetStepPath,
    });
    const ctxTokenHash = this.identityTokenService.hashToken(token);
    const expiresAt = this.identityTokenService.getDefaultExpiresAt();
    const publicBaseUrl = this.buildPublicBaseUrl(
      publication.domain.canonicalHost ?? publication.domain.host,
    );
    const longUrl = new URL(targetStepPath, publicBaseUrl);
    longUrl.searchParams.set('ctx', token);

    const shortened = await this.shortLinkProvider.shortenUrl(longUrl.toString());
    const shortCode = this.shortLinkProvider.extractShortCode(
      shortened.shortUrl,
    );
    const trackedLink = await this.createTrackedLinkOrReuseExisting({
      now,
      lead,
      publication,
      targetStep,
      assignmentId,
      targetStepPath,
      ctxTokenHash,
      expiresAt,
      longUrl: longUrl.toString(),
      shortened,
      shortCode,
    });

    if (trackedLink.cached) {
      return {
        leadId: lead.id,
        publicationId: publication.id,
        stepKey: input.stepKey,
        targetStep: targetStepResponse,
        token: null,
        longUrl: trackedLink.record.longUrl,
        shortUrl: trackedLink.record.shortUrl,
        url: trackedLink.record.shortUrl ?? trackedLink.record.longUrl,
        shortened: Boolean(trackedLink.record.shortUrl),
        shortLinkProvider: trackedLink.record.shortLinkProvider,
        whatsappUrl: whatsappHandoff.whatsappUrl,
        cached: true,
        trackedLinkId: trackedLink.record.id,
        shortCode: trackedLink.record.shortCode,
      };
    }

    return {
      leadId: lead.id,
      publicationId: publication.id,
      stepKey: input.stepKey,
      targetStep: targetStepResponse,
      token,
      longUrl: longUrl.toString(),
      shortUrl: shortened.shortUrl,
      url: shortened.resolvedUrl,
      shortened: shortened.shortened,
      shortLinkProvider: shortened.provider,
      whatsappUrl: whatsappHandoff.whatsappUrl,
      cached: false,
      trackedLinkId: trackedLink.record.id,
      shortCode,
    };
  }

  async hydrateIdentityContext(ctx: string) {
    if (!ctx.trim()) {
      throw new BadRequestException({
        code: 'IDENTITY_CONTEXT_REQUIRED',
        message: 'The ctx token is required.',
      });
    }

    const normalizedCtx = ctx.trim();
    const payload = this.identityTokenService.verifyToken(normalizedCtx);
    await this.validateTrackedLinkForHydration(normalizedCtx);
    const lead = await this.prisma.lead.findUnique({
      where: {
        id: payload.leadId,
      },
      include: {
        visitor: true,
        currentAssignment: {
          include: {
            sponsor: true,
          },
        },
        funnelPublication: {
          include: {
            domain: true,
            team: true,
            handoffStrategy: true,
            funnelInstance: {
              include: {
                handoffStrategy: true,
                steps: {
                  orderBy: { position: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!lead?.funnelPublication) {
      throw new NotFoundException({
        code: 'IDENTITY_CONTEXT_LEAD_NOT_FOUND',
        message: 'The requested lead could not be rehydrated.',
      });
    }

    if (lead.funnelPublication.id !== payload.publicationId) {
      throw new UnauthorizedException({
        code: 'IDENTITY_CONTEXT_PUBLICATION_MISMATCH',
        message: 'The identity token does not match the current publication.',
      });
    }

    const normalizedTargetPath = normalizePath(payload.targetStepPath);
    const handoffStrategy =
      lead.funnelPublication.handoffStrategy ??
      lead.funnelPublication.funnelInstance.handoffStrategy;
    const handoffConfig = resolvePublicHandoffConfig(handoffStrategy);
    const targetStep = this.resolveTargetStepByPath({
      path: normalizedTargetPath,
      pathPrefix: lead.funnelPublication.pathPrefix,
      steps: lead.funnelPublication.funnelInstance.steps,
    });
    const customMessageTemplate = resolveAssignedWhatsappMessageTemplate(
      targetStep?.blocksJson,
    );
    const sponsor = lead.currentAssignment?.sponsor ?? null;
    const whatsappHandoff = buildPublicWhatsappHandoff({
      handoff: handoffConfig,
      customMessageTemplate,
      sponsor,
      leadName: lead.fullName ?? null,
      leadEmail: lead.email ?? null,
      leadPhone: lead.phone ?? null,
      funnelName: lead.funnelPublication.funnelInstance.name,
      teamName: lead.funnelPublication.team.name,
      publicationPath: normalizedTargetPath,
      ownershipKey: lead.currentAssignment?.ownershipKey,
    });

    return {
      publicationId: lead.funnelPublication.id,
      targetStepPath: normalizedTargetPath,
      structuralType: lead.funnelPublication.funnelInstance.structuralType,
      submissionContext: {
        publicationId: lead.funnelPublication.id,
        visitorId: lead.visitor?.id ?? null,
        anonymousId: lead.visitor?.anonymousId ?? null,
        leadId: lead.id,
        leadSnapshot: {
          id: lead.id,
          fullName: lead.fullName,
          email: lead.email,
          phone: lead.phone,
          companyName: lead.companyName,
          status: lead.status,
        },
        assignment: lead.currentAssignment
          ? {
              id: lead.currentAssignment.id,
              ownershipKey: lead.currentAssignment.ownershipKey,
              status: lead.currentAssignment.status,
              reason: lead.currentAssignment.reason,
              assignedAt: lead.currentAssignment.assignedAt.toISOString(),
              sponsor: {
                id: lead.currentAssignment.sponsor.id,
                displayName: lead.currentAssignment.sponsor.displayName,
                email: lead.currentAssignment.sponsor.email,
                phone: lead.currentAssignment.sponsor.phone,
                avatarUrl: lead.currentAssignment.sponsor.avatarUrl,
              },
            }
          : null,
        nextStep: null,
        handoff: {
          mode: handoffConfig.mode,
          channel: handoffConfig.channel,
          buttonLabel: handoffConfig.buttonLabel,
          autoRedirect: handoffConfig.autoRedirect,
          autoRedirectDelayMs: handoffConfig.autoRedirectDelayMs,
          sponsor: lead.currentAssignment
            ? {
                id: lead.currentAssignment.sponsor.id,
                displayName: lead.currentAssignment.sponsor.displayName,
                email: lead.currentAssignment.sponsor.email,
                phone: lead.currentAssignment.sponsor.phone,
                avatarUrl: lead.currentAssignment.sponsor.avatarUrl,
              }
            : null,
          whatsappPhone: whatsappHandoff.whatsappPhone,
          whatsappMessage: whatsappHandoff.whatsappMessage,
          whatsappUrl: whatsappHandoff.whatsappUrl,
        },
        advisor: lead.currentAssignment
          ? {
              name: lead.currentAssignment.sponsor.displayName,
              role: isConversionStructuralType(
                lead.funnelPublication.funnelInstance.structuralType,
              )
                ? 'Advisor'
                : null,
              phone: whatsappHandoff.whatsappPhone,
              photoUrl: lead.currentAssignment.sponsor.avatarUrl,
              bio: null,
              whatsappUrl: whatsappHandoff.whatsappUrl,
            }
          : null,
        capturedAt: lead.updatedAt.toISOString(),
      },
    };
  }

  async revokeTrackedLinksForLead(leadId: string, reason?: string) {
    const trackedLinks = await this.prisma.trackedLink.findMany({
      where: {
        leadId,
        status: 'active',
      },
      select: {
        id: true,
        metadataJson: true,
      },
    });

    if (trackedLinks.length === 0) {
      return {
        revoked: 0,
      };
    }

    const revokedAt = new Date().toISOString();
    const revokedReason = reason?.trim() || null;
    const updates = trackedLinks.map((trackedLink) =>
      this.prisma.trackedLink.update({
        where: {
          id: trackedLink.id,
        },
        data: {
          status: 'revoked',
          metadataJson: this.buildRevokedTrackedLinkMetadata(
            trackedLink.metadataJson,
            revokedAt,
            revokedReason,
          ),
        },
      }),
    );

    await this.prisma.$transaction(updates);

    return {
      revoked: trackedLinks.length,
    };
  }

  private buildRevokedTrackedLinkMetadata(
    metadataJson: JsonValue | null | undefined,
    revokedAt: string,
    revokedReason: string | null,
  ): Prisma.InputJsonValue {
    const metadata = asRecord(metadataJson);
    if (metadata) {
      return {
        ...metadata,
        revokedAt,
        revokedReason,
      };
    }

    if (metadataJson === null || metadataJson === undefined) {
      return {
        revokedAt,
        revokedReason,
      };
    }

    return {
      previousMetadata: metadataJson,
      revokedAt,
      revokedReason,
    };
  }

  private async validateTrackedLinkForHydration(ctx: string) {
    const now = new Date();
    const ctxTokenHash = this.identityTokenService.hashToken(ctx);
    const trackedLink = await this.prisma.trackedLink.findUnique({
      where: {
        ctxTokenHash,
      },
      select: {
        id: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!trackedLink) {
      return;
    }

    if (trackedLink.status !== 'active') {
      this.throwTrackedLinkUnavailable();
    }

    if (trackedLink.expiresAt && trackedLink.expiresAt < now) {
      await this.prisma.trackedLink.update({
        where: {
          id: trackedLink.id,
        },
        data: {
          status: 'expired',
        },
      });
      this.throwTrackedLinkUnavailable();
    }

    await this.prisma.trackedLink.update({
      where: {
        id: trackedLink.id,
      },
      data: {
        clickCount: {
          increment: 1,
        },
        lastClickedAt: now,
      },
    });
  }

  private throwTrackedLinkUnavailable(): never {
    throw new HttpException(
      TRACKED_LINK_UNAVAILABLE_RESPONSE,
      HttpStatus.GONE,
    );
  }

  private async expireActiveTrackedLinks(input: {
    now: Date;
    leadId: string;
    assignmentId: string | null;
    funnelStepId: string;
    purpose: string;
  }) {
    await this.prisma.trackedLink.updateMany({
      where: {
        leadId: input.leadId,
        assignmentId: input.assignmentId,
        funnelStepId: input.funnelStepId,
        purpose: input.purpose,
        status: 'active',
        expiresAt: {
          lt: input.now,
        },
      },
      data: {
        status: 'expired',
      },
    });
  }

  private findActiveTrackedLink(input: {
    now: Date;
    leadId: string;
    assignmentId: string | null;
    funnelStepId: string;
    purpose: string;
  }) {
    return this.prisma.trackedLink.findFirst({
      where: {
        leadId: input.leadId,
        assignmentId: input.assignmentId,
        funnelStepId: input.funnelStepId,
        purpose: input.purpose,
        status: 'active',
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: input.now,
            },
          },
        ],
      },
      select: {
        id: true,
        longUrl: true,
        shortUrl: true,
        shortCode: true,
        shortLinkProvider: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private async createTrackedLinkOrReuseExisting(input: {
    now: Date;
    lead: {
      id: string;
      workspaceId: string;
      currentAssignment?: {
        ownershipKey?: string | null;
      } | null;
    };
    publication: {
      id: string;
      funnelInstanceId: string;
      domain: {
        host: string;
        canonicalHost?: string | null;
      };
    };
    targetStep: {
      id: string;
      slug: string;
    };
    assignmentId: string | null;
    targetStepPath: string;
    ctxTokenHash: string;
    expiresAt: Date | null;
    longUrl: string;
    shortened: {
      shortUrl: string | null;
      provider: string;
    };
    shortCode: string | null;
  }) {
    try {
      const record = await this.prisma.trackedLink.create({
        data: {
          workspaceId: input.lead.workspaceId,
          leadId: input.lead.id,
          assignmentId: input.assignmentId,
          ownershipKey: input.lead.currentAssignment?.ownershipKey ?? null,
          funnelPublicationId: input.publication.id,
          funnelInstanceId: input.publication.funnelInstanceId,
          funnelStepId: input.targetStep.id,
          stepKey: input.targetStep.slug,
          appKey: TRACKED_LINK_APP_KEY,
          action: TRACKED_LINK_ACTION,
          purpose: TRACKED_LINK_PURPOSE,
          longUrl: input.longUrl,
          shortUrl: input.shortened.shortUrl,
          shortCode: input.shortCode,
          shortLinkProvider: input.shortened.provider,
          ctxTokenHash: input.ctxTokenHash,
          status: 'active',
          expiresAt: input.expiresAt,
          createdBy: TRACKED_LINK_CREATED_BY,
          metadataJson: {
            targetStepPath: input.targetStepPath,
            targetStepSlug: input.targetStep.slug,
            host:
              input.publication.domain.canonicalHost ??
              input.publication.domain.host,
            generatedBy: 'generate-tracked-link',
          },
        },
        select: {
          id: true,
          longUrl: true,
          shortUrl: true,
          shortCode: true,
          shortLinkProvider: true,
        },
      });

      return {
        cached: false,
        record,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const record = await this.findActiveTrackedLink({
          now: input.now,
          leadId: input.lead.id,
          assignmentId: input.assignmentId,
          funnelStepId: input.targetStep.id,
          purpose: TRACKED_LINK_PURPOSE,
        });

        if (record) {
          return {
            cached: true,
            record,
          };
        }
      }

      throw error;
    }
  }

  private resolveTargetStep(
    steps: Array<{
      id: string;
      slug: string;
      stepType: string;
      isEntryStep: boolean;
      settingsJson: JsonValue;
      blocksJson: JsonValue;
    }>,
    stepKey: string,
  ) {
    const normalizedStepKey = stepKey.trim().toLowerCase();
    if (!normalizedStepKey) {
      return null;
    }

    const directMatch =
      steps.find((step) => step.id === stepKey) ??
      steps.find((step) => step.slug.toLowerCase() === normalizedStepKey) ??
      steps.find((step) => step.stepType.toLowerCase() === normalizedStepKey);

    if (directMatch) {
      return directMatch;
    }

    return (
      steps.find((step) => {
        const settings = asRecord(step.settingsJson);
        const aliases = settings?.stepKeyAliases;
        return (
          Array.isArray(aliases) &&
          aliases.some(
            (alias) =>
              typeof alias === 'string' &&
              alias.trim().toLowerCase() === normalizedStepKey,
          )
        );
      }) ?? null
    );
  }

  private buildPublicBaseUrl(host: string) {
    return `https://${host.trim().toLowerCase()}`;
  }

  private resolveTargetStepByPath(input: {
    path: string;
    pathPrefix: string;
    steps: Array<{
      slug: string;
      isEntryStep: boolean;
      blocksJson: JsonValue;
    }>;
  }) {
    const normalizedPath = normalizePath(input.path);

    return (
      input.steps.find(
        (step) =>
          normalizePath(
            buildPublicationStepPath(
              input.pathPrefix,
              step.slug,
              step.isEntryStep,
            ),
          ) === normalizedPath,
      ) ?? null
    );
  }
}
