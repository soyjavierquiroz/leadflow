import {
  CrmIdentityMatcher,
  dedupeMatchedRecords,
  extractWhatsappNumber,
  getReasonPriority,
  normalizePhone,
  normalizeWhatsappId,
} from './crm-identity-matcher';
import type { UnifiedCrmLead } from './unified-crm.types';

type LeadTestOverride = Omit<
  Partial<UnifiedCrmLead>,
  'activity' | 'contact' | 'dedupe' | 'flags' | 'origin' | 'owner'
> & {
  id: string;
  source: 'leadflow' | 'supabase';
  activity?: Partial<UnifiedCrmLead['activity']>;
  contact?: Partial<UnifiedCrmLead['contact']>;
  dedupe?: Partial<UnifiedCrmLead['dedupe']>;
  flags?: Partial<UnifiedCrmLead['flags']>;
  origin?: Partial<UnifiedCrmLead['origin']>;
  owner?: Partial<UnifiedCrmLead['owner']>;
};

const lead = (overrides: LeadTestOverride): UnifiedCrmLead => ({
  id: overrides.id,
  source: overrides.source,
  tenant_id: overrides.tenant_id ?? 'tenant-1',
  team_id: overrides.team_id ?? 'tenant-1',
  workspace_id: null,
  contact: {
    display_name: null,
    phone_e164: null,
    whatsapp_id: null,
    email: null,
    company_name: null,
    ...overrides.contact,
  },
  owner: {
    sponsor_id: null,
    display_name: null,
    phone: null,
    status: null,
    assignment_status: null,
    assigned_at: null,
    accepted_at: null,
    ...overrides.owner,
  },
  origin: {
    origin_type: 'unknown',
    source_channel: null,
    traffic_layer: null,
    funnel_name: null,
    domain_host: null,
    instance_id: null,
    vertical_key: null,
    ...overrides.origin,
  },
  activity: {
    last_activity_at: null,
    last_message: null,
    message_count: 0,
    interaction_count: 0,
    ai_usage_count: 0,
    ...overrides.activity,
  },
  dedupe: {
    identity_key: null,
    confidence: 0,
    match_reason: null,
    possible_duplicate: false,
    duplicate_group_key: null,
    matched_records: [],
    ...overrides.dedupe,
  },
  flags: {
    is_registered: overrides.source === 'leadflow',
    is_conversational: overrides.source === 'supabase',
    has_assignment: false,
    is_orphaned: true,
    is_stagnant: false,
    is_closed: false,
    possible_duplicate: false,
    ...overrides.flags,
  },
  created_at: overrides.created_at ?? '2026-05-20T00:00:00.000Z',
  updated_at: overrides.updated_at ?? '2026-05-20T00:00:00.000Z',
  leadflow: overrides.leadflow,
  supabase: overrides.supabase,
});

describe('CRM identity matcher', () => {
  const matcher = new CrmIdentityMatcher();

  it('normalizes phone with spaces, plus signs, hyphens and parentheses', () => {
    expect(normalizePhone(' +591 (752) 599-52 ')).toBe('59175259952');
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  it('extracts number from whatsapp_id', () => {
    expect(extractWhatsappNumber('59179790873@s.whatsapp.net')).toBe(
      '59179790873',
    );
    expect(normalizeWhatsappId(' +591 7979-0873@S.WHATSAPP.NET ')).toBe(
      '59179790873',
    );
  });

  it('detects LeadFlow vs Supabase duplicates by phone', () => {
    const result = matcher.markPossibleDuplicates([
      lead({
        id: 'leadflow:lead-1',
        source: 'leadflow',
        contact: { phone_e164: '+591 75259952' },
      }),
      lead({
        id: 'supabase:saas-1',
        source: 'supabase',
        contact: { phone_e164: '59175259952' },
      }),
    ]);

    expect(result.every((item) => item.flags.possible_duplicate)).toBe(true);
    expect(result[0].dedupe).toMatchObject({
      possible_duplicate: true,
      duplicate_group_key: 'phone:tenant-1:59175259952',
      match_reason: 'same_phone',
      confidence: 0.95,
    });
  });

  it('detects duplicates inside LeadFlow', () => {
    const result = matcher.markPossibleDuplicates([
      lead({
        id: 'leadflow:edwin',
        source: 'leadflow',
        contact: { phone_e164: '59175259952' },
      }),
      lead({
        id: 'leadflow:antonio',
        source: 'leadflow',
        contact: { phone_e164: '+591 75259952' },
      }),
    ]);

    expect(result.map((item) => item.dedupe.duplicate_group_key)).toEqual([
      'phone:tenant-1:59175259952',
      'phone:tenant-1:59175259952',
    ]);
  });

  it('detects duplicates inside Supabase by whatsapp_id', () => {
    const result = matcher.markPossibleDuplicates([
      lead({
        id: 'supabase:one',
        source: 'supabase',
        contact: { whatsapp_id: '59179790873@s.whatsapp.net' },
      }),
      lead({
        id: 'supabase:two',
        source: 'supabase',
        contact: { whatsapp_id: '59179790873' },
      }),
    ]);

    expect(result[0].dedupe).toMatchObject({
      duplicate_group_key: 'whatsapp:tenant-1:59179790873',
      match_reason: 'same_whatsapp',
      confidence: 1,
    });
  });

  it('detects phone vs whatsapp number matches', () => {
    const result = matcher.markPossibleDuplicates([
      lead({
        id: 'leadflow:javier',
        source: 'leadflow',
        contact: { phone_e164: '59179790873' },
      }),
      lead({
        id: 'supabase:javier',
        source: 'supabase',
        contact: { whatsapp_id: '59179790873@s.whatsapp.net' },
      }),
    ]);

    expect(result[0].dedupe).toMatchObject({
      duplicate_group_key: 'phone:tenant-1:59179790873',
      match_reason: 'phone_matches_whatsapp',
      confidence: 0.95,
    });
  });

  it('does not mark duplicates when phone is different', () => {
    const result = matcher.markPossibleDuplicates([
      lead({
        id: 'leadflow:one',
        source: 'leadflow',
        contact: { phone_e164: '59111111111' },
      }),
      lead({
        id: 'supabase:two',
        source: 'supabase',
        contact: { phone_e164: '59122222222' },
      }),
    ]);

    expect(result.every((item) => item.flags.possible_duplicate)).toBe(false);
  });

  it('does not include the own record in matched_records', () => {
    const result = matcher.markPossibleDuplicates([
      lead({
        id: 'leadflow:one',
        source: 'leadflow',
        contact: { phone_e164: '59111111111' },
      }),
      lead({
        id: 'supabase:two',
        source: 'supabase',
        contact: { phone_e164: '59111111111' },
      }),
    ]);

    expect(result[0].dedupe.matched_records).toEqual([
      {
        source: 'supabase',
        id: 'supabase:two',
        reason: 'same_phone',
        confidence: 0.95,
      },
    ]);
  });

  it('deduplicates matched_records by source and id', () => {
    expect(
      dedupeMatchedRecords([
        {
          source: 'leadflow',
          id: 'leadflow:abc',
          reason: 'same_phone',
          confidence: 0.95,
        },
        {
          source: 'leadflow',
          id: 'leadflow:abc',
          reason: 'phone_matches_whatsapp',
          confidence: 0.95,
        },
      ]),
    ).toEqual([
      {
        source: 'leadflow',
        id: 'leadflow:abc',
        reason: 'same_phone',
        confidence: 0.95,
      },
    ]);
  });

  it('keeps same_whatsapp over same_phone for duplicate matched_records', () => {
    expect(getReasonPriority('same_whatsapp')).toBeGreaterThan(
      getReasonPriority('same_phone'),
    );
    expect(
      dedupeMatchedRecords([
        {
          source: 'supabase',
          id: 'supabase:abc',
          reason: 'same_phone',
          confidence: 0.95,
        },
        {
          source: 'supabase',
          id: 'supabase:abc',
          reason: 'same_whatsapp',
          confidence: 1,
        },
      ]),
    ).toEqual([
      {
        source: 'supabase',
        id: 'supabase:abc',
        reason: 'same_whatsapp',
        confidence: 1,
      },
    ]);
  });

  it('keeps same_phone over phone_matches_whatsapp for duplicate matched_records', () => {
    expect(
      dedupeMatchedRecords([
        {
          source: 'leadflow',
          id: 'leadflow:abc',
          reason: 'phone_matches_whatsapp',
          confidence: 0.95,
        },
        {
          source: 'leadflow',
          id: 'leadflow:abc',
          reason: 'same_phone',
          confidence: 0.95,
        },
      ]),
    ).toEqual([
      {
        source: 'leadflow',
        id: 'leadflow:abc',
        reason: 'same_phone',
        confidence: 0.95,
      },
    ]);
  });

  it('keeps the highest confidence for duplicate matched_records', () => {
    expect(
      dedupeMatchedRecords([
        {
          source: 'supabase',
          id: 'supabase:abc',
          reason: 'phone_matches_whatsapp',
          confidence: 0.8,
        },
        {
          source: 'supabase',
          id: 'supabase:abc',
          reason: 'phone_matches_whatsapp',
          confidence: 0.95,
        },
      ]),
    ).toEqual([
      {
        source: 'supabase',
        id: 'supabase:abc',
        reason: 'phone_matches_whatsapp',
        confidence: 0.95,
      },
    ]);
  });

  it('does not remove matches with different ids', () => {
    expect(
      dedupeMatchedRecords([
        {
          source: 'leadflow',
          id: 'leadflow:one',
          reason: 'same_phone',
          confidence: 0.95,
        },
        {
          source: 'leadflow',
          id: 'leadflow:two',
          reason: 'same_phone',
          confidence: 0.95,
        },
      ]),
    ).toHaveLength(2);
  });

  it('does not remove matches with the same id and different source', () => {
    expect(
      dedupeMatchedRecords([
        {
          source: 'leadflow',
          id: 'shared-id',
          reason: 'same_phone',
          confidence: 0.95,
        },
        {
          source: 'supabase',
          id: 'shared-id',
          reason: 'same_phone',
          confidence: 0.95,
        },
      ]),
    ).toHaveLength(2);
  });

  it('keeps unique matched_records for the real three-record phone group', () => {
    const result = matcher.markPossibleDuplicates([
      lead({
        id: 'leadflow:edwin',
        source: 'leadflow',
        contact: { phone_e164: '59175259952' },
      }),
      lead({
        id: 'leadflow:antonio',
        source: 'leadflow',
        contact: { phone_e164: '+591 75259952' },
      }),
      lead({
        id: 'supabase:freddy-ramos',
        source: 'supabase',
        contact: {
          phone_e164: '59175259952',
          whatsapp_id: '59175259952@s.whatsapp.net',
        },
      }),
    ]);

    for (const item of result) {
      const keys = item.dedupe.matched_records?.map(
        (record) => `${record.source}:${record.id}`,
      );

      expect(item.flags.possible_duplicate).toBe(true);
      expect(item.dedupe.matched_records).toHaveLength(2);
      expect(new Set(keys).size).toBe(keys?.length);
    }
  });

  it('does not change possible duplicate counts when matched_records are deduped', () => {
    const result = matcher.markPossibleDuplicates([
      lead({
        id: 'leadflow:edwin',
        source: 'leadflow',
        contact: { phone_e164: '59175259952' },
      }),
      lead({
        id: 'leadflow:antonio',
        source: 'leadflow',
        contact: { phone_e164: '+591 75259952' },
      }),
      lead({
        id: 'supabase:freddy-ramos',
        source: 'supabase',
        contact: {
          phone_e164: '59175259952',
          whatsapp_id: '59175259952@s.whatsapp.net',
        },
      }),
    ]);

    expect(result.filter((item) => item.flags.possible_duplicate)).toHaveLength(
      3,
    );
  });
});
