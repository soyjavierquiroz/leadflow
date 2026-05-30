import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FunnelEventsService } from '../events/funnel-events.service';
import type { TrackPublicVslEventDto } from './dto/track-public-vsl-event.dto';

const allowedVslEventNames = new Set([
  'vsl_started',
  'vsl_progress_25',
  'vsl_progress_50',
  'vsl_progress_75',
  'vsl_completed',
  'vsl_cta_revealed',
  'vsl_cta_clicked',
]);

const vslPublicationSelect = {
  id: true,
  workspaceId: true,
  teamId: true,
  domainId: true,
  funnelInstanceId: true,
  funnelInstance: {
    select: {
      steps: {
        select: {
          id: true,
          slug: true,
        },
      },
    },
  },
} satisfies Prisma.FunnelPublicationSelect;

type VslPublicationRecord = Prisma.FunnelPublicationGetPayload<{
  select: typeof vslPublicationSelect;
}>;

type TrackPublicVslEventResponse = {
  ok: boolean;
  eventName: string;
  deduped: boolean;
  eventId: string | null;
};

@Injectable()
export class PublicFunnelVslEventsService {
  private readonly logger = new Logger(PublicFunnelVslEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly funnelEventsService: FunnelEventsService,
  ) {}

  async trackVslEvent(
    dto: TrackPublicVslEventDto,
  ): Promise<TrackPublicVslEventResponse> {
    const eventName = this.requireAllowedEventName(dto.eventName);
    const publicationId = this.requireString(
      dto.publicationId,
      'publicationId',
    );
    const stepId = this.requireString(dto.stepId, 'stepId');
    const identity = this.buildIdentity(dto);
    const publication = await this.getPublicationOrThrow(publicationId);
    const step = publication.funnelInstance.steps.find(
      (candidate) => candidate.id === stepId,
    );

    if (!step) {
      throw new BadRequestException({
        code: 'VSL_EVENT_STEP_NOT_IN_PUBLICATION',
        message: `Step ${stepId} does not belong to publication ${publicationId}.`,
      });
    }

    const [lead, assignment] = await Promise.all([
      this.findLead(dto.leadId),
      this.findAssignment(dto.assignmentId),
    ]);
    const sessionId = this.normalizeOptionalString(dto.sessionId);
    const blockId = this.normalizeOptionalString(dto.blockId);
    const eventId =
      this.normalizeOptionalString(dto.eventId) ?? `evt_${randomUUID()}`;
    const trafficLayer =
      lead?.trafficLayer?.trim() ||
      assignment?.trafficLayer?.trim() ||
      this.normalizeOptionalString(dto.trafficLayer) ||
      'unknown';

    try {
      const result = await this.funnelEventsService.recordEvent({
        eventId,
        eventName,
        eventFamily: 'journey',
        source: 'public_vsl_runtime',
        workspaceId: publication.workspaceId,
        teamId: publication.teamId,
        domainId: publication.domainId,
        funnelPublicationId: publication.id,
        funnelInstanceId: publication.funnelInstanceId,
        funnelStepId: stepId,
        leadId: this.normalizeOptionalString(dto.leadId),
        visitorId: this.normalizeOptionalString(dto.visitorId),
        assignmentId: this.normalizeOptionalString(dto.assignmentId),
        trafficLayer,
        dedupeKey: this.buildDedupeKey({
          eventName,
          identity,
          publicationId,
          stepId,
          blockId,
          sessionId,
        }),
        attributionJson: this.buildAttributionJson(dto),
        payloadJson: {
          stepKey: this.normalizeOptionalString(dto.stepKey),
          stepSlug: this.normalizeOptionalString(dto.stepSlug) ?? step.slug,
          blockType:
            this.normalizeOptionalString(dto.blockType) ??
            'hero_vsl_delayed_cta',
          blockId,
          videoId: this.normalizeOptionalString(dto.videoId),
          mediaId: this.normalizeOptionalString(dto.mediaId),
          progressPercent: this.normalizeOptionalNumber(dto.progressPercent),
          currentTimeSeconds: this.normalizeOptionalNumber(
            dto.currentTimeSeconds,
          ),
          durationSeconds: this.normalizeOptionalNumber(dto.durationSeconds),
          ctaMode: this.normalizeOptionalString(dto.ctaMode),
          revealAfterSeconds: this.normalizeOptionalNumber(
            dto.revealAfterSeconds,
          ),
          revealSource: this.normalizeRevealSource(dto.revealSource),
          sourcePath: this.normalizeOptionalString(dto.currentPath),
          referrer: this.normalizeOptionalString(dto.referrer),
          ctaLabel: this.normalizeOptionalString(dto.ctaLabel),
          ctaHref: this.normalizeOptionalString(dto.ctaHref),
          ctaAction: this.normalizeOptionalString(dto.ctaAction),
          sessionId,
          anonymousId: this.normalizeOptionalString(dto.anonymousId),
          metadata: this.isRecord(dto.metadata) ? dto.metadata : null,
        },
      });

      return {
        ok: true,
        eventName,
        deduped: result.deduped,
        eventId: result.event.eventId,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to record ${eventName} FunnelEvent for publication ${publicationId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return {
        ok: false,
        eventName,
        deduped: false,
        eventId,
      };
    }
  }

  private async getPublicationOrThrow(publicationId: string) {
    const publication = await this.prisma.funnelPublication.findUnique({
      where: {
        id: publicationId,
      },
      select: vslPublicationSelect,
    });

    if (!publication) {
      throw new NotFoundException({
        code: 'PUBLICATION_NOT_FOUND',
        message: `Publication ${publicationId} was not found.`,
      });
    }

    return publication;
  }

  private findLead(leadId: string | null | undefined) {
    const normalizedLeadId = this.normalizeOptionalString(leadId);
    if (!normalizedLeadId) {
      return null;
    }

    return this.prisma.lead.findUnique({
      where: {
        id: normalizedLeadId,
      },
      select: {
        id: true,
        trafficLayer: true,
      },
    });
  }

  private findAssignment(assignmentId: string | null | undefined) {
    const normalizedAssignmentId = this.normalizeOptionalString(assignmentId);
    if (!normalizedAssignmentId) {
      return null;
    }

    return this.prisma.assignment.findUnique({
      where: {
        id: normalizedAssignmentId,
      },
      select: {
        id: true,
        trafficLayer: true,
      },
    });
  }

  private requireAllowedEventName(value: string | undefined) {
    const eventName = this.requireString(value, 'eventName');
    if (!allowedVslEventNames.has(eventName)) {
      throw new BadRequestException({
        code: 'VSL_EVENT_NAME_NOT_SUPPORTED',
        message: `Event ${eventName} is not supported by the VSL runtime endpoint.`,
      });
    }

    return eventName;
  }

  private requireString(value: string | undefined, field: string) {
    const normalized = value?.trim();
    if (!normalized) {
      throw new BadRequestException({
        code: 'VSL_EVENT_VALIDATION_ERROR',
        message: `${field} is required.`,
      });
    }

    return normalized;
  }

  private buildIdentity(dto: TrackPublicVslEventDto) {
    const leadId = this.normalizeOptionalString(dto.leadId);
    if (leadId) {
      return `lead:${leadId}`;
    }

    const visitorId = this.normalizeOptionalString(dto.visitorId);
    if (visitorId) {
      return `visitor:${visitorId}`;
    }

    const anonymousId = this.normalizeOptionalString(dto.anonymousId);
    if (anonymousId) {
      return `anon:${anonymousId}`;
    }

    const sessionId = this.normalizeOptionalString(dto.sessionId);
    if (sessionId) {
      return `session:${sessionId}`;
    }

    throw new BadRequestException({
      code: 'VSL_EVENT_IDENTITY_REQUIRED',
      message:
        'At least one identity is required: leadId, visitorId, anonymousId, or sessionId.',
    });
  }

  private buildDedupeKey(input: {
    eventName: string;
    identity: string;
    publicationId: string;
    stepId: string;
    blockId: string | null;
    sessionId: string | null;
  }) {
    if (input.eventName === 'vsl_cta_clicked') {
      return null;
    }

    return [
      input.eventName,
      input.identity,
      input.publicationId,
      input.stepId,
      input.blockId || 'unknown_block',
      input.sessionId || 'unknown_session',
    ].join(':');
  }

  private buildAttributionJson(dto: TrackPublicVslEventDto) {
    const referrer = this.normalizeOptionalString(dto.referrer);
    const currentPath = this.normalizeOptionalString(dto.currentPath);
    if (!referrer && !currentPath) {
      return null;
    }

    return {
      referrer,
      currentPath,
    };
  }

  private normalizeRevealSource(value: string | null | undefined) {
    return value === 'time_update' || value === 'fallback_timeout'
      ? value
      : null;
  }

  private normalizeOptionalNumber(value: number | null | undefined) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private normalizeOptionalString(value: string | null | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }
}
