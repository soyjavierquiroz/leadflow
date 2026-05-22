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
  DEFAULT_TENANT_AI_BASE_PROMPT,
  resolveAiRuntimeRoutingMetadata,
  withDefaultAiRuntimeRoutingMetadata,
} from '../ai-config/ai-config.defaults';
import { resolveKloserTenantConfig } from '../ai-config/kloser-tenant-config';
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
  team: {
    include: {
      aiAgentConfigs: {
        where: {
          memberId: null,
          isActive: true,
        },
        orderBy: {
          id: 'asc',
        },
        select: {
          id: true,
          basePrompt: true,
          aiPolicy: true,
          ctaPolicy: true,
          routeContexts: true,
          updatedAt: true,
        },
      },
    },
  },
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

type JsonRecord = Record<string, unknown>;

const toIso = (value: Date | null) => (value ? value.toISOString() : null);

const sanitizeText = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
};

const isJsonRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const cloneJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  if (isJsonRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        cloneJsonValue(nestedValue),
      ]),
    );
  }

  return value;
};

const toJsonRecord = (value: unknown): JsonRecord =>
  isJsonRecord(value) ? (cloneJsonValue(value) as JsonRecord) : {};

const readTenantKloserPolicy = (
  tenantConfigRecord:
    | AssignmentDispatchRecord['team']['aiAgentConfigs'][number]
    | null,
  key: 'compliance_policy' | 'cta_policy',
): Prisma.InputJsonValue => {
  const aiPolicy = toJsonRecord(tenantConfigRecord?.aiPolicy);
  const kloser = toJsonRecord(aiPolicy.kloser ?? aiPolicy.kloser_config);

  return toJsonRecord(kloser[key]) as Prisma.InputJsonValue;
};

const isValidBasePrompt = (value: string | null | undefined) =>
  Boolean(sanitizeText(value));

const isCustomTenantBasePrompt = (value: string | null | undefined) => {
  const prompt = sanitizeText(value);

  return Boolean(prompt && prompt !== DEFAULT_TENANT_AI_BASE_PROMPT);
};

const selectTenantConfigByPromptPriority = (
  configs: AssignmentDispatchRecord['team']['aiAgentConfigs'],
) => {
  return (
    configs.find((config) => isCustomTenantBasePrompt(config.basePrompt)) ??
    configs.find((config) => isValidBasePrompt(config.basePrompt)) ??
    configs[0] ??
    null
  );
};

const readTenantBasePrompt = (
  tenantConfigRecord:
    | AssignmentDispatchRecord['team']['aiAgentConfigs'][number]
    | null,
) =>
  sanitizeText(tenantConfigRecord?.basePrompt) ?? DEFAULT_TENANT_AI_BASE_PROMPT;

const buildTenantConfigVersion = (
  tenantConfigRecord:
    | AssignmentDispatchRecord['team']['aiAgentConfigs'][number]
    | null,
) => {
  if (!tenantConfigRecord) {
    return 'ai-agent-config:fallback';
  }

  return `ai-agent-config:${tenantConfigRecord.id}:${tenantConfigRecord.updatedAt.toISOString()}`;
};

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
    const masterPayloadArtifacts = this.buildKloserMasterPayloadArtifacts({
      assignment,
      payload,
      queuedAt,
      triggerType: input.triggerType,
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
        masterPayload: masterPayloadArtifacts.masterPayload,
        contextSnapshot: masterPayloadArtifacts.contextSnapshot,
        compliancePolicy: masterPayloadArtifacts.compliancePolicy,
        ctaPolicy: masterPayloadArtifacts.ctaPolicy,
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
    const tenantConfigRecord = selectTenantConfigByPromptPriority(
      assignment.team.aiAgentConfigs,
    );
    const runtimeConfig = this.buildRuntimeConfig({
      assignment,
      connection: input.connection,
      tenantConfigRecord,
    });

    return {
      version: 'leadflow.messaging-automation.v1',
      config_version: buildTenantConfigVersion(tenantConfigRecord),
      runtime_config: runtimeConfig,
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
                normalizedHost:
                  assignment.funnelPublication.domain.normalizedHost,
                domainType: assignment.funnelPublication.domain.domainType,
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
    } as unknown as Prisma.InputJsonValue;
  }

  private buildKloserMasterPayloadArtifacts(input: {
    assignment: AssignmentDispatchRecord;
    payload: Prisma.InputJsonValue;
    queuedAt: Date;
    triggerType: string;
  }) {
    const tenantConfigRecord = selectTenantConfigByPromptPriority(
      input.assignment.team.aiAgentConfigs,
    );
    const compliancePolicy = readTenantKloserPolicy(
      tenantConfigRecord,
      'compliance_policy',
    );
    const ctaPolicy = readTenantKloserPolicy(tenantConfigRecord, 'cta_policy');
    const contextSnapshot = {
      leadStage: input.assignment.lead.status,
      routeMode: input.triggerType,
      verticalFlow: this.resolveVerticalFlow(input.assignment),
      leadId: input.assignment.lead.id,
      assignmentId: input.assignment.id,
      trafficLayer:
        input.assignment.trafficLayer ??
        input.assignment.lead.trafficLayer ??
        'ORGANIC',
      capturedAt: input.queuedAt.toISOString(),
    } satisfies Prisma.JsonObject;

    return {
      contextSnapshot,
      compliancePolicy,
      ctaPolicy,
      masterPayload: {
        version: 'leadflow.kloser-master-payload.v1',
        config_version: buildTenantConfigVersion(tenantConfigRecord),
        createdAt: input.queuedAt.toISOString(),
        tenantId: input.assignment.teamId,
        leadId: input.assignment.lead.id,
        assignmentId: input.assignment.id,
        runtime_config: toJsonRecord(input.payload).runtime_config ?? null,
        automationPayload: input.payload,
        contextSnapshot,
        compliancePolicy,
        ctaPolicy,
      } as Prisma.InputJsonValue,
    };
  }

  private resolveVerticalFlow(assignment: AssignmentDispatchRecord) {
    const tenantConfigRecord = selectTenantConfigByPromptPriority(
      assignment.team.aiAgentConfigs,
    );
    const aiPolicy = toJsonRecord(tenantConfigRecord?.aiPolicy);
    const routeContexts = toJsonRecord(tenantConfigRecord?.routeContexts);
    const kloser = toJsonRecord(aiPolicy.kloser ?? aiPolicy.kloser_config);
    const candidates = [
      kloser.vertical,
      kloser.vertical_key,
      aiPolicy.vertical_key,
      aiPolicy.vertical,
      routeContexts.vertical,
      assignment.funnelPublication?.pathPrefix?.replace(/^\/+/, ''),
      assignment.funnelInstance?.code,
    ];

    for (const candidate of candidates) {
      const normalized = sanitizeText(candidate);

      if (normalized) {
        return normalized;
      }
    }

    return 'multinivel';
  }

  private buildRuntimeConfig(input: {
    assignment: AssignmentDispatchRecord;
    connection: MessagingConnection | null | undefined;
    tenantConfigRecord:
      | AssignmentDispatchRecord['team']['aiAgentConfigs'][number]
      | null;
  }) {
    const routeContexts = toJsonRecord(input.tenantConfigRecord?.routeContexts);
    const aiPolicy = withDefaultAiRuntimeRoutingMetadata(
      input.tenantConfigRecord?.aiPolicy,
      {
        tenantCode: input.assignment.team.code,
        brandKey: input.assignment.team.code,
      },
    );
    const ctaPolicy = toJsonRecord(input.tenantConfigRecord?.ctaPolicy);
    const routingMetadata = resolveAiRuntimeRoutingMetadata({
      tenantCode: input.assignment.team.code,
      aiPolicy,
      routeContexts,
    });
    const basePrompt = readTenantBasePrompt(input.tenantConfigRecord);
    const normalizedSponsorPhone = normalizeWhatsappPhone(
      input.assignment.sponsor.phone,
    );

    return {
      version: 'leadflow.ai-runtime-context.v1',
      base_prompt: basePrompt,
      routing: {
        provider: input.connection?.provider ?? 'evolution',
        channel: 'whatsapp',
        instance_name: input.connection?.externalInstanceId ?? '',
        service_owner_key: 'lead-handler',
      },
      tenant: {
        id: input.assignment.teamId,
        name: input.assignment.team.name,
        code: input.assignment.team.code,
        ...routingMetadata,
      },
      member: {
        id: input.assignment.sponsor.id,
        name: input.assignment.sponsor.displayName,
        email: sanitizeText(input.assignment.sponsor.email),
        phone: sanitizeText(input.assignment.sponsor.phone),
        whatsapp_link: normalizedSponsorPhone
          ? `https://wa.me/${normalizedSponsorPhone}`
          : null,
      },
      ai_agent: {
        base_prompt: basePrompt,
        route_contexts: routeContexts,
        cta_policy: ctaPolicy,
        ai_policy: aiPolicy,
      },
      kloser: resolveKloserTenantConfig({
        aiPolicy,
        ctaPolicy,
      }),
    } as unknown as Prisma.InputJsonValue;
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
