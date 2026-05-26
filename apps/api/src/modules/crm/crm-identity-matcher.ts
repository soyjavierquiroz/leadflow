import { Injectable } from '@nestjs/common';
import type { UnifiedCrmLead } from './unified-crm.types';

type MatchReason = 'same_phone' | 'same_whatsapp' | 'phone_matches_whatsapp';
type MatchedRecord = NonNullable<
  UnifiedCrmLead['dedupe']['matched_records']
>[number];

type IdentityMatch = {
  key: string;
  confidence: number;
  reason: MatchReason;
  leads: UnifiedCrmLead[];
};

const phoneCharactersToStrip = /[\s+\-()]/g;
const whatsappSuffix = '@s.whatsapp.net';
const reasonPriority: Record<MatchReason, number> = {
  same_whatsapp: 3,
  same_phone: 2,
  phone_matches_whatsapp: 1,
};

export const normalizePhone = (value?: string | null): string | null => {
  const normalized = value?.trim().replace(phoneCharactersToStrip, '') ?? '';
  const digits = normalized.replace(/\D/g, '');

  return digits.length > 0 ? digits : null;
};

export const normalizeWhatsappId = (value?: string | null): string | null => {
  const trimmed = value?.trim().toLowerCase() ?? '';

  if (!trimmed) {
    return null;
  }

  const withoutSuffix = trimmed.endsWith(whatsappSuffix)
    ? trimmed.slice(0, -whatsappSuffix.length)
    : trimmed;
  const digits = withoutSuffix
    .replace(phoneCharactersToStrip, '')
    .replace(/\D/g, '');

  return digits.length > 0 ? digits : null;
};

export const extractWhatsappNumber = (value?: string | null): string | null =>
  normalizeWhatsappId(value);

export const getReasonPriority = (reason: string | null | undefined) =>
  reasonPriority[reason as MatchReason] ?? 0;

export const dedupeMatchedRecords = (
  records: MatchedRecord[],
): MatchedRecord[] => {
  const deduped = new Map<string, MatchedRecord>();

  for (const record of records) {
    const key = `${record.source}:${record.id}`;
    const current = deduped.get(key);

    if (!current) {
      deduped.set(key, record);
      continue;
    }

    const currentPriority = getReasonPriority(current.reason);
    const candidatePriority = getReasonPriority(record.reason);
    const nextReason =
      candidatePriority > currentPriority ? record.reason : current.reason;

    deduped.set(key, {
      ...current,
      reason: nextReason,
      confidence: Math.max(current.confidence, record.confidence),
    });
  }

  return [...deduped.values()];
};

@Injectable()
export class CrmIdentityMatcher {
  markPossibleDuplicates(leads: UnifiedCrmLead[]): UnifiedCrmLead[] {
    const matches = [
      ...this.buildSamePhoneMatches(leads),
      ...this.buildSameWhatsappMatches(leads),
      ...this.buildPhoneWhatsappMatches(leads),
    ];

    if (matches.length === 0) {
      return leads;
    }

    const matchesByLeadId = new Map<string, IdentityMatch[]>();

    for (const match of matches) {
      for (const lead of match.leads) {
        const current = matchesByLeadId.get(lead.id) ?? [];
        current.push(match);
        matchesByLeadId.set(lead.id, current);
      }
    }

    return leads.map((lead) => {
      const leadMatches = matchesByLeadId.get(lead.id);

      if (!leadMatches?.length) {
        return lead;
      }

      const bestMatch = this.pickBestMatch(leadMatches);
      const matchedRecords = this.buildMatchedRecords(lead, leadMatches);

      return {
        ...lead,
        dedupe: {
          ...lead.dedupe,
          possible_duplicate: true,
          duplicate_group_key: bestMatch.key,
          match_reason: bestMatch.reason,
          confidence: Math.max(
            lead.dedupe?.confidence ?? 0,
            bestMatch.confidence,
          ),
          matched_records: matchedRecords,
        },
        flags: {
          ...lead.flags,
          possible_duplicate: true,
        },
      };
    });
  }

  private buildSamePhoneMatches(leads: UnifiedCrmLead[]): IdentityMatch[] {
    const groups = this.groupByIdentity(leads, (lead) =>
      normalizePhone(lead.contact.phone_e164),
    );

    return this.toMatches(groups, 'phone', 'same_phone', 0.95);
  }

  private buildSameWhatsappMatches(leads: UnifiedCrmLead[]): IdentityMatch[] {
    const groups = this.groupByIdentity(leads, (lead) =>
      normalizeWhatsappId(lead.contact.whatsapp_id),
    );

    return this.toMatches(groups, 'whatsapp', 'same_whatsapp', 1);
  }

  private buildPhoneWhatsappMatches(leads: UnifiedCrmLead[]): IdentityMatch[] {
    const groups = new Map<string, UnifiedCrmLead[]>();

    for (const lead of leads) {
      const phone = normalizePhone(lead.contact.phone_e164);
      const whatsappNumber = extractWhatsappNumber(lead.contact.whatsapp_id);
      const identities = new Set([phone, whatsappNumber].filter(Boolean));

      for (const identity of identities) {
        const groupKey = `${lead.tenant_id}:${identity}`;
        const current = groups.get(groupKey) ?? [];
        current.push(lead);
        groups.set(groupKey, current);
      }
    }

    const matches: IdentityMatch[] = [];

    for (const [groupKey, group] of groups.entries()) {
      const [tenantId, identity] = groupKey.split(':');
      const hasPhone = group.some(
        (lead) => normalizePhone(lead.contact.phone_e164) === identity,
      );
      const hasWhatsapp = group.some(
        (lead) => extractWhatsappNumber(lead.contact.whatsapp_id) === identity,
      );

      if (hasPhone && hasWhatsapp && group.length > 1) {
        matches.push({
          key: `phone:${tenantId}:${identity}`,
          confidence: 0.95,
          reason: 'phone_matches_whatsapp',
          leads: this.uniqueLeads(group),
        });
      }
    }

    return matches;
  }

  private groupByIdentity(
    leads: UnifiedCrmLead[],
    resolveIdentity: (lead: UnifiedCrmLead) => string | null,
  ) {
    const groups = new Map<string, UnifiedCrmLead[]>();

    for (const lead of leads) {
      const identity = resolveIdentity(lead);

      if (!identity) {
        continue;
      }

      const key = `${lead.tenant_id}:${identity}`;
      const current = groups.get(key) ?? [];
      current.push(lead);
      groups.set(key, current);
    }

    return groups;
  }

  private toMatches(
    groups: Map<string, UnifiedCrmLead[]>,
    keyPrefix: 'phone' | 'whatsapp',
    reason: MatchReason,
    confidence: number,
  ) {
    const matches: IdentityMatch[] = [];

    for (const [groupKey, group] of groups.entries()) {
      if (group.length < 2) {
        continue;
      }

      const [tenantId, identity] = groupKey.split(':');
      matches.push({
        key: `${keyPrefix}:${tenantId}:${identity}`,
        confidence,
        reason,
        leads: this.uniqueLeads(group),
      });
    }

    return matches;
  }

  private pickBestMatch(matches: IdentityMatch[]) {
    return [...matches].sort((left, right) => {
      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }

      return left.key.localeCompare(right.key);
    })[0];
  }

  private buildMatchedRecords(lead: UnifiedCrmLead, matches: IdentityMatch[]) {
    const records: MatchedRecord[] = [];

    for (const match of matches) {
      for (const matchedLead of match.leads) {
        if (matchedLead.id === lead.id) {
          continue;
        }

        records.push({
          source: matchedLead.source as 'leadflow' | 'supabase',
          id: matchedLead.id,
          reason: match.reason,
          confidence: match.confidence,
        });
      }
    }

    return dedupeMatchedRecords(records).sort((left, right) => {
      const sourceOrder = left.source.localeCompare(right.source);
      return sourceOrder === 0 ? left.id.localeCompare(right.id) : sourceOrder;
    });
  }

  private uniqueLeads(leads: UnifiedCrmLead[]) {
    return [...new Map(leads.map((lead) => [lead.id, lead])).values()];
  }
}
