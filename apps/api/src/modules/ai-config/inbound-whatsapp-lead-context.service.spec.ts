import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InboundWhatsappLeadContextService } from './inbound-whatsapp-lead-context.service';

describe('InboundWhatsappLeadContextService', () => {
  const buildLead = (overrides: Record<string, unknown> = {}) => ({
    id: 'lead-1',
    workspaceId: 'workspace-1',
    funnelId: 'funnel-1',
    funnelInstanceId: 'funnel-instance-1',
    funnelPublicationId: 'publication-1',
    visitorId: null,
    sourceChannel: 'automation',
    fullName: 'Margarita DEMO',
    email: null,
    phone: '59169347532',
    companyName: null,
    status: 'assigned',
    currentAssignmentId: 'assignment-1',
    trafficLayer: 'DIRECT',
    originAdWheelId: null,
    tags: [],
    createdAt: new Date('2026-06-01T12:00:00.000Z'),
    updatedAt: new Date('2026-06-01T12:00:00.000Z'),
    ...overrides,
  });

  const buildAssignment = (overrides: Record<string, unknown> = {}) => ({
    id: 'assignment-1',
    ownershipKey: 'lf_own_3af5cca1a045f54d1834defd',
    workspaceId: 'workspace-1',
    leadId: 'lead-1',
    sponsorId: 'sponsor-1',
    teamId: 'team-1',
    funnelId: 'funnel-1',
    funnelInstanceId: 'funnel-instance-1',
    funnelPublicationId: 'publication-1',
    rotationPoolId: null,
    trafficLayer: 'DIRECT',
    originAdWheelId: null,
    status: 'assigned',
    reason: 'manual',
    assignedAt: new Date('2026-06-01T12:00:00.000Z'),
    acceptedAt: null,
    resolvedAt: null,
    createdAt: new Date('2026-06-01T12:00:00.000Z'),
    updatedAt: new Date('2026-06-01T12:00:00.000Z'),
    lead: buildLead(),
    ...overrides,
  });

  const buildPublication = () => ({
    id: 'publication-1',
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    domainId: 'domain-1',
    funnelInstanceId: 'funnel-instance-1',
    isActive: true,
    isPrimary: true,
    status: 'active',
    updatedAt: new Date('2026-06-01T12:00:00.000Z'),
    funnelInstance: {
      id: 'funnel-instance-1',
      funnelId: 'funnel-1',
    },
  });

  const buildSponsor = (overrides: Record<string, unknown> = {}) => ({
    id: 'sponsor-1',
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    status: 'active',
    isActive: true,
    ...overrides,
  });

  const buildOwnerConnection = () => ({
    id: 'connection-1',
    teamId: 'team-1',
    externalInstanceId: 'lf-freddycatuntadxn-freddy',
    sponsor: {
      id: 'sponsor-1',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
    },
  });

  const buildTx = () => ({
    $executeRaw: jest.fn().mockResolvedValue(1),
    $queryRaw: jest.fn(),
    assignment: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    lead: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    messagingConnection: {
      findFirst: jest.fn(),
    },
    channelInstance: {
      findFirst: jest.fn(),
    },
    sponsor: {
      findUnique: jest.fn(),
    },
    funnelPublication: {
      findFirst: jest.fn(),
    },
    domainEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
  });

  const buildService = (tx = buildTx()) => {
    const prisma = {
      $transaction: jest.fn((callback: (txArg: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const actionContextSyncService = {
      upsertForRemoteJid: jest.fn().mockResolvedValue({
        dispatched: true,
      }),
    };

    return {
      tx,
      prisma,
      actionContextSyncService,
      service: new InboundWhatsappLeadContextService(
        prisma as never,
        actionContextSyncService as never,
      ),
    };
  };

  const baseInput = {
    tenant_id: 'team-1',
    channel: 'whatsapp',
    instance_name: 'lf-freddycatuntadxn-freddy',
    remote_jid: '59169347532@s.whatsapp.net',
    push_name: 'Margarita DEMO',
    message_id: '3EB0772969CABD5CF0D300',
    source: 'n8n_inbound_whatsapp',
    service_owner_key: 'lead-handler',
    runtime_config_version: 'runtime-v1',
  };

  it('matches a visible ownership ref without creating a lead and upserts action_context', async () => {
    const tx = buildTx();
    const assignment = buildAssignment();
    const { service, actionContextSyncService } = buildService(tx);

    tx.$queryRaw.mockResolvedValue([{ id: 'assignment-1' }]);
    tx.assignment.findFirst.mockResolvedValue(assignment);

    await expect(
      service.ensureLeadContext({
        ...baseInput,
        instance_name: undefined,
        user_message:
          'Hola Freddy Catunta, soy Margarita DEMO. Ya completé mi registro.\n\nRef: 3AF5CCA1',
      }),
    ).resolves.toEqual({
      ok: true,
      match_source: 'ownership_ref',
      created: false,
      matched_existing: true,
      lead_id: 'lead-1',
      assignment_id: 'assignment-1',
      publication_id: 'publication-1',
      action_context: {
        provider: 'leadflow',
        lead_id: 'lead-1',
        assignment_id: 'assignment-1',
        publication_id: 'publication-1',
      },
    });

    expect(tx.lead.create).not.toHaveBeenCalled();
    expect(tx.assignment.create).not.toHaveBeenCalled();
    expect(tx.sponsor.findUnique).not.toHaveBeenCalled();
    expect(tx.messagingConnection.findFirst).not.toHaveBeenCalled();
    expect(tx.channelInstance.findFirst).not.toHaveBeenCalled();
    expect(actionContextSyncService.upsertForRemoteJid).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'team-1',
        remoteJid: '59169347532@s.whatsapp.net',
        leadId: 'lead-1',
        assignmentId: 'assignment-1',
        publicationId: 'publication-1',
      }),
    );
  });

  it('matches ownership refs case-insensitively', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    tx.$queryRaw.mockResolvedValue([{ id: 'assignment-1' }]);
    tx.assignment.findFirst.mockResolvedValue(buildAssignment());

    await expect(
      service.ensureLeadContext({
        ...baseInput,
        user_message: 'código de seguimiento: 3af5cca1',
      }),
    ).resolves.toMatchObject({
      match_source: 'ownership_ref',
      lead_id: 'lead-1',
      assignment_id: 'assignment-1',
    });
  });

  it('returns a controlled error when the ownership ref does not exist', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    tx.$queryRaw.mockResolvedValue([]);

    await expect(
      service.ensureLeadContext({
        ...baseInput,
        user_message: 'REF: 00000000',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a controlled conflict when the ownership ref matches multiple assignments', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    tx.$queryRaw.mockResolvedValue([
      { id: 'assignment-1' },
      { id: 'assignment-2' },
    ]);

    await expect(
      service.ensureLeadContext({
        ...baseInput,
        user_message: 'Codigo: 3AF5CCA1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reuses an existing lead by phone when it already has an active assignment', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    tx.messagingConnection.findFirst.mockResolvedValue(buildOwnerConnection());
    tx.$queryRaw.mockResolvedValue([{ id: 'lead-1' }]);
    tx.lead.findUnique.mockResolvedValue(buildLead());
    tx.assignment.findFirst.mockResolvedValue(buildAssignment());

    await expect(
      service.ensureLeadContext({
        ...baseInput,
        user_message: 'Hola, quiero información.',
      }),
    ).resolves.toMatchObject({
      match_source: 'phone',
      created: false,
      matched_existing: true,
      lead_id: 'lead-1',
      assignment_id: 'assignment-1',
    });

    expect(tx.lead.create).not.toHaveBeenCalled();
    expect(tx.assignment.create).not.toHaveBeenCalled();
    expect(tx.sponsor.findUnique).not.toHaveBeenCalled();
    expect(tx.messagingConnection.findFirst).not.toHaveBeenCalled();
    expect(tx.channelInstance.findFirst).not.toHaveBeenCalled();
  });

  it('creates an inbound lead and assignment when no ref or phone lead exists', async () => {
    const tx = buildTx();
    const createdLead = buildLead({
      id: 'lead-new',
      status: 'captured',
      currentAssignmentId: null,
    });
    const updatedLead = buildLead({
      id: 'lead-new',
      status: 'assigned',
      currentAssignmentId: 'assignment-new',
    });
    const createdAssignment = buildAssignment({
      id: 'assignment-new',
      leadId: 'lead-new',
      lead: updatedLead,
    });
    const { service } = buildService(tx);

    tx.messagingConnection.findFirst.mockResolvedValue(buildOwnerConnection());
    tx.$queryRaw.mockResolvedValue([]);
    tx.funnelPublication.findFirst.mockResolvedValue(buildPublication());
    tx.lead.create.mockResolvedValue(createdLead);
    tx.assignment.create.mockResolvedValue(createdAssignment);
    tx.lead.update.mockResolvedValue(updatedLead);

    await expect(
      service.ensureLeadContext({
        ...baseInput,
        user_message: 'Hola, quiero información.',
      }),
    ).resolves.toMatchObject({
      match_source: 'inbound_bootstrap',
      created: true,
      matched_existing: false,
      lead_id: 'lead-new',
      assignment_id: 'assignment-new',
      publication_id: 'publication-1',
    });

    expect(tx.lead.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceChannel: 'automation',
          phone: '59169347532',
          fullName: 'Margarita DEMO',
          funnelPublicationId: 'publication-1',
        }),
      }),
    );
    expect(tx.assignment.create).toHaveBeenCalledTimes(1);
  });

  it('creates an inbound lead and assignment from channel_binding.metadata.sponsor_id without local instance ownership', async () => {
    const tx = buildTx();
    const createdLead = buildLead({
      id: 'lead-new',
      status: 'captured',
      currentAssignmentId: null,
    });
    const updatedLead = buildLead({
      id: 'lead-new',
      status: 'assigned',
      currentAssignmentId: 'assignment-new',
    });
    const createdAssignment = buildAssignment({
      id: 'assignment-new',
      leadId: 'lead-new',
      lead: updatedLead,
    });
    const { service, actionContextSyncService } = buildService(tx);

    tx.$queryRaw.mockResolvedValue([]);
    tx.sponsor.findUnique.mockResolvedValue(buildSponsor());
    tx.funnelPublication.findFirst.mockResolvedValue(buildPublication());
    tx.lead.create.mockResolvedValue(createdLead);
    tx.assignment.create.mockResolvedValue(createdAssignment);
    tx.lead.update.mockResolvedValue(updatedLead);

    await expect(
      service.ensureLeadContext({
        ...baseInput,
        instance_name: undefined,
        user_message: 'Hola, quiero información.',
        channel_binding: {
          provider: 'evolution',
          channel: 'whatsapp',
          instance_name: 'runtime-instance',
          number_id: null,
          metadata: {
            sponsor_id: 'sponsor-1',
          },
        },
      }),
    ).resolves.toMatchObject({
      match_source: 'inbound_bootstrap',
      created: true,
      matched_existing: false,
      lead_id: 'lead-new',
      assignment_id: 'assignment-new',
    });

    expect(tx.messagingConnection.findFirst).not.toHaveBeenCalled();
    expect(tx.channelInstance.findFirst).not.toHaveBeenCalled();
    expect(tx.lead.create).toHaveBeenCalledTimes(1);
    expect(tx.assignment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sponsorId: 'sponsor-1',
          teamId: 'team-1',
        }),
      }),
    );
    expect(actionContextSyncService.upsertForRemoteJid).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          match_source: 'inbound_bootstrap',
          owner_resolution_source: 'channel_binding_metadata',
          channel_binding_instance_name: 'runtime-instance',
          channel_binding_provider: 'evolution',
          channel_binding_number_id: null,
          inbound_source: 'n8n_inbound_whatsapp',
        }),
      }),
    );
  });

  it('assigns an existing phone lead without duplicating it when channel_binding.metadata.sponsor_id is valid', async () => {
    const tx = buildTx();
    const existingLead = buildLead({
      status: 'captured',
      currentAssignmentId: null,
    });
    const updatedLead = buildLead({
      status: 'assigned',
      currentAssignmentId: 'assignment-new',
    });
    const createdAssignment = buildAssignment({
      id: 'assignment-new',
      lead: updatedLead,
    });
    const { service } = buildService(tx);

    tx.$queryRaw.mockResolvedValue([{ id: 'lead-1' }]);
    tx.lead.findUnique.mockResolvedValue(existingLead);
    tx.assignment.findFirst.mockResolvedValue(null);
    tx.sponsor.findUnique.mockResolvedValue(buildSponsor());
    tx.assignment.create.mockResolvedValue(createdAssignment);
    tx.lead.update.mockResolvedValue(updatedLead);

    await expect(
      service.ensureLeadContext({
        ...baseInput,
        user_message: 'Hola, quiero información.',
        channel_binding: {
          channel: 'whatsapp',
          metadata: {
            sponsor_id: 'sponsor-1',
          },
        },
      }),
    ).resolves.toMatchObject({
      match_source: 'phone',
      created: false,
      matched_existing: true,
      lead_id: 'lead-1',
      assignment_id: 'assignment-new',
    });

    expect(tx.lead.create).not.toHaveBeenCalled();
    expect(tx.assignment.create).toHaveBeenCalledTimes(1);
    expect(tx.messagingConnection.findFirst).not.toHaveBeenCalled();
    expect(tx.channelInstance.findFirst).not.toHaveBeenCalled();
  });

  it('returns a controlled owner_not_found error when channel_binding.metadata.sponsor_id does not exist', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    tx.$queryRaw.mockResolvedValue([]);
    tx.sponsor.findUnique.mockResolvedValue(null);

    await expect(
      service.ensureLeadContext({
        ...baseInput,
        user_message: 'Hola, quiero información.',
        channel_binding: {
          channel: 'whatsapp',
          metadata: {
            sponsor_id: 'missing-sponsor',
          },
        },
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        reason: 'owner_not_found',
      }),
    });

    expect(tx.lead.create).not.toHaveBeenCalled();
    expect(tx.assignment.create).not.toHaveBeenCalled();
  });

  it('returns a controlled error when channel_binding.metadata.sponsor_id belongs to another tenant', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    tx.$queryRaw.mockResolvedValue([]);
    tx.sponsor.findUnique.mockResolvedValue(
      buildSponsor({
        teamId: 'team-2',
      }),
    );

    await expect(
      service.ensureLeadContext({
        ...baseInput,
        user_message: 'Hola, quiero información.',
        channel_binding: {
          channel: 'whatsapp',
          metadata: {
            sponsor_id: 'sponsor-foreign',
          },
        },
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        reason: 'owner_not_found',
      }),
    });

    expect(tx.lead.create).not.toHaveBeenCalled();
    expect(tx.assignment.create).not.toHaveBeenCalled();
  });

  it('keeps the ChannelInstance fallback when no channel_binding owner metadata is available', async () => {
    const tx = buildTx();
    const createdLead = buildLead({
      id: 'lead-new',
      status: 'captured',
      currentAssignmentId: null,
    });
    const updatedLead = buildLead({
      id: 'lead-new',
      status: 'assigned',
      currentAssignmentId: 'assignment-new',
    });
    const createdAssignment = buildAssignment({
      id: 'assignment-new',
      leadId: 'lead-new',
      lead: updatedLead,
    });
    const { service, actionContextSyncService } = buildService(tx);

    tx.$queryRaw.mockResolvedValue([]);
    tx.messagingConnection.findFirst.mockResolvedValue(null);
    tx.channelInstance.findFirst.mockResolvedValue({
      id: 'channel-instance-1',
      tenantId: 'team-1',
      instanceName: 'lf-freddycatuntadxn-freddy',
      member: {
        id: 'sponsor-1',
        workspaceId: 'workspace-1',
        teamId: 'team-1',
      },
    });
    tx.funnelPublication.findFirst.mockResolvedValue(buildPublication());
    tx.lead.create.mockResolvedValue(createdLead);
    tx.assignment.create.mockResolvedValue(createdAssignment);
    tx.lead.update.mockResolvedValue(updatedLead);

    await expect(
      service.ensureLeadContext({
        ...baseInput,
        user_message: 'Hola, quiero información.',
      }),
    ).resolves.toMatchObject({
      match_source: 'inbound_bootstrap',
      created: true,
      lead_id: 'lead-new',
    });

    expect(tx.sponsor.findUnique).not.toHaveBeenCalled();
    expect(tx.messagingConnection.findFirst).toHaveBeenCalledTimes(1);
    expect(tx.channelInstance.findFirst).toHaveBeenCalledTimes(1);
    expect(actionContextSyncService.upsertForRemoteJid).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          owner_resolution_source: 'channel_instance',
        }),
      }),
    );
  });

  it('does not duplicate lead or assignment when the same remote_jid is repeated', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    tx.messagingConnection.findFirst.mockResolvedValue(buildOwnerConnection());
    tx.$queryRaw.mockResolvedValue([{ id: 'lead-1' }]);
    tx.lead.findUnique.mockResolvedValue(buildLead());
    tx.assignment.findFirst.mockResolvedValue(buildAssignment());

    await service.ensureLeadContext({
      ...baseInput,
      user_message: 'Hola, quiero información.',
    });
    await service.ensureLeadContext({
      ...baseInput,
      user_message: 'Hola, quiero información.',
    });

    expect(tx.lead.create).not.toHaveBeenCalled();
    expect(tx.assignment.create).not.toHaveBeenCalled();
    expect(tx.assignment.findFirst).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid remote_jid with a controlled 400', async () => {
    const { service } = buildService();

    await expect(
      service.ensureLeadContext({
        ...baseInput,
        remote_jid: 'not-a-jid',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
