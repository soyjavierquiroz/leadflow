import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionContextSyncService } from '../runtime-context/action-context-sync.service';
import { generateOwnershipKey } from '../runtime-context/ownership-context-key.util';
import { sanitizeNullableText } from '../shared/url.utils';

const ACTIVE_ASSIGNMENT_STATUSES = ['pending', 'assigned', 'accepted'] as const;
const INBOUND_ACTION_CONTEXT_SOURCE = 'inbound_whatsapp_ensure_lead_context';

type TransactionClient = Prisma.TransactionClient;
type MatchSource = 'ownership_ref' | 'phone' | 'inbound_bootstrap';

type EnsureInboundWhatsappLeadContextInput = {
  tenant_id?: string | null;
  channel?: string | null;
  instance_name?: string | null;
  remote_jid?: string | null;
  push_name?: string | null;
  user_message?: string | null;
  message_id?: string | null;
  source?: string | null;
  service_owner_key?: string | null;
  runtime_config_version?: string | null;
};

type EnsuredLeadContext = {
  ok: true;
  match_source: MatchSource;
  created: boolean;
  matched_existing: boolean;
  lead_id: string;
  assignment_id: string;
  publication_id: string | null;
  action_context: {
    provider: 'leadflow';
    lead_id: string;
    assignment_id: string;
    publication_id: string | null;
  };
};

type ResolvedRemoteJid = {
  remoteJid: string;
  phone: string;
};

type OwnerSponsor = {
  id: string;
  workspaceId: string;
  teamId: string;
};

type AssignmentContext = {
  leadId: string;
  assignmentId: string;
  publicationId: string | null;
  workspaceId: string;
  funnelId: string;
  funnelInstanceId: string | null;
  trafficLayer: string | null;
  originAdWheelId: string | null;
  leadStatus: string | null;
  assignmentStatus: string | null;
  assignmentReason: string | null;
  createdLead: boolean;
  matchedExisting: boolean;
  matchSource: MatchSource;
};

const REF_REGEX =
  /\b(?:ref|c[oó]digo(?:\s+de\s+seguimiento)?)\s*:\s*([A-Za-z0-9_-]{4,32})/iu;

const toShortOwnershipRef = (value: string) =>
  value
    .trim()
    .replace(/^lf_own_/i, '')
    .slice(0, 8)
    .toUpperCase();

const extractOwnershipRef = (message: string | null | undefined) => {
  const normalized = sanitizeNullableText(message);
  const match = normalized?.match(REF_REGEX);

  return match?.[1] ? toShortOwnershipRef(match[1]) : null;
};

const resolveRemoteJid = (
  remoteJid: string | null | undefined,
): ResolvedRemoteJid => {
  const normalized = sanitizeNullableText(remoteJid)?.toLowerCase();
  const match = normalized?.match(/^([0-9]{6,20})@s\.whatsapp\.net$/);

  if (!match) {
    throw new BadRequestException({
      code: 'INBOUND_WHATSAPP_REMOTE_JID_INVALID',
      message:
        'remote_jid must be a WhatsApp user JID like 59169347532@s.whatsapp.net.',
    });
  }

  return {
    remoteJid: `${match[1]}@s.whatsapp.net`,
    phone: match[1],
  };
};

@Injectable()
export class InboundWhatsappLeadContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actionContextSyncService: ActionContextSyncService,
  ) {}

  async ensureLeadContext(
    input: EnsureInboundWhatsappLeadContextInput,
  ): Promise<EnsuredLeadContext> {
    const tenantId = sanitizeNullableText(input.tenant_id);
    const channel = sanitizeNullableText(input.channel);
    const instanceName = sanitizeNullableText(input.instance_name);
    const serviceOwnerKey = sanitizeNullableText(input.service_owner_key);
    const remote = resolveRemoteJid(input.remote_jid);

    if (!tenantId) {
      throw new BadRequestException({
        code: 'INBOUND_WHATSAPP_TENANT_REQUIRED',
        message: 'tenant_id is required.',
      });
    }

    if (channel !== 'whatsapp') {
      throw new BadRequestException({
        code: 'INBOUND_WHATSAPP_CHANNEL_INVALID',
        message: 'channel must be whatsapp.',
      });
    }

    if (!instanceName) {
      throw new BadRequestException({
        code: 'INBOUND_WHATSAPP_INSTANCE_REQUIRED',
        message: 'instance_name is required.',
      });
    }

    if (serviceOwnerKey && serviceOwnerKey !== 'lead-handler') {
      throw new BadRequestException({
        code: 'INBOUND_WHATSAPP_SERVICE_OWNER_INVALID',
        message: 'service_owner_key must be lead-handler.',
      });
    }

    const ownershipRef = extractOwnershipRef(input.user_message);
    const context = await this.prisma.$transaction(async (tx) => {
      await this.acquireInboundLock(tx, tenantId, remote.remoteJid);

      return ownershipRef
        ? this.resolveByOwnershipRef(tx, {
            tenantId,
            ownershipRef,
          })
        : this.resolveByPhoneOrBootstrap(tx, {
            tenantId,
            instanceName,
            remote,
            pushName: sanitizeNullableText(input.push_name),
          });
    });

    await this.actionContextSyncService.upsertForRemoteJid({
      tenantId,
      remoteJid: remote.remoteJid,
      leadId: context.leadId,
      assignmentId: context.assignmentId,
      publicationId: context.publicationId,
      source: input.source ?? INBOUND_ACTION_CONTEXT_SOURCE,
      metadata: {
        workspace_id: context.workspaceId,
        team_id: tenantId,
        funnel_id: context.funnelId,
        funnel_instance_id: context.funnelInstanceId,
        funnel_publication_id: context.publicationId,
        lead_status: context.leadStatus,
        assignment_status: context.assignmentStatus,
        assignment_reason: context.assignmentReason,
        traffic_layer: context.trafficLayer,
        origin_ad_wheel_id: context.originAdWheelId,
        match_source: context.matchSource,
        message_id: sanitizeNullableText(input.message_id) ?? null,
        runtime_config_version:
          sanitizeNullableText(input.runtime_config_version) ?? null,
      },
    });

    return {
      ok: true,
      match_source: context.matchSource,
      created: context.createdLead,
      matched_existing: context.matchedExisting,
      lead_id: context.leadId,
      assignment_id: context.assignmentId,
      publication_id: context.publicationId,
      action_context: {
        provider: 'leadflow',
        lead_id: context.leadId,
        assignment_id: context.assignmentId,
        publication_id: context.publicationId,
      },
    };
  }

  private async acquireInboundLock(
    tx: TransactionClient,
    tenantId: string,
    remoteJid: string,
  ) {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`leadflow:inbound-whatsapp:${tenantId}:${remoteJid}`}))`,
    );
  }

  private async resolveByOwnershipRef(
    tx: TransactionClient,
    input: {
      tenantId: string;
      ownershipRef: string;
    },
  ): Promise<AssignmentContext> {
    const matches = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT a.id
      FROM "Assignment" a
      WHERE a."teamId" = ${input.tenantId}
        AND a."ownershipKey" IS NOT NULL
        AND UPPER(SUBSTRING(regexp_replace(a."ownershipKey", '^lf_own_', '', 'i') FROM 1 FOR 8)) = ${input.ownershipRef}
      ORDER BY a."assignedAt" DESC
      LIMIT 2
    `);

    if (matches.length === 0) {
      throw new NotFoundException({
        code: 'INBOUND_WHATSAPP_OWNERSHIP_REF_NOT_FOUND',
        message: `No assignment matched ownership ref ${input.ownershipRef} for this tenant.`,
        reason: 'ownership_ref_not_found',
      });
    }

    if (matches.length > 1) {
      throw new ConflictException({
        code: 'INBOUND_WHATSAPP_OWNERSHIP_REF_CONFLICT',
        message: `Ownership ref ${input.ownershipRef} matched multiple assignments for this tenant.`,
        reason: 'ownership_ref_conflict',
      });
    }

    const assignment = await tx.assignment.findFirst({
      where: {
        id: matches[0]!.id,
        teamId: input.tenantId,
      },
      include: {
        lead: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException({
        code: 'INBOUND_WHATSAPP_OWNERSHIP_REF_NOT_FOUND',
        message: `No assignment matched ownership ref ${input.ownershipRef} for this tenant.`,
        reason: 'ownership_ref_not_found',
      });
    }

    return this.toAssignmentContext(assignment, {
      matchSource: 'ownership_ref',
      createdLead: false,
      matchedExisting: true,
    });
  }

  private async resolveByPhoneOrBootstrap(
    tx: TransactionClient,
    input: {
      tenantId: string;
      instanceName: string;
      remote: ResolvedRemoteJid;
      pushName: string | null;
    },
  ): Promise<AssignmentContext> {
    const owner = await this.resolveInstanceOwnerOrThrow(tx, input);
    const existingLead = await this.findLeadByPhone(tx, {
      tenantId: input.tenantId,
      phone: input.remote.phone,
    });

    if (existingLead) {
      const activeAssignment = await this.findActiveAssignment(tx, {
        tenantId: input.tenantId,
        leadId: existingLead.id,
      });

      if (activeAssignment) {
        return this.toAssignmentContext(activeAssignment, {
          matchSource: 'phone',
          createdLead: false,
          matchedExisting: true,
        });
      }

      const assignment = await this.createAssignmentForLead(tx, {
        lead: existingLead,
        owner,
        reason: 'manual',
        source: 'inbound_existing_phone',
      });

      return this.toAssignmentContext(assignment, {
        matchSource: 'phone',
        createdLead: false,
        matchedExisting: true,
      });
    }

    const publication = await this.resolveBootstrapPublicationOrThrow(tx, {
      tenantId: input.tenantId,
    });
    const now = new Date();
    const lead = await tx.lead.create({
      data: {
        workspaceId: publication.workspaceId,
        funnelId: publication.funnelInstance.funnelId!,
        funnelInstanceId: publication.funnelInstanceId,
        funnelPublicationId: publication.id,
        visitorId: null,
        sourceChannel: 'automation',
        fullName: input.pushName,
        email: null,
        phone: input.remote.phone,
        companyName: null,
        status: 'captured',
        currentAssignmentId: null,
        trafficLayer: 'DIRECT',
        originAdWheelId: null,
        tags: ['source:inbound_whatsapp'],
        createdAt: now,
        updatedAt: now,
      },
    });
    const assignment = await this.createAssignmentForLead(tx, {
      lead,
      owner,
      reason: 'manual',
      source: 'inbound_bootstrap',
    });

    return this.toAssignmentContext(assignment, {
      matchSource: 'inbound_bootstrap',
      createdLead: true,
      matchedExisting: false,
    });
  }

  private async resolveInstanceOwnerOrThrow(
    tx: TransactionClient,
    input: {
      tenantId: string;
      instanceName: string;
    },
  ): Promise<OwnerSponsor> {
    const connection = await tx.messagingConnection.findFirst({
      where: {
        teamId: input.tenantId,
        externalInstanceId: input.instanceName,
      },
      include: {
        sponsor: true,
      },
    });

    if (connection?.sponsor) {
      return {
        id: connection.sponsor.id,
        workspaceId: connection.sponsor.workspaceId,
        teamId: connection.sponsor.teamId,
      };
    }

    const channelInstance = await tx.channelInstance.findFirst({
      where: {
        tenantId: input.tenantId,
        instanceName: input.instanceName,
      },
      include: {
        member: true,
      },
    });

    if (channelInstance?.member) {
      return {
        id: channelInstance.member.id,
        workspaceId: channelInstance.member.workspaceId,
        teamId: channelInstance.member.teamId,
      };
    }

    throw new NotFoundException({
      code: 'INBOUND_WHATSAPP_INSTANCE_OWNER_NOT_FOUND',
      message: `No advisor owner was found for instance ${input.instanceName} in this tenant.`,
      reason: 'instance_owner_not_found',
    });
  }

  private async findLeadByPhone(
    tx: TransactionClient,
    input: {
      tenantId: string;
      phone: string;
    },
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT l.id
      FROM "Lead" l
      LEFT JOIN "FunnelPublication" fp
        ON fp.id = l."funnelPublicationId"
      LEFT JOIN "Assignment" a
        ON a."leadId" = l.id
      WHERE regexp_replace(coalesce(l.phone, ''), '\\D', '', 'g') = ${input.phone}
        AND (fp."teamId" = ${input.tenantId} OR a."teamId" = ${input.tenantId})
      ORDER BY l."updatedAt" DESC
      LIMIT 1
    `);
    const leadId = rows[0]?.id;

    return leadId
      ? tx.lead.findUnique({
          where: {
            id: leadId,
          },
        })
      : null;
  }

  private async findActiveAssignment(
    tx: TransactionClient,
    input: {
      tenantId: string;
      leadId: string;
    },
  ) {
    return tx.assignment.findFirst({
      where: {
        teamId: input.tenantId,
        leadId: input.leadId,
        status: {
          in: [...ACTIVE_ASSIGNMENT_STATUSES],
        },
      },
      include: {
        lead: true,
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });
  }

  private async resolveBootstrapPublicationOrThrow(
    tx: TransactionClient,
    input: {
      tenantId: string;
    },
  ) {
    const publication = await tx.funnelPublication.findFirst({
      where: {
        teamId: input.tenantId,
        isActive: true,
        status: 'active',
        funnelInstance: {
          funnelId: {
            not: null,
          },
        },
      },
      include: {
        funnelInstance: true,
      },
      orderBy: [
        {
          isPrimary: 'desc',
        },
        {
          updatedAt: 'desc',
        },
      ],
    });

    if (!publication?.funnelInstance.funnelId) {
      throw new ConflictException({
        code: 'INBOUND_WHATSAPP_PUBLICATION_CONTEXT_NOT_FOUND',
        message:
          'No active publication with a legacy funnel link was found for inbound WhatsApp bootstrap.',
        reason: 'publication_context_not_found',
      });
    }

    return publication;
  }

  private async createAssignmentForLead(
    tx: TransactionClient,
    input: {
      lead: {
        id: string;
        workspaceId: string;
        funnelId: string;
        funnelInstanceId: string | null;
        funnelPublicationId: string | null;
        trafficLayer: string | null;
        originAdWheelId: string | null;
      };
      owner: OwnerSponsor;
      reason: 'manual' | 'handoff';
      source: string;
    },
  ) {
    const now = new Date();
    const assignment = await tx.assignment.create({
      data: {
        ownershipKey: generateOwnershipKey(),
        workspaceId: input.lead.workspaceId,
        leadId: input.lead.id,
        sponsorId: input.owner.id,
        teamId: input.owner.teamId,
        funnelId: input.lead.funnelId,
        funnelInstanceId: input.lead.funnelInstanceId,
        funnelPublicationId: input.lead.funnelPublicationId,
        rotationPoolId: null,
        trafficLayer: input.lead.trafficLayer ?? 'DIRECT',
        originAdWheelId: input.lead.originAdWheelId,
        status: 'assigned',
        reason: input.reason,
        assignedAt: now,
        acceptedAt: null,
        resolvedAt: null,
      },
      include: {
        lead: true,
      },
    });

    const updatedLead = await tx.lead.update({
      where: {
        id: input.lead.id,
      },
      data: {
        status: 'assigned',
        currentAssignmentId: assignment.id,
      },
    });

    await tx.domainEvent.create({
      data: {
        workspaceId: input.lead.workspaceId,
        eventId: randomUUID(),
        aggregateType: 'lead',
        aggregateId: input.lead.id,
        eventName: 'lead_assigned',
        actorType: 'system',
        payload: {
          source: input.source,
          assignmentId: assignment.id,
          sponsorId: input.owner.id,
          assignmentMode: 'inbound_whatsapp',
        },
        occurredAt: now,
        funnelInstanceId: input.lead.funnelInstanceId,
        funnelPublicationId: input.lead.funnelPublicationId,
        leadId: input.lead.id,
        assignmentId: assignment.id,
      },
    });

    return {
      ...assignment,
      lead: updatedLead,
    };
  }

  private toAssignmentContext(
    assignment: {
      id: string;
      workspaceId: string;
      teamId: string;
      funnelId: string;
      funnelInstanceId: string | null;
      funnelPublicationId: string | null;
      trafficLayer: string | null;
      originAdWheelId: string | null;
      status: string;
      reason: string;
      leadId: string;
      lead: {
        status: string;
      };
    },
    input: {
      matchSource: MatchSource;
      createdLead: boolean;
      matchedExisting: boolean;
    },
  ): AssignmentContext {
    return {
      leadId: assignment.leadId,
      assignmentId: assignment.id,
      publicationId: assignment.funnelPublicationId,
      workspaceId: assignment.workspaceId,
      funnelId: assignment.funnelId,
      funnelInstanceId: assignment.funnelInstanceId,
      trafficLayer: assignment.trafficLayer,
      originAdWheelId: assignment.originAdWheelId,
      leadStatus: assignment.lead.status,
      assignmentStatus: assignment.status,
      assignmentReason: assignment.reason,
      createdLead: input.createdLead,
      matchedExisting: input.matchedExisting,
      matchSource: input.matchSource,
    };
  }
}
