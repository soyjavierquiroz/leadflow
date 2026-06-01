import {
  ActionContextSyncService,
  buildActionContextUpsertPayload,
} from './action-context-sync.service';

describe('ActionContextSyncService', () => {
  const originalEnv = { ...process.env };

  const buildAssignment = () => ({
    id: 'assignment-1',
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    funnelId: 'funnel-1',
    funnelInstanceId: 'funnel-instance-1',
    funnelPublicationId: 'publication-1',
    leadId: 'lead-1',
    sponsorId: 'sponsor-1',
    rotationPoolId: null,
    ownershipKey: 'ownership-1',
    trafficLayer: 'PAID_WHEEL',
    originAdWheelId: 'wheel-1',
    status: 'assigned',
    reason: 'rotation',
    assignedAt: new Date('2026-05-31T10:00:00.000Z'),
    acceptedAt: null,
    resolvedAt: null,
    createdAt: new Date('2026-05-31T10:00:00.000Z'),
    updatedAt: new Date('2026-05-31T10:00:00.000Z'),
    lead: {
      id: 'lead-1',
      workspaceId: 'workspace-1',
      funnelId: 'funnel-1',
      funnelInstanceId: 'funnel-instance-1',
      funnelPublicationId: 'publication-1',
      visitorId: 'visitor-1',
      sourceChannel: 'form',
      fullName: 'Lead Demo',
      email: 'lead@example.com',
      phone: '+52 55 1234 5678',
      companyName: null,
      status: 'assigned',
      currentAssignmentId: 'assignment-1',
      trafficLayer: 'PAID_WHEEL',
      originAdWheelId: 'wheel-1',
      originAdWheelName: null,
      tags: [],
      qualificationGrade: null,
      summaryText: null,
      nextActionLabel: null,
      followUpAt: null,
      lastContactedAt: null,
      lastQualifiedAt: null,
      createdAt: new Date('2026-05-31T10:00:00.000Z'),
      updatedAt: new Date('2026-05-31T10:00:00.000Z'),
    },
  });

  const buildService = (assignment: unknown = buildAssignment()) => {
    const prisma = {
      assignment: {
        findUnique: jest.fn().mockResolvedValue(assignment),
      },
    };
    const service = new ActionContextSyncService(prisma as never);

    return {
      prisma,
      service,
    };
  };

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-06-01T12:00:00.000Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('maps action context fields to the runtime-context upsert contract', () => {
    const payload = buildActionContextUpsertPayload({
      tenantId: 'team-1',
      remoteJid: '525512345678@s.whatsapp.net',
      leadId: 'lead-1',
      assignmentId: 'assignment-1',
      publicationId: 'publication-1',
      status: 'active',
      metadata: {
        source: 'spec',
      },
    });

    expect(payload).toEqual({
      tenant_id: 'team-1',
      channel: 'whatsapp',
      remote_jid: '525512345678@s.whatsapp.net',
      provider: 'leadflow',
      lead_id: 'lead-1',
      assignment_id: 'assignment-1',
      publication_id: 'publication-1',
      status: 'active',
      metadata: {
        source: 'spec',
      },
    });
    expect(payload).not.toHaveProperty('tenantId');
    expect(payload).not.toHaveProperty('remoteJid');
    expect(payload).not.toHaveProperty('leadId');
  });

  it('posts assignment context with internal auth headers and leadflow provider', async () => {
    process.env.RUNTIME_CONTEXT_BASE_URL = 'http://runtime-context.example';
    process.env.RUNTIME_CONTEXT_INTERNAL_API_KEY = 'runtime-secret';
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(''),
    } as unknown as Response);
    const { prisma, service } = buildService();

    await expect(
      service.upsertForAssignment({
        assignmentId: 'assignment-1',
        source: 'unit_test',
      }),
    ).resolves.toEqual({
      dispatched: true,
    });

    expect(prisma.assignment.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'assignment-1',
      },
      include: {
        lead: true,
      },
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://runtime-context.example/v1/admin/action-contexts/upsert',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-internal-api-key': 'runtime-secret',
          'x-service-key': 'leadflow_api',
        }),
        body: expect.any(String),
      }),
    );

    const [, request] = fetchSpy.mock.calls[0]!;
    const body = JSON.parse(String((request as RequestInit).body));

    expect(body).toMatchObject({
      tenant_id: 'team-1',
      channel: 'whatsapp',
      remote_jid: '525512345678@s.whatsapp.net',
      provider: 'leadflow',
      lead_id: 'lead-1',
      assignment_id: 'assignment-1',
      publication_id: 'publication-1',
      status: 'active',
      metadata: {
        workspace_id: 'workspace-1',
        team_id: 'team-1',
        funnel_id: 'funnel-1',
        funnel_instance_id: 'funnel-instance-1',
        funnel_publication_id: 'publication-1',
        lead_status: 'assigned',
        assignment_status: 'assigned',
        assignment_reason: 'rotation',
        traffic_layer: 'PAID_WHEEL',
        origin_ad_wheel_id: 'wheel-1',
        synced_by: 'leadflow_api',
        synced_at: '2026-06-01T12:00:00.000Z',
        sync_source: 'unit_test',
      },
    });
  });

  it('falls back to existing central runtime context variables', async () => {
    process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL =
      'http://runtime-context.example/v1';
    process.env.RUNTIME_CONTEXT_CENTRAL_API_KEY = 'central-secret';
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(''),
    } as unknown as Response);
    const { service } = buildService();

    await service.upsertForAssignment({
      assignmentId: 'assignment-1',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://runtime-context.example/v1/admin/action-contexts/upsert',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-internal-api-key': 'central-secret',
          'x-service-key': 'leadflow_api',
        }),
      }),
    );
  });

  it('returns a noop when the lead phone cannot produce a remote_jid', async () => {
    process.env.RUNTIME_CONTEXT_BASE_URL = 'http://runtime-context.example';
    process.env.RUNTIME_CONTEXT_INTERNAL_API_KEY = 'runtime-secret';
    const fetchSpy = jest.spyOn(global, 'fetch');
    const baseAssignment = buildAssignment();
    const assignment = {
      ...baseAssignment,
      lead: {
        ...baseAssignment.lead,
        phone: null,
      },
    };
    const { service } = buildService(assignment);

    await expect(
      service.upsertForAssignment({
        assignmentId: 'assignment-1',
      }),
    ).resolves.toEqual({
      dispatched: false,
      reason: 'remote_jid_missing',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps sync best-effort when runtime context rejects the request', async () => {
    process.env.RUNTIME_CONTEXT_BASE_URL = 'http://runtime-context.example';
    process.env.RUNTIME_CONTEXT_INTERNAL_API_KEY = 'runtime-secret';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      text: jest.fn().mockResolvedValue('temporarily unavailable'),
    } as unknown as Response);
    const { service } = buildService();

    await expect(
      service.upsertForAssignment({
        assignmentId: 'assignment-1',
      }),
    ).resolves.toEqual({
      dispatched: false,
      reason: 'request_failed',
    });
  });
});
