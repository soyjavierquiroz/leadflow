import { randomUUID } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AutomationDispatchStatus,
  Prisma,
  type AutomationDispatch,
  type MessagingConnection,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildPublicWhatsappMessage,
  buildPublicWhatsappUrl,
  normalizeWhatsappPhone,
  resolvePublicHandoffConfig,
} from '../public-funnel-runtime/reveal-handoff.utils';
import { N8nAutomationClient } from './n8n-automation.client';
import type {
  AutomationDispatchView,
  DispatchAssignmentAutomationInput,
  MessagingAutomationMemberSnapshot,
} from './messaging-automation.types';
import {
  buildAutomationReadinessNote,
  resolveAutomationBlockingReason,
  resolveAutomationDispatchTargetUrl,
} from './messaging-automation.utils';

type MemberMessagingAutomationScope = {
  workspaceId: string;
  teamId: string;
  sponsorId: string;
};

const sponsorSnapshotInclude = {
  messagingConnection: true,
  automationDispatches: {
    include: {
      lead: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 5,
  },
} satisfies Prisma.SponsorInclude;

const assignmentDispatchInclude = {
  workspace: true,
  team: true,
  funnel: true,
  lead: {
    include: {
      visitor: true,
    },
  },
  sponsor: {
    include: {
      user: true,
      messagingConnection: true,
    },
  },
  funnelInstance: {
    include: {
      template: true,
      trackingProfile: true,
      handoffStrategy: true,
    },
  },
  funnelPublication: {
    include: {
      domain: true,
      trackingProfile: true,
      handoffStrategy: true,
    },
  },
} satisfies Prisma.AssignmentInclude;

type AssignmentDispatchRecord = Prisma.AssignmentGetPayload<{
  include: typeof assignmentDispatchInclude;
}>;

const toIso = (value: Date | null) => (value ? value.toISOString() : null);

@Injectable()
export class MessagingAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly n8nAutomationClient: N8nAutomationClient,
  ) {}

  async getMemberSnapshot(
    scope: MemberMessagingAutomationScope,
  ): Promise<MessagingAutomationMemberSnapshot> {
    const sponsor = await this.prisma.sponsor.findFirst({
      where: {
        id: scope.sponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
      include: sponsorSnapshotInclude,
    });

    if (!sponsor) {
      throw new NotFoundException({
        code: 'SPONSOR_NOT_FOUND',
        message: 'The requested sponsor was not found for this member.',
      });
    }

    const connection = sponsor.messagingConnection;
    const targetWebhookUrl = resolveAutomationDispatchTargetUrl({
      explicitWebhookUrl: connection?.automationWebhookUrl ?? null,
      defaultWebhookBaseUrl:
        this.n8nAutomationClient.getDefaultWebhookBaseUrl(),
      instanceId: connection?.externalInstanceId ?? null,
    });
    const blockingReason = resolveAutomationBlockingReason({
      connectionStatus: connection?.status ?? null,
      automationEnabled: connection?.automationEnabled ?? false,
      targetWebhookUrl,
    });

    return {
      readiness: {
        canDispatch: !blockingReason,
        status: blockingReason ? 'blocked' : 'ready',
        blockingReason,
        targetWebhookUrl,
        defaultWebhookBaseUrlConfigured:
          this.n8nAutomationClient.hasDefaultWebhookBaseUrl(),
        connectionStatus: connection?.status ?? null,
        note: buildAutomationReadinessNote({
          blockingReason,
          targetWebhookUrl,
        }),
      },
      latestDispatches: sponsor.automationDispatches.map((dispatch) =>
        this.mapDispatch(dispatch),
      ),
    };
  }

  async dispatchAssignmentAutomation(
    input: DispatchAssignmentAutomationInput,
  ): Promise<AutomationDispatchView | null> {
    const assignment = await this.prisma.assignment.findUnique({
      where: {
        id: input.assignmentId,
      },
      include: assignmentDispatchInclude,
    });

    if (!assignment) {
      return null;
    }

    const dispatchId = randomUUID();
    const queuedAt = new Date();
    const connection = assignment.sponsor.messagingConnection;
    const targetWebhookUrl = resolveAutomationDispatchTargetUrl({
      explicitWebhookUrl: connection?.automationWebhookUrl ?? null,
      defaultWebhookBaseUrl:
        this.n8nAutomationClient.getDefaultWebhookBaseUrl(),
      instanceId: connection?.externalInstanceId ?? null,
    });
    const blockingReason = resolveAutomationBlockingReason({
      connectionStatus: connection?.status ?? null,
      automationEnabled: connection?.automationEnabled ?? false,
      targetWebhookUrl,
    });
    const payload = this.buildDispatchPayload({
      dispatchId,
      queuedAt,
      assignment,
      connection,
      input,
      targetWebhookUrl,
    });

    await this.prisma.automationDispatch.create({
      data: {
        id: dispatchId,
        workspaceId: assignment.workspaceId,
        teamId: assignment.teamId,
        sponsorId: assignment.sponsorId,
        leadId: assignment.leadId,
        assignmentId: assignment.id,
        funnelInstanceId: assignment.funnelInstanceId ?? null,
        funnelPublicationId: assignment.funnelPublicationId ?? null,
        messagingConnectionId: connection?.id ?? null,
        triggerType: input.triggerType,
        status: AutomationDispatchStatus.pending,
        targetWebhookUrl,
        payloadSnapshot: payload,
        responseStatusCode: null,
        errorCode: null,
        errorMessage: null,
        queuedAt,
      },
    });

    await this.recordDomainEvent({
      assignment,
      eventName: 'automation_dispatch_queued',
      dispatchId,
      status: AutomationDispatchStatus.pending,
      targetWebhookUrl,
      triggerType: input.triggerType,
    });

    if (blockingReason) {
      const skipped = await this.prisma.automationDispatch.update({
        where: {
          id: dispatchId,
        },
        data: {
          status: AutomationDispatchStatus.skipped,
          responseSnapshot: {
            blockingReason,
          },
          errorCode: blockingReason,
          errorMessage: this.blockingReasonToMessage(blockingReason),
          completedAt: new Date(),
        },
        include: {
          lead: true,
        },
      });

      await this.recordDomainEvent({
        assignment,
        eventName: 'automation_dispatch_skipped',
        dispatchId,
        status: AutomationDispatchStatus.skipped,
        targetWebhookUrl,
        triggerType: input.triggerType,
        errorCode: blockingReason,
        errorMessage: this.blockingReasonToMessage(blockingReason),
      });

      return this.mapDispatch(skipped);
    }

    try {
      const dispatchedAt = new Date();
      const response = await this.n8nAutomationClient.dispatch(
        targetWebhookUrl!,
        payload,
      );
      const success = response.status >= 200 && response.status < 300;
      const status = success
        ? AutomationDispatchStatus.dispatched
        : AutomationDispatchStatus.failed;
      const errorCode = success ? null : `WEBHOOK_HTTP_${response.status}`;
      const errorMessage = success
        ? null
        : this.extractResponseErrorMessage(response.data);

      const dispatch = await this.prisma.automationDispatch.update({
        where: {
          id: dispatchId,
        },
        data: {
          status,
          responseSnapshot: this.toNullableJsonValue(response.data),
          responseStatusCode: response.status,
          errorCode,
          errorMessage,
          dispatchedAt,
          completedAt: new Date(),
        },
        include: {
          lead: true,
        },
      });

      await this.recordDomainEvent({
        assignment,
        eventName: success
          ? 'automation_dispatch_dispatched'
          : 'automation_dispatch_failed',
        dispatchId,
        status,
        targetWebhookUrl,
        triggerType: input.triggerType,
        responseStatusCode: response.status,
        errorCode,
        errorMessage,
      });

      return this.mapDispatch(dispatch);
    } catch (error) {
      const errorCode =
        error instanceof Error && 'status' in error
          ? `WEBHOOK_${String((error as { status: unknown }).status)}`
          : 'WEBHOOK_REQUEST_FAILED';
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'The automation dispatch failed unexpectedly.';

      const failed = await this.prisma.automationDispatch.update({
        where: {
          id: dispatchId,
        },
        data: {
          status: AutomationDispatchStatus.failed,
          errorCode,
          errorMessage,
          completedAt: new Date(),
        },
        include: {
          lead: true,
        },
      });

      await this.recordDomainEvent({
        assignment,
        eventName: 'automation_dispatch_failed',
        dispatchId,
        status: AutomationDispatchStatus.failed,
        targetWebhookUrl,
        triggerType: input.triggerType,
        errorCode,
        errorMessage,
      });

      return this.mapDispatch(failed);
    }
  }

  private buildDispatchPayload(input: {
    dispatchId: string;
    queuedAt: Date;
    assignment: AssignmentDispatchRecord;
    connection: MessagingConnection | null | undefined;
    targetWebhookUrl: string | null;
    input: DispatchAssignmentAutomationInput;
  }): Prisma.InputJsonValue {
    const assignment = input.assignment;
    const effectiveHandoffStrategy =
      assignment.funnelPublication?.handoffStrategy ??
      assignment.funnelInstance?.handoffStrategy ??
      null;
    const handoff = resolvePublicHandoffConfig(effectiveHandoffStrategy);
    const whatsappPhone = normalizeWhatsappPhone(assignment.sponsor.phone);
    const whatsappMessage = buildPublicWhatsappMessage({
      template: handoff.messageTemplate,
      sponsorName: assignment.sponsor.displayName,
      leadName: assignment.lead.fullName,
      leadEmail: assignment.lead.email,
      leadPhone: assignment.lead.phone,
      funnelName:
        assignment.funnelInstance?.name ?? assignment.funnel.name ?? 'Leadflow',
      publicationPath:
        input.input.nextStepPath ??
        assignment.funnelPublication?.pathPrefix ??
        '/',
    });
    const whatsappUrl = buildPublicWhatsappUrl(whatsappPhone, whatsappMessage);

    return {
      version: 'leadflow.messaging-automation.v1',
      dispatch: {
        id: input.dispatchId,
        triggerType: input.input.triggerType,
        queuedAt: input.queuedAt.toISOString(),
        targetWebhookUrl: input.targetWebhookUrl,
        source: 'leadflow-api',
      },
      workspace: {
        id: assignment.workspace.id,
        name: assignment.workspace.name,
        slug: assignment.workspace.slug,
        primaryDomain: assignment.workspace.primaryDomain,
      },
      team: {
        id: assignment.team.id,
        name: assignment.team.name,
        code: assignment.team.code,
      },
      sponsor: {
        id: assignment.sponsor.id,
        displayName: assignment.sponsor.displayName,
        email: assignment.sponsor.email,
        phone: assignment.sponsor.phone,
        availabilityStatus: assignment.sponsor.availabilityStatus,
        status: assignment.sponsor.status,
        memberPortalEnabled: assignment.sponsor.memberPortalEnabled,
        user: assignment.sponsor.user
          ? {
              id: assignment.sponsor.user.id,
              email: assignment.sponsor.user.email,
              fullName: assignment.sponsor.user.fullName,
            }
          : null,
      },
      messagingConnection: input.connection
        ? {
            id: input.connection.id,
            provider: input.connection.provider,
            status: input.connection.status,
            instanceId: input.connection.externalInstanceId,
            normalizedPhone: input.connection.normalizedPhone,
            automationEnabled: input.connection.automationEnabled,
            automationWebhookUrl:
              input.connection.automationWebhookUrl ?? input.targetWebhookUrl,
            lastConnectedAt: toIso(input.connection.lastConnectedAt),
            lastSyncedAt: toIso(input.connection.lastSyncedAt),
          }
        : null,
      lead: {
        id: assignment.lead.id,
        status: assignment.lead.status,
        sourceChannel: assignment.lead.sourceChannel,
        fullName: assignment.lead.fullName,
        email: assignment.lead.email,
        phone: assignment.lead.phone,
        companyName: assignment.lead.companyName,
        tags: assignment.lead.tags,
        createdAt: assignment.lead.createdAt.toISOString(),
      },
      assignment: {
        id: assignment.id,
        status: assignment.status,
        reason: assignment.reason,
        assignedAt: assignment.assignedAt.toISOString(),
        resolvedAt: toIso(assignment.resolvedAt),
      },
      funnel: {
        legacy: {
          id: assignment.funnel.id,
          name: assignment.funnel.name,
          code: assignment.funnel.code,
        },
        instance: assignment.funnelInstance
          ? {
              id: assignment.funnelInstance.id,
              name: assignment.funnelInstance.name,
              code: assignment.funnelInstance.code,
              status: assignment.funnelInstance.status,
              trackingProfileId: assignment.funnelInstance.trackingProfileId,
              handoffStrategyId: assignment.funnelInstance.handoffStrategyId,
              template: {
                id: assignment.funnelInstance.template.id,
                code: assignment.funnelInstance.template.code,
                name: assignment.funnelInstance.template.name,
                version: assignment.funnelInstance.template.version,
              },
            }
          : null,
        publication: assignment.funnelPublication
          ? {
              id: assignment.funnelPublication.id,
              pathPrefix: assignment.funnelPublication.pathPrefix,
              status: assignment.funnelPublication.status,
              trackingProfileId: assignment.funnelPublication.trackingProfileId,
              handoffStrategyId: assignment.funnelPublication.handoffStrategyId,
              domain: {
                id: assignment.funnelPublication.domain.id,
                host: assignment.funnelPublication.domain.host,
                kind: assignment.funnelPublication.domain.kind,
              },
            }
          : null,
      },
      handoff: {
        strategy: effectiveHandoffStrategy
          ? {
              id: effectiveHandoffStrategy.id,
              name: effectiveHandoffStrategy.name,
              type: effectiveHandoffStrategy.type,
            }
          : null,
        resolved: {
          mode: handoff.mode,
          channel: handoff.channel,
          buttonLabel: handoff.buttonLabel,
          autoRedirect: handoff.autoRedirect,
          autoRedirectDelayMs: handoff.autoRedirectDelayMs,
          fallbackWaMeActive: true,
          nextStepPath:
            input.input.nextStepPath ??
            assignment.funnelPublication?.pathPrefix ??
            null,
          whatsappPhone,
          whatsappMessage,
          whatsappUrl,
        },
      },
      tracking: {
        triggerEventId: input.input.triggerEventId ?? null,
        currentStepId: input.input.currentStepId ?? null,
        anonymousId:
          input.input.anonymousId ??
          assignment.lead.visitor?.anonymousId ??
          null,
        visitorId: assignment.lead.visitorId ?? null,
        utmSource: assignment.lead.visitor?.utmSource ?? null,
        utmCampaign: assignment.lead.visitor?.utmCampaign ?? null,
      },
    } satisfies Prisma.JsonObject;
  }

  private async recordDomainEvent(input: {
    assignment: AssignmentDispatchRecord;
    eventName: string;
    dispatchId: string;
    status: AutomationDispatchStatus;
    targetWebhookUrl: string | null;
    triggerType: string;
    responseStatusCode?: number | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  }) {
    await this.prisma.domainEvent.create({
      data: {
        workspaceId: input.assignment.workspaceId,
        eventId: randomUUID(),
        aggregateType: 'assignment',
        aggregateId: input.assignment.id,
        eventName: input.eventName,
        actorType: 'integration',
        payload: {
          dispatchId: input.dispatchId,
          status: input.status,
          targetWebhookUrl: input.targetWebhookUrl,
          triggerType: input.triggerType,
          responseStatusCode: input.responseStatusCode ?? null,
          errorCode: input.errorCode ?? null,
          errorMessage: input.errorMessage ?? null,
        },
        occurredAt: new Date(),
        funnelInstanceId: input.assignment.funnelInstanceId ?? null,
        funnelPublicationId: input.assignment.funnelPublicationId ?? null,
        leadId: input.assignment.leadId,
        assignmentId: input.assignment.id,
      },
    });
  }

  private mapDispatch(
    dispatch: AutomationDispatch & {
      lead?: {
        id: string;
        fullName: string | null;
        email: string | null;
        phone: string | null;
        status: string;
      } | null;
    },
  ): AutomationDispatchView {
    return {
      id: dispatch.id,
      assignmentId: dispatch.assignmentId,
      leadId: dispatch.leadId,
      sponsorId: dispatch.sponsorId,
      triggerType: dispatch.triggerType,
      status: dispatch.status,
      targetWebhookUrl: dispatch.targetWebhookUrl ?? null,
      responseStatusCode: dispatch.responseStatusCode ?? null,
      errorCode: dispatch.errorCode ?? null,
      errorMessage: dispatch.errorMessage ?? null,
      queuedAt: dispatch.queuedAt.toISOString(),
      dispatchedAt: toIso(dispatch.dispatchedAt),
      completedAt: toIso(dispatch.completedAt),
      createdAt: dispatch.createdAt.toISOString(),
      updatedAt: dispatch.updatedAt.toISOString(),
      lead: {
        id: dispatch.lead?.id ?? dispatch.leadId,
        fullName: dispatch.lead?.fullName ?? null,
        email: dispatch.lead?.email ?? null,
        phone: dispatch.lead?.phone ?? null,
        status: dispatch.lead?.status ?? 'unknown',
      },
    };
  }

  private toNullableJsonValue(
    value: unknown,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
    if (value === null || value === undefined) {
      return Prisma.JsonNull;
    }

    return value as Prisma.InputJsonValue;
  }

  private blockingReasonToMessage(reason: string) {
    switch (reason) {
      case 'NO_CHANNEL_CONNECTION':
        return 'The sponsor does not have a messaging connection yet.';
      case 'CHANNEL_NOT_CONNECTED':
        return 'The sponsor channel is not connected yet.';
      case 'AUTOMATION_DISABLED':
        return 'Automation is disabled for this messaging connection.';
      case 'AUTOMATION_WEBHOOK_MISSING':
        return 'No automation webhook target is configured for this sponsor.';
      default:
        return 'The automation bridge is blocked for this sponsor.';
    }
  }

  private extractResponseErrorMessage(value: unknown) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;

      if (
        typeof record.message === 'string' &&
        record.message.trim().length > 0
      ) {
        return record.message.trim();
      }

      if (Array.isArray(record.message) && record.message.length > 0) {
        return String(record.message[0]);
      }
    }

    return 'The automation webhook responded with an error.';
  }
}
