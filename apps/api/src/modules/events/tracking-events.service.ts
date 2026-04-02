import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  EventActorType,
  EventAggregateType,
} from '../shared/domain.types';
import type { TrackPublicRuntimeEventDto } from '../public-funnel-runtime/dto/track-public-runtime-event.dto';

const publicRuntimeEventNames = new Set([
  'funnel_viewed',
  'step_viewed',
  'form_started',
  'form_submitted',
  'cta_clicked',
  'handoff_completed',
]);

const trackingPublicationInclude = {
  domain: true,
  trackingProfile: true,
  handoffStrategy: true,
  funnelInstance: {
    include: {
      trackingProfile: true,
      handoffStrategy: true,
      steps: {
        orderBy: {
          position: 'asc',
        },
      },
    },
  },
} satisfies Prisma.FunnelPublicationInclude;

type TransactionClient = Prisma.TransactionClient;
type TrackingPublicationRecord = Prisma.FunnelPublicationGetPayload<{
  include: typeof trackingPublicationInclude;
}>;

type RecordTrackingEventInput = {
  workspaceId: string;
  eventId?: string;
  aggregateType: EventAggregateType;
  aggregateId: string;
  eventName: string;
  actorType: EventActorType;
  payload?: Record<string, unknown>;
  occurredAt?: Date;
  funnelInstanceId?: string | null;
  funnelPublicationId?: string | null;
  funnelStepId?: string | null;
  visitorId?: string | null;
  leadId?: string | null;
  assignmentId?: string | null;
};

@Injectable()
export class TrackingEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async trackPublicRuntimeEvent(dto: TrackPublicRuntimeEventDto) {
    return this.prisma.$transaction(async (tx) => {
      const publication = await this.getPublicationContextOrThrow(
        tx,
        dto.publicationId,
      );
      const step = dto.stepId
        ? publication.funnelInstance.steps.find(
            (item) => item.id === dto.stepId,
          )
        : null;

      if (!publicRuntimeEventNames.has(dto.eventName)) {
        throw new BadRequestException({
          code: 'EVENT_NAME_NOT_SUPPORTED',
          message: `Event ${dto.eventName} is not supported by the public runtime endpoint.`,
        });
      }

      if (dto.eventName !== 'funnel_viewed' && !step) {
        throw new BadRequestException({
          code: 'STEP_ID_REQUIRED',
          message: `Event ${dto.eventName} requires a valid stepId.`,
        });
      }

      const eventId = dto.eventId?.trim() || randomUUID();
      const usesStepAggregate =
        dto.eventName !== 'funnel_viewed' && Boolean(step);
      const trackingProfileId =
        publication.trackingProfileId ??
        publication.funnelInstance.trackingProfileId;
      const handoffStrategyId =
        publication.handoffStrategyId ??
        publication.funnelInstance.handoffStrategyId;

      const event = await this.recordTrackingEventInTransaction(tx, {
        workspaceId: publication.workspaceId,
        eventId,
        aggregateType: usesStepAggregate ? 'funnel-step' : 'funnel-publication',
        aggregateId: usesStepAggregate && step ? step.id : publication.id,
        eventName: dto.eventName,
        actorType: 'visitor',
        funnelInstanceId: publication.funnelInstanceId,
        funnelPublicationId: publication.id,
        funnelStepId: usesStepAggregate ? (step?.id ?? null) : null,
        visitorId: dto.visitorId ?? null,
        leadId: dto.leadId ?? null,
        assignmentId: dto.assignmentId ?? null,
        payload: {
          source: 'browser',
          anonymousId: dto.anonymousId ?? null,
          host: publication.domain.host,
          path: dto.currentPath ?? null,
          referrer: dto.referrer ?? null,
          publication: {
            id: publication.id,
            pathPrefix: publication.pathPrefix,
          },
          funnel: {
            id: publication.funnelInstanceId,
            code: publication.funnelInstance.code,
            name: publication.funnelInstance.name,
          },
          step: step
            ? {
                id: step.id,
                slug: step.slug,
                stepType: step.stepType,
                position: step.position,
              }
            : null,
          trackingProfileId,
          handoffStrategyId,
          cta:
            dto.ctaLabel || dto.ctaHref || dto.ctaAction
              ? {
                  label: dto.ctaLabel ?? null,
                  href: dto.ctaHref ?? null,
                  action: dto.ctaAction ?? null,
                }
              : null,
          metadata: dto.metadata ?? {},
        },
      });

      return {
        id: event.id,
        eventId: event.eventId,
        eventName: event.eventName,
        occurredAt: event.occurredAt,
      };
    });
  }

  async recordTrackingEvent(input: RecordTrackingEventInput) {
    return this.prisma.$transaction(async (tx) =>
      this.recordTrackingEventInTransaction(tx, input),
    );
  }

  async recordTrackingEventInTransaction(
    tx: TransactionClient,
    input: RecordTrackingEventInput,
  ) {
    const occurredAt = input.occurredAt ?? new Date();
    const eventId = input.eventId?.trim() || randomUUID();

    return tx.domainEvent.create({
      data: {
        workspaceId: input.workspaceId,
        eventId,
        aggregateType: this.toDbAggregateType(input.aggregateType),
        aggregateId: input.aggregateId,
        eventName: input.eventName,
        actorType: input.actorType,
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
        occurredAt,
        funnelInstanceId: input.funnelInstanceId ?? null,
        funnelPublicationId: input.funnelPublicationId ?? null,
        funnelStepId: input.funnelStepId ?? null,
        visitorId: input.visitorId ?? null,
        leadId: input.leadId ?? null,
        assignmentId: input.assignmentId ?? null,
      },
    });
  }

  private async getPublicationContextOrThrow(
    tx: TransactionClient,
    publicationId: string,
  ): Promise<TrackingPublicationRecord> {
    const publication = await tx.funnelPublication.findUnique({
      where: { id: publicationId },
      include: trackingPublicationInclude,
    });

    if (
      !publication ||
      publication.status !== 'active' ||
      !publication.isActive ||
      publication.domain.status !== 'active' ||
      publication.funnelInstance.status !== 'active'
    ) {
      throw new NotFoundException({
        code: 'PUBLICATION_NOT_FOUND',
        message: `Publication ${publicationId} is not active.`,
      });
    }

    return publication;
  }

  private toDbAggregateType(value: EventAggregateType) {
    switch (value) {
      case 'rotation-pool':
        return 'rotation_pool';
      case 'rotation-member':
        return 'rotation_member';
      case 'funnel-template':
        return 'funnel_template';
      case 'funnel-instance':
        return 'funnel_instance';
      case 'funnel-step':
        return 'funnel_step';
      case 'funnel-publication':
        return 'funnel_publication';
      case 'tracking-profile':
        return 'tracking_profile';
      case 'conversion-event-mapping':
        return 'conversion_event_mapping';
      case 'handoff-strategy':
        return 'handoff_strategy';
      default:
        return value;
    }
  }
}
