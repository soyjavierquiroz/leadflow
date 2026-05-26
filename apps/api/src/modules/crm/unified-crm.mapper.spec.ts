import { UnifiedCrmMapper } from './unified-crm.mapper';
import type { LeadflowCrmLeadRecord } from './leadflow-crm-read.repository';

const baseLead = {
  id: 'lead-1',
  workspaceId: 'workspace-1',
  funnelId: 'funnel-1',
  funnelInstanceId: 'funnel-instance-1',
  funnelPublicationId: 'publication-1',
  trafficLayer: 'ORGANIC',
  originAdWheelId: null,
  visitorId: 'visitor-1',
  sourceChannel: 'form',
  fullName: 'Jane Prospect',
  email: 'jane@example.com',
  phone: '+591 7777-1234',
  companyName: 'Acme',
  status: 'assigned',
  qualificationGrade: 'warm',
  summaryText: 'Needs follow up.',
  nextActionLabel: 'Call tomorrow.',
  followUpAt: new Date('2026-05-23T10:00:00.000Z'),
  lastContactedAt: null,
  lastQualifiedAt: new Date('2026-05-22T10:00:00.000Z'),
  currentAssignmentId: 'assignment-1',
  tags: [],
  createdAt: new Date('2026-05-20T10:00:00.000Z'),
  updatedAt: new Date('2026-05-21T10:00:00.000Z'),
  currentAssignment: {
    id: 'assignment-1',
    workspaceId: 'workspace-1',
    leadId: 'lead-1',
    sponsorId: 'sponsor-1',
    teamId: 'team-1',
    funnelId: 'funnel-1',
    funnelInstanceId: 'funnel-instance-1',
    funnelPublicationId: 'publication-1',
    rotationPoolId: null,
    trafficLayer: 'ORGANIC',
    originAdWheelId: null,
    status: 'assigned',
    reason: 'rotation',
    assignedAt: new Date('2026-05-21T11:00:00.000Z'),
    acceptedAt: null,
    resolvedAt: null,
    createdAt: new Date('2026-05-21T11:00:00.000Z'),
    updatedAt: new Date('2026-05-21T11:00:00.000Z'),
    sponsor: {
      id: 'sponsor-1',
      displayName: 'Advisor One',
      phone: '+591 7000-0000',
      status: 'active',
    },
  },
  assignments: [],
  funnelInstance: {
    name: 'DXN',
  },
  funnelPublication: {
    pathPrefix: '/',
    domain: {
      host: 'example.com',
    },
  },
} as LeadflowCrmLeadRecord;

describe('UnifiedCrmMapper', () => {
  it('maps a LeadFlow lead into the unified CRM DTO', () => {
    const mapper = new UnifiedCrmMapper();

    const result = mapper.fromLeadflow(baseLead, {
      workspaceId: 'workspace-1',
      teamId: 'team-1',
    });

    expect(result).toMatchObject({
      id: 'leadflow:lead-1',
      source: 'leadflow',
      tenant_id: 'team-1',
      team_id: 'team-1',
      workspace_id: 'workspace-1',
      contact: {
        display_name: 'Jane Prospect',
        phone_e164: '59177771234',
        whatsapp_id: null,
        email: 'jane@example.com',
        company_name: 'Acme',
      },
      leadflow: {
        lead_id: 'lead-1',
        visitor_id: 'visitor-1',
        funnel_id: 'funnel-1',
        funnel_instance_id: 'funnel-instance-1',
        funnel_publication_id: 'publication-1',
        status: 'assigned',
        qualification_grade: 'warm',
        current_assignment_id: 'assignment-1',
      },
      owner: {
        sponsor_id: 'sponsor-1',
        display_name: 'Advisor One',
        status: 'active',
        assignment_status: 'assigned',
        assigned_at: '2026-05-21T11:00:00.000Z',
      },
      origin: {
        origin_type: 'form',
        source_channel: 'form',
        funnel_name: 'DXN',
        domain_host: 'example.com',
      },
      activity: {
        last_activity_at: '2026-05-23T10:00:00.000Z',
        last_message: 'Needs follow up.',
      },
      dedupe: {
        identity_key: '59177771234',
        confidence: 1,
        possible_duplicate: false,
      },
      flags: {
        is_registered: true,
        is_conversational: false,
        has_assignment: true,
        is_orphaned: false,
        is_stagnant: true,
        is_closed: false,
        possible_duplicate: false,
      },
    });
  });

  it('marks a local lead without owner as orphaned', () => {
    const mapper = new UnifiedCrmMapper();
    const result = mapper.fromLeadflow(
      {
        ...baseLead,
        currentAssignmentId: null,
        currentAssignment: null,
        assignments: [],
      },
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
      },
    );

    expect(result.owner.sponsor_id).toBeNull();
    expect(result.flags.has_assignment).toBe(false);
    expect(result.flags.is_orphaned).toBe(true);
    expect(result.flags.is_stagnant).toBe(false);
  });

  it('maps a Supabase conversational lead into the unified CRM DTO', () => {
    const mapper = new UnifiedCrmMapper();

    const result = mapper.fromSupabase({
      id: 'saas-lead-1',
      tenant_id: 'team-1',
      whatsapp_id: '59177771234@s.whatsapp.net',
      phone_e164: '+591 7777-1234',
      name: 'Conversational Jane',
      status: 'active',
      last_message: 'Hola, quiero informacion',
      last_message_at: new Date('2026-05-24T12:00:00.000Z'),
      attributes: {},
      source_app: 'kurukin-core',
      instance_id: 'instance-1',
      vertical_key: 'dxn',
      owner_external_id: 'sponsor-1',
      owner_name: 'Advisor One',
      created_at: new Date('2026-05-23T12:00:00.000Z'),
      updated_at: new Date('2026-05-24T12:30:00.000Z'),
    });

    expect(result).toMatchObject({
      id: 'supabase:saas-lead-1',
      source: 'supabase',
      tenant_id: 'team-1',
      team_id: 'team-1',
      workspace_id: null,
      contact: {
        display_name: 'Conversational Jane',
        phone_e164: '59177771234',
        whatsapp_id: '59177771234@s.whatsapp.net',
        email: null,
      },
      supabase: {
        saas_lead_id: 'saas-lead-1',
        status: 'active',
        source_app: 'kurukin-core',
        instance_id: 'instance-1',
        vertical_key: 'dxn',
        last_message: 'Hola, quiero informacion',
        last_message_at: '2026-05-24T12:00:00.000Z',
      },
      owner: {
        sponsor_id: 'sponsor-1',
        display_name: 'Advisor One',
        assignment_status: 'external_owner',
      },
      origin: {
        origin_type: 'whatsapp',
        instance_id: 'instance-1',
        vertical_key: 'dxn',
      },
      activity: {
        last_activity_at: '2026-05-24T12:00:00.000Z',
        last_message: 'Hola, quiero informacion',
      },
      flags: {
        is_registered: false,
        is_conversational: true,
        has_assignment: true,
        is_orphaned: false,
        possible_duplicate: false,
      },
    });
  });
});
