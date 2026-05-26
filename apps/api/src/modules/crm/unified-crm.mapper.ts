import { Injectable } from '@nestjs/common';
import { sanitizeToKurukinFormatOrNull } from '../shared/phone-utils';
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
}

