import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildPublicationStepPath, normalizePath } from './public-funnel-runtime.utils';
import {
  buildPublicWhatsappMessage,
  buildPublicWhatsappUrl,
  normalizeWhatsappPhone,
  resolvePublicHandoffConfig,
} from './reveal-handoff.utils';
import { IdentityTokenService } from './identity-token.service';
import { ShortLinkProvider } from './short-link.provider';

type JsonValue = import('@prisma/client').Prisma.JsonValue;

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
    const token = this.identityTokenService.issueToken({
      leadId: lead.id,
      publicationId: publication.id,
      targetStepPath,
    });
    const publicBaseUrl = this.buildPublicBaseUrl(
      publication.domain.canonicalHost ?? publication.domain.host,
    );
    const longUrl = new URL(targetStepPath, publicBaseUrl);
    longUrl.searchParams.set('ctx', token);

    const shortened = await this.shortLinkProvider.shortenUrl(longUrl.toString());
    const handoffStrategy =
      publication.handoffStrategy ?? publication.funnelInstance.handoffStrategy;
    const handoffConfig = resolvePublicHandoffConfig(handoffStrategy);
    const sponsor = lead.currentAssignment?.sponsor ?? null;
    const sponsorPhone = normalizeWhatsappPhone(sponsor?.phone ?? null);
    const whatsappMessage = sponsor
      ? buildPublicWhatsappMessage({
          template: handoffConfig.messageTemplate,
          sponsorName: sponsor.displayName,
          leadName: lead.fullName ?? null,
          leadEmail: lead.email ?? null,
          leadPhone: lead.phone ?? null,
          funnelName: publication.funnelInstance.name,
          publicationPath: targetStepPath,
        })
      : null;

    return {
      leadId: lead.id,
      publicationId: publication.id,
      stepKey: input.stepKey,
      targetStep: {
        id: targetStep.id,
        slug: targetStep.slug,
        path: targetStepPath,
        stepType: targetStep.stepType,
      },
      token,
      longUrl: longUrl.toString(),
      shortUrl: shortened.shortUrl,
      url: shortened.resolvedUrl,
      shortened: shortened.shortened,
      shortLinkProvider: shortened.provider,
      whatsappUrl: sponsorPhone
        ? buildPublicWhatsappUrl(sponsorPhone, whatsappMessage)
        : null,
    };
  }

  async hydrateIdentityContext(ctx: string) {
    if (!ctx.trim()) {
      throw new BadRequestException({
        code: 'IDENTITY_CONTEXT_REQUIRED',
        message: 'The ctx token is required.',
      });
    }

    const payload = this.identityTokenService.verifyToken(ctx.trim());
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
            handoffStrategy: true,
            funnelInstance: {
              include: {
                handoffStrategy: true,
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
    const sponsor = lead.currentAssignment?.sponsor ?? null;
    const sponsorPhone = normalizeWhatsappPhone(sponsor?.phone ?? null);
    const whatsappMessage = sponsor
      ? buildPublicWhatsappMessage({
          template: handoffConfig.messageTemplate,
          sponsorName: sponsor.displayName,
          leadName: lead.fullName ?? null,
          leadEmail: lead.email ?? null,
          leadPhone: lead.phone ?? null,
          funnelName: lead.funnelPublication.funnelInstance.name,
          publicationPath: normalizedTargetPath,
        })
      : null;
    const whatsappUrl = sponsorPhone
      ? buildPublicWhatsappUrl(sponsorPhone, whatsappMessage)
      : null;

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
          whatsappPhone: sponsorPhone,
          whatsappMessage,
          whatsappUrl,
        },
        advisor: lead.currentAssignment
          ? {
              name: lead.currentAssignment.sponsor.displayName,
              role: isConversionStructuralType(
                lead.funnelPublication.funnelInstance.structuralType,
              )
                ? 'Advisor'
                : null,
              phone: sponsorPhone,
              photoUrl: lead.currentAssignment.sponsor.avatarUrl,
              bio: null,
              whatsappUrl,
            }
          : null,
        capturedAt: lead.updatedAt.toISOString(),
      },
    };
  }

  private resolveTargetStep(
    steps: Array<{
      id: string;
      slug: string;
      stepType: string;
      isEntryStep: boolean;
      settingsJson: JsonValue;
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
}
