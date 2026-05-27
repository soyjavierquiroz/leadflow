import {
  AssignmentStatus,
  CrmAssignmentSource,
  CrmAssignmentStatus,
  CrmOutreachIntentType,
  CrmOutreachStatus,
  LeadStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdvisorCrmInboxService,
  normalizeAdvisorCrmLimit,
} from './advisor-crm-inbox.service';
import { CrmIdentityMatcher } from './crm-identity-matcher';
import {
  KurukinCrmReadClient,
  KurukinCrmReadError,
  type KurukinConversationalLeadRow,
} from './kurukin-crm-read.client';
import { UnifiedCrmMapper } from './unified-crm.mapper';
import type { UnifiedCrmLead } from './unified-crm.types';
import { CrmOwnershipPolicyService } from './crm-ownership-policy.service';

describe('AdvisorCrmInboxService', () => {
  const scope = {
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    sponsorId: 'sponsor-1',
  };
  const makeRecord = (
    id: string,
    assignmentStatus: AssignmentStatus = AssignmentStatus.assigned,
    assignedAt = '2026-05-26T10:00:00.000Z',
  ) =>
    ({
      id,
      workspaceId: scope.workspaceId,
      currentAssignmentId: `assignment-${id}`,
      assignments: [
        {
          id: `assignment-${id}`,
          sponsorId: scope.sponsorId,
          teamId: scope.teamId,
          status: assignmentStatus,
          assignedAt: new Date(assignedAt),
          acceptedAt:
            assignmentStatus === AssignmentStatus.accepted
              ? new Date('2026-05-26T10:05:00.000Z')
              : null,
        },
      ],
      crmLeadAssignments: [],
      crmOutreachQueue: [],
    }) as never;
  const makeCrmRecord = (
    id: string,
    assignmentStatus: CrmAssignmentStatus = CrmAssignmentStatus.pending_assignment,
  ) =>
    ({
      id,
      workspaceId: scope.workspaceId,
      currentAssignmentId: null,
      assignments: [],
      crmLeadAssignments: [
        {
          id: `crm-assignment-${id}`,
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
          leadId: id,
          attributedSponsorId: 'sponsor-attributed',
          assignedSponsorId: scope.sponsorId,
          acceptedBySponsorId:
            assignmentStatus === CrmAssignmentStatus.accepted
              ? scope.sponsorId
              : null,
          conversationOwnerSponsorId:
            assignmentStatus === CrmAssignmentStatus.auto_accepted
              ? scope.sponsorId
              : null,
          assignmentStatus,
          assignmentSource: CrmAssignmentSource.wheel,
          ownershipLockedUntil: new Date('2026-05-29T10:00:00.000Z'),
          assignedAt: new Date('2026-05-26T10:00:00.000Z'),
          acceptedAt:
            assignmentStatus === CrmAssignmentStatus.accepted ||
            assignmentStatus === CrmAssignmentStatus.auto_accepted
              ? new Date('2026-05-26T10:05:00.000Z')
              : null,
          attributedSponsor: {
            id: 'sponsor-attributed',
            displayName: 'Sponsor Atribuido',
            phone: null,
            status: 'active',
          },
          assignedSponsor: {
            id: scope.sponsorId,
            displayName: 'Sponsor Uno',
            phone: '591111',
            status: 'active',
          },
          acceptedBySponsor:
            assignmentStatus === CrmAssignmentStatus.accepted
              ? {
                  id: scope.sponsorId,
                  displayName: 'Sponsor Uno',
                  phone: '591111',
                  status: 'active',
                }
              : null,
          conversationOwnerSponsor:
            assignmentStatus === CrmAssignmentStatus.auto_accepted
              ? {
                  id: scope.sponsorId,
                  displayName: 'Sponsor Uno',
                  phone: '591111',
                  status: 'active',
                }
              : null,
        },
      ],
      crmOutreachQueue: [
        {
          status: CrmOutreachStatus.queued,
          intentType: CrmOutreachIntentType.initial_contact,
          createdAt: new Date('2026-05-26T10:06:00.000Z'),
          scheduledAt: null,
        },
      ],
    }) as never;
  const makeLead = (
    id: string,
    phone: string,
    activityAt: string,
    overrides: Partial<UnifiedCrmLead> = {},
  ): UnifiedCrmLead =>
    ({
      id: `leadflow:${id}`,
      source: 'leadflow',
      tenant_id: scope.teamId,
      team_id: scope.teamId,
      workspace_id: scope.workspaceId,
      contact: {
        display_name: id,
        phone_e164: phone,
        whatsapp_id: null,
      },
      leadflow: {
        lead_id: id,
        status: LeadStatus.assigned,
        created_at: activityAt,
        updated_at: activityAt,
      },
      owner: {
        sponsor_id: scope.sponsorId,
        assignment_status: AssignmentStatus.assigned,
      },
      origin: {
        origin_type: 'form',
      },
      activity: {
        last_activity_at: activityAt,
        last_message: null,
      },
      dedupe: {
        identity_key: phone,
        confidence: 1,
        possible_duplicate: false,
        duplicate_group_key: null,
        matched_records: [],
      },
      flags: {
        is_registered: true,
        is_conversational: false,
        has_assignment: true,
        is_orphaned: false,
        is_stagnant: false,
        is_closed: false,
        possible_duplicate: false,
      },
      created_at: activityAt,
      updated_at: activityAt,
      ...overrides,
    }) as UnifiedCrmLead;
  const makeExternalRow = (id: string, phone: string) =>
    ({
      id,
      tenant_id: scope.teamId,
      whatsapp_id: `${phone}@s.whatsapp.net`,
      phone_e164: phone,
      name: id,
      status: 'active',
      last_message: `message ${id}`,
      last_message_at: '2026-05-26T12:00:00.000Z',
      attributes: {},
      source_app: 'whatsapp',
      instance_id: 'instance-1',
      vertical_key: 'dxn',
      owner_external_id: null,
      owner_name: null,
      created_at: '2026-05-26T09:00:00.000Z',
      updated_at: '2026-05-26T12:00:00.000Z',
    }) satisfies KurukinConversationalLeadRow;
  const makeExternalLead = (id: string, phone: string): UnifiedCrmLead =>
    ({
      id: `supabase:${id}`,
      source: 'supabase',
      tenant_id: scope.teamId,
      team_id: scope.teamId,
      contact: {
        display_name: id,
        phone_e164: phone,
        whatsapp_id: `${phone}@s.whatsapp.net`,
      },
      supabase: {
        saas_lead_id: id,
        status: 'active',
        last_message: `message ${id}`,
        last_message_at: '2026-05-26T12:00:00.000Z',
      },
      owner: {},
      origin: {
        origin_type: 'whatsapp',
      },
      activity: {
        last_activity_at: '2026-05-26T12:00:00.000Z',
        last_message: `message ${id}`,
      },
      dedupe: {
        identity_key: phone,
        confidence: 1,
        possible_duplicate: false,
        duplicate_group_key: null,
        matched_records: [],
      },
      flags: {
        is_registered: false,
        is_conversational: true,
        has_assignment: false,
        is_orphaned: true,
        is_stagnant: false,
        is_closed: false,
        possible_duplicate: false,
      },
      created_at: '2026-05-26T09:00:00.000Z',
      updated_at: '2026-05-26T12:00:00.000Z',
    }) as UnifiedCrmLead;

  const setup = (input?: {
    records?: never[];
    externalRows?: KurukinConversationalLeadRow[];
    supabaseEnabled?: boolean;
    supabaseConfigured?: boolean;
    supabaseError?: Error;
  }) => {
    const records = input?.records ?? [makeRecord('lead-1')];
    const externalRows = input?.externalRows ?? [];
    const prisma = {
      lead: {
        findMany: jest.fn().mockResolvedValue(records),
      },
    };
    const mapper = {
      fromLeadflow: jest.fn((record: { id: string }) =>
        makeLead(
          record.id,
          record.id === 'lead-2' ? '591222' : '591111',
          record.id === 'lead-3'
            ? '2026-05-26T09:00:00.000Z'
            : record.id === 'lead-2'
              ? '2026-05-26T10:00:00.000Z'
              : '2026-05-26T11:00:00.000Z',
        ),
      ),
      fromSupabase: jest.fn((row: KurukinConversationalLeadRow) =>
        makeExternalLead(row.id, row.phone_e164 ?? ''),
      ),
    };
    const kurukinClient = {
      isEnabled: jest.fn().mockReturnValue(input?.supabaseEnabled ?? true),
      isConfigured: jest
        .fn()
        .mockReturnValue(input?.supabaseConfigured ?? true),
      listConversationalLeadsByPhones: input?.supabaseError
        ? jest.fn().mockRejectedValue(input.supabaseError)
        : jest.fn().mockResolvedValue(externalRows),
    };
    const service = new AdvisorCrmInboxService(
      prisma as unknown as PrismaService,
      mapper as unknown as UnifiedCrmMapper,
      kurukinClient as unknown as KurukinCrmReadClient,
      new CrmIdentityMatcher(),
      new CrmOwnershipPolicyService(),
    );

    return { service, prisma, mapper, kurukinClient };
  };

  it('caps explicit limit at 100 and keeps the default at 50', () => {
    expect(normalizeAdvisorCrmLimit(undefined)).toBe(50);
    expect(normalizeAdvisorCrmLimit('20')).toBe(20);
    expect(normalizeAdvisorCrmLimit('500')).toBe(100);
    expect(normalizeAdvisorCrmLimit('0')).toBe(50);
  });

  it('loads only LeadFlow leads assigned to the current sponsor', async () => {
    const { service, prisma } = setup();

    await service.getInbox(scope);

    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: scope.workspaceId,
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                {
                  assignments: {
                    some: expect.objectContaining({
                      workspaceId: scope.workspaceId,
                      teamId: scope.teamId,
                      sponsorId: scope.sponsorId,
                      status: {
                        in: [
                          AssignmentStatus.pending,
                          AssignmentStatus.assigned,
                          AssignmentStatus.accepted,
                        ],
                      },
                    }),
                  },
                },
              ]),
            }),
          ]),
        },
      }),
    );
  });

  it('does not return unmatched Supabase rows as primary items', async () => {
    const { service } = setup({
      records: [makeRecord('lead-1')],
      externalRows: [
        makeExternalRow('external-match', '591111'),
        makeExternalRow('external-other', '591999'),
      ],
    });

    const result = await service.getInbox(scope);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('leadflow:lead-1');
    expect(result.data[0].advisor_context.external_conversation_count).toBe(1);
    expect(result.data[0].dedupe.matched_records).toEqual([
      expect.objectContaining({ id: 'supabase:external-match' }),
    ]);
  });

  it('marks external conversation context and LeadFlow plus Supabase duplicates', async () => {
    const { service } = setup({
      records: [makeRecord('lead-1')],
      externalRows: [makeExternalRow('external-match', '591111')],
    });

    const result = await service.getInbox(scope);

    expect(result.data[0].advisor_context).toMatchObject({
      has_external_conversation: true,
      latest_external_message: 'message external-match',
      latest_external_message_at: '2026-05-26T12:00:00.000Z',
    });
    expect(result.data[0].flags.possible_duplicate).toBe(true);
    expect(result.counts.duplicados).toBe(1);
    expect(result.counts.external_matches).toBe(1);
  });

  it('filters tab=duplicates to only duplicated advisor leads', async () => {
    const { service } = setup({
      records: [makeRecord('lead-1'), makeRecord('lead-2')],
      externalRows: [makeExternalRow('external-match', '591111')],
    });

    const result = await service.getInbox(scope, { tab: 'duplicates' });

    expect(result.data.map((item) => item.id)).toEqual(['leadflow:lead-1']);
    expect(result.counts.todos).toBe(2);
    expect(result.counts.duplicados).toBe(1);
    expect(result.counts.total_visible).toBe(1);
  });

  it('filters tab=external_matches to only advisor leads with related conversations', async () => {
    const { service } = setup({
      records: [makeRecord('lead-1'), makeRecord('lead-2')],
      externalRows: [makeExternalRow('external-match', '591111')],
    });

    const result = await service.getInbox(scope, { tab: 'external_matches' });

    expect(result.data.map((item) => item.id)).toEqual(['leadflow:lead-1']);
    expect(result.counts.external_matches).toBe(1);
    expect(result.counts.sin_conversacion).toBe(1);
  });

  it('applies search after external enrichment', async () => {
    const { service, kurukinClient } = setup({
      records: [makeRecord('lead-1'), makeRecord('lead-2')],
      externalRows: [makeExternalRow('external-match', '591111')],
    });

    const result = await service.getInbox(scope, { q: 'external-match' });

    expect(result.data.map((item) => item.id)).toEqual(['leadflow:lead-1']);
    expect(result.data[0].advisor_context.has_external_conversation).toBe(true);
    expect(kurukinClient.listConversationalLeadsByPhones).toHaveBeenCalledWith(
      expect.not.objectContaining({
        q: expect.anything(),
      }),
    );
  });

  it('filters tab=handoffs by pending or assigned assignment status', async () => {
    const { service } = setup({
      records: [
        makeRecord('lead-1', AssignmentStatus.assigned),
        makeRecord('lead-2', AssignmentStatus.pending),
        makeRecord('lead-3', AssignmentStatus.accepted),
      ],
    });

    const result = await service.getInbox(scope, { tab: 'handoffs' });

    expect(result.data.map((item) => item.id)).toEqual([
      'leadflow:lead-1',
      'leadflow:lead-2',
    ]);
    expect(result.counts.handoffs).toBe(2);
  });

  it('keeps LeadFlow rows when Supabase enrichment fails', async () => {
    const { service } = setup({
      records: [makeRecord('lead-1')],
      supabaseError: new KurukinCrmReadError('timeout', 'timeout'),
    });

    const result = await service.getInbox(scope);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].advisor_context.has_external_conversation).toBe(
      false,
    );
    expect(result.diagnostics).toMatchObject({
      supabase_available: false,
      supabase_error: 'timeout',
    });
  });

  it('paginates with cursor without duplicate ids', async () => {
    const { service } = setup({
      records: [
        makeRecord('lead-1'),
        makeRecord('lead-2'),
        makeRecord('lead-3'),
      ],
    });

    const pageOne = await service.getInbox(scope, { limit: '2' });
    const pageTwo = await service.getInbox(scope, {
      limit: '2',
      cursor: pageOne.page.next_cursor ?? undefined,
    });

    expect(pageOne.data.map((item) => item.id)).toEqual([
      'leadflow:lead-1',
      'leadflow:lead-2',
    ]);
    expect(pageTwo.data.map((item) => item.id)).toEqual(['leadflow:lead-3']);
    expect(
      pageOne.data.some((item) =>
        pageTwo.data.map((secondItem) => secondItem.id).includes(item.id),
      ),
    ).toBe(false);
  });

  it('does not broaden TEAM_ADMIN operator requests to the full team universe', async () => {
    const { service, prisma } = setup();

    await service.getInbox({
      workspaceId: scope.workspaceId,
      teamId: scope.teamId,
      sponsorId: 'operator-sponsor',
    });

    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                {
                  assignments: {
                    some: expect.objectContaining({
                      sponsorId: 'operator-sponsor',
                      teamId: scope.teamId,
                    }),
                  },
                },
              ]),
            }),
          ]),
        }),
      }),
    );
  });

  it('enriches advisor rows with CRM lifecycle, ownership, lock and outreach queue', async () => {
    const { service } = setup({
      records: [makeCrmRecord('lead-1', CrmAssignmentStatus.auto_accepted)],
    });

    const result = await service.getInbox(scope);

    expect(result.data[0].advisor_context).toMatchObject({
      assignment_id: 'crm-assignment-lead-1',
      crm_assignment_id: 'crm-assignment-lead-1',
      assignment_status: CrmAssignmentStatus.auto_accepted,
      assignment_source: CrmAssignmentSource.wheel,
      ownership_source: 'conversation_owner',
      ownership_locked_until: '2026-05-29T10:00:00.000Z',
      conversation_owner: {
        id: scope.sponsorId,
        display_name: 'Sponsor Uno',
      },
      outreach: {
        has_initial_contact_queued: true,
        status: CrmOutreachStatus.queued,
        intent_type: CrmOutreachIntentType.initial_contact,
      },
    });
    expect(result.counts.activos).toBe(1);
  });
});
