import { Injectable } from '@nestjs/common';
import { sanitizeToKurukinFormatOrNull } from '../shared/phone-utils';
import type { KurukinConversationalLeadRow } from './kurukin-crm-read.client';
import type { LeadflowCrmLeadRecord } from './leadflow-crm-read.repository';
import type { UnifiedCrmLead, UnifiedCrmScope } from './unified-crm.types';

const toIso = (value: Date | null | undefined) =>
  value ? value.toISOString() : null;

const maxDate = (values: Array<Date | null | undefined>) => {
  const dates = values.filter((value): value is Date => Boolean(value));
  const [first, ...rest] = dates;

  if (!first) {
    return null;
  }

  return rest.reduce(
    (current, candidate) =>
      candidate.getTime() > current.getTime() ? candidate : current,
    first,
  );
};

const toDateOrNull = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeWhatsappIdentity = (value: string | null | undefined) => {
  const sanitized = sanitizeToKurukinFormatOrNull(value);
  return sanitized ?? value?.trim() ?? null;
};

const resolveOriginType = (
  lead: LeadflowCrmLeadRecord,
): UnifiedCrmLead['origin']['origin_type'] => {
  if (
    lead.trafficLayer === 'PAID_WHEEL' ||
    lead.trafficLayer === 'PAID_ADS'
  ) {
    return 'campaign';
  }

  if (lead.sourceChannel === 'manual') {
    return 'manual';
  }

  if (
    lead.sourceChannel === 'form' ||
    lead.sourceChannel === 'landing_page' ||
    lead.funnelId ||
    lead.funnelInstanceId ||
    lead.funnelPublicationId
  ) {
    return 'form';
  }

  return 'unknown';
};

@Injectable()
export class UnifiedCrmMapper {
  fromLeadflow(lead: LeadflowCrmLeadRecord, scope: UnifiedCrmScope) {
    const ownerAssignment = lead.currentAssignment ?? lead.assignments[0] ?? null;
    const ownerSponsor = ownerAssignment?.sponsor ?? null;
    const phoneE164 = sanitizeToKurukinFormatOrNull(lead.phone);
    const lastActivityAt = maxDate([
      lead.updatedAt,
      lead.lastContactedAt,
      lead.lastQualifiedAt,
      lead.followUpAt,
    ]);
    const assignmentStatus = ownerAssignment?.status ?? null;
    const isClosed =
      lead.status === 'won' ||
      lead.status === 'lost' ||
      assignmentStatus === 'closed' ||
      assignmentStatus === 'reassigned';
    const isStagnant =
      assignmentStatus === 'pending' || assignmentStatus === 'assigned';

    return {
      id: `leadflow:${lead.id}`,
      source: 'leadflow',
      tenant_id: scope.teamId,
      team_id: scope.teamId,
      workspace_id: lead.workspaceId,
      contact: {
        display_name: lead.fullName,
        phone_e164: phoneE164,
        whatsapp_id: null,
        email: lead.email,
        company_name: lead.companyName,
      },
      leadflow: {
        lead_id: lead.id,
        visitor_id: lead.visitorId,
        funnel_id: lead.funnelId,
        funnel_instance_id: lead.funnelInstanceId,
        funnel_publication_id: lead.funnelPublicationId,
        status: lead.status,
        qualification_grade: lead.qualificationGrade,
        current_assignment_id: lead.currentAssignmentId,
        created_at: toIso(lead.createdAt),
        updated_at: toIso(lead.updatedAt),
      },
      supabase: undefined,
      owner: {
        sponsor_id: ownerSponsor?.id ?? null,
        display_name: ownerSponsor?.displayName ?? null,
        phone: ownerSponsor?.phone ?? null,
        status: ownerSponsor?.status ?? null,
        assignment_status: assignmentStatus,
        assigned_at: toIso(ownerAssignment?.assignedAt),
        accepted_at: toIso(ownerAssignment?.acceptedAt),
      },
      origin: {
        origin_type: resolveOriginType(lead),
        source_channel: lead.sourceChannel,
        traffic_layer: lead.trafficLayer,
        funnel_name: lead.funnelInstance?.name ?? null,
        domain_host: lead.funnelPublication?.domain?.host ?? null,
        instance_id: null,
        vertical_key: null,
      },
      activity: {
        last_activity_at: toIso(lastActivityAt) ?? toIso(lead.updatedAt),
        last_message: lead.summaryText ?? lead.nextActionLabel,
        message_count: 0,
        interaction_count: 0,
        ai_usage_count: 0,
      },
      dedupe: {
        identity_key: phoneE164,
        confidence: 1,
        match_reason: phoneE164 ? 'leadflow_phone' : null,
        possible_duplicate: false,
        duplicate_group_key: null,
        matched_records: [],
      },
      flags: {
        is_registered: true,
        is_conversational: false,
        has_assignment: Boolean(ownerSponsor?.id),
        is_orphaned: !ownerSponsor?.id,
        is_stagnant: isStagnant,
        is_closed: isClosed,
        possible_duplicate: false,
      },
      created_at: lead.createdAt.toISOString(),
      updated_at: lead.updatedAt.toISOString(),
    } satisfies UnifiedCrmLead;
  }

  fromSupabase(row: KurukinConversationalLeadRow): UnifiedCrmLead {
    const phoneE164 = sanitizeToKurukinFormatOrNull(row.phone_e164);
    const whatsappId = row.whatsapp_id?.trim() || null;
    const identityKey = phoneE164 ?? normalizeWhatsappIdentity(whatsappId);
    const lastMessageAt = toDateOrNull(row.last_message_at);
    const createdAt = toDateOrNull(row.created_at) ?? new Date(0);
    const updatedAt = toDateOrNull(row.updated_at) ?? createdAt;
    const lastActivityAt =
      lastMessageAt ?? toDateOrNull(row.updated_at) ?? createdAt;
    const ownerExternalId = row.owner_external_id?.trim() || null;

    return {
      id: `supabase:${row.id}`,
      source: 'supabase',
      tenant_id: row.tenant_id,
      team_id: row.tenant_id,
      workspace_id: null,
      contact: {
        display_name: row.name,
        phone_e164: phoneE164,
        whatsapp_id: whatsappId,
        email: null,
        company_name: null,
      },
      leadflow: undefined,
      supabase: {
        saas_lead_id: row.id,
        status: row.status,
        source_app: row.source_app,
        instance_id: row.instance_id,
        vertical_key: row.vertical_key,
        last_message: row.last_message,
        last_message_at: toIso(lastMessageAt),
        memory_stage: null,
        created_at: toIso(createdAt),
        updated_at: toIso(updatedAt),
      },
      owner: {
        sponsor_id: ownerExternalId,
        display_name: row.owner_name,
        phone: null,
        status: null,
        assignment_status: ownerExternalId ? 'external_owner' : null,
        assigned_at: null,
        accepted_at: null,
      },
      origin: {
        origin_type: 'whatsapp',
        source_channel: row.source_app,
        traffic_layer: null,
        funnel_name: null,
        domain_host: null,
        instance_id: row.instance_id,
        vertical_key: row.vertical_key,
      },
      activity: {
        last_activity_at: toIso(lastActivityAt),
        last_message: row.last_message,
        message_count: 0,
        interaction_count: 0,
        ai_usage_count: 0,
      },
      dedupe: {
        identity_key: identityKey,
        confidence: 1,
        match_reason: identityKey
          ? phoneE164
            ? 'supabase_phone'
            : 'supabase_whatsapp_id'
          : null,
        possible_duplicate: false,
        duplicate_group_key: null,
        matched_records: [],
      },
      flags: {
        is_registered: false,
        is_conversational: true,
        has_assignment: Boolean(ownerExternalId),
        is_orphaned: !ownerExternalId,
        is_stagnant: false,
        is_closed: row.status === 'closed' || row.status === 'lost',
        possible_duplicate: false,
      },
      created_at: createdAt.toISOString(),
      updated_at: updatedAt.toISOString(),
    };
  }
}
