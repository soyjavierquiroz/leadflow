import { MessagingConnectionStatus } from '@prisma/client';
import { MessagingIntegrationsService } from './messaging-integrations.service';
import { EvolutionApiClientError } from './evolution-api.client';

describe('MessagingIntegrationsService', () => {
  const fixedNow = new Date('2026-04-21T12:00:00.000Z');

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const sponsor = {
    id: 'e7e109cf-6f0d-4ef8-af07-bc4a97f91234',
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    displayName: 'Ana Sponsor',
    phone: '+52 55 2222 3333',
    team: {
      code: 'north-sales',
    },
  };

  const scope = {
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    sponsorId: 'e7e109cf-6f0d-4ef8-af07-bc4a97f91234',
  };

  it('self-heals a missing instance during qr retrieval and reuses the canonical instance id', async () => {
    const expectedInstanceId = 'leadflow-north-sales-ana-sponsor-e7e109cf';
    const existingConnection = {
      id: 'connection-1',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      sponsorId: 'e7e109cf-6f0d-4ef8-af07-bc4a97f91234',
      status: MessagingConnectionStatus.error,
      provider: 'EVOLUTION',
      externalInstanceId: 'legacy-instance-name',
      phone: '+52 55 2222 3333',
      normalizedPhone: '525522223333',
      automationWebhookUrl: null,
      automationEnabled: false,
      qrCodeData: null,
      pairingCode: null,
      pairingExpiresAt: null,
      metadataJson: null,
      lastSyncedAt: fixedNow,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      lastErrorAt: fixedNow,
      lastErrorMessage: 'Instance not found',
      runtimeContextStatus: null,
      runtimeContextTenantId: 'workspace-1',
      runtimeContextRegisteredAt: null,
      runtimeContextReadyAt: null,
      runtimeContextLastCheckedAt: null,
      runtimeContextLastErrorAt: null,
      runtimeContextLastErrorMessage: null,
    };

    const prisma = {
      sponsor: {
        findFirst: jest.fn().mockResolvedValue(sponsor),
      },
      messagingConnection: {
        findFirst: jest.fn().mockResolvedValue(existingConnection),
        upsert: jest
          .fn()
          .mockResolvedValueOnce({
            ...existingConnection,
            externalInstanceId: expectedInstanceId,
            status: MessagingConnectionStatus.provisioning,
            qrCodeData: null,
            pairingCode: null,
            pairingExpiresAt: null,
            lastErrorAt: null,
            lastErrorMessage: null,
          })
          .mockResolvedValueOnce({
            ...existingConnection,
            externalInstanceId: expectedInstanceId,
            status: MessagingConnectionStatus.qr_ready,
            qrCodeData: 'data:image/png;base64,abc123',
            pairingCode: null,
            pairingExpiresAt: new Date('2026-04-21T12:05:00.000Z'),
            lastErrorAt: null,
            lastErrorMessage: null,
          }),
        update: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'connection-1',
          })
          .mockResolvedValueOnce({
            ...existingConnection,
            externalInstanceId: expectedInstanceId,
            status: MessagingConnectionStatus.qr_ready,
            qrCodeData: 'data:image/png;base64,abc123',
            pairingCode: null,
            pairingExpiresAt: new Date('2026-04-21T12:05:00.000Z'),
            lastErrorAt: null,
            lastErrorMessage: null,
          }),
      },
    };
    const evolutionClient = {
      isConfigured: jest.fn().mockReturnValue(true),
      getInstancePrefix: jest.fn().mockReturnValue('leadflow'),
      getAutomationWebhookBaseUrl: jest.fn().mockReturnValue(null),
      ensureInstanceExists: jest.fn().mockResolvedValue({
        exists: true,
        state: 'created',
        phone: null,
        normalizedPhone: null,
        raw: { state: 'created' },
      }),
      buildInboundWebhookUrl: jest
        .fn()
        .mockReturnValue('http://leadflow_api:3001/v1/incoming-webhooks/messaging'),
      shouldRegenerateQrSession: jest.fn().mockReturnValue(false),
      setWebhook: jest.fn().mockResolvedValue(true),
      fetchQr: jest.fn(),
      getConnectionState: jest
        .fn()
        .mockResolvedValueOnce({
          exists: false,
          state: null,
          phone: null,
          normalizedPhone: null,
          raw: { message: 'Instance not found' },
        })
        .mockResolvedValueOnce({
          exists: true,
          state: 'qrcode',
          phone: null,
          normalizedPhone: null,
          raw: { state: 'qrcode' },
        }),
      createInstance: jest.fn().mockResolvedValue({ status: 201 }),
      getRoutingMode: jest.fn().mockReturnValue('internal'),
    };
    const runtimeContextCentralService = {
      markConnectionProvisioned: jest.fn().mockResolvedValue(undefined),
      ensureConnectionReady: jest.fn().mockResolvedValue({ ready: true }),
    };
    const service = new MessagingIntegrationsService(
      prisma as never,
      evolutionClient as never,
      runtimeContextCentralService as never,
    );

    jest
      .spyOn(evolutionClient, 'fetchQr')
      .mockRejectedValueOnce(
        new EvolutionApiClientError(
          'EVOLUTION_INSTANCE_NOT_FOUND: missing instance',
          404,
        ),
      )
      .mockResolvedValueOnce({
        qrCodeData: 'data:image/png;base64,abc123',
        pairingCode: null,
        expiresAt: new Date('2026-04-21T12:05:00.000Z'),
        raw: { base64: 'abc123' },
      });

    const result = await service.getQrForMember(scope);

    expect(evolutionClient.createInstance).toHaveBeenCalledWith(
      expectedInstanceId,
    );
    expect(evolutionClient.setWebhook).toHaveBeenCalledWith(
      expectedInstanceId,
      'http://leadflow_api:3001/v1/incoming-webhooks/messaging',
    );
    expect(result.connectionStatus).toBe('qr_ready');
    expect(result.qrCode).toBe('data:image/png;base64,abc123');
    expect(
      prisma.messagingConnection.upsert.mock.calls[0]?.[0]?.update
        ?.externalInstanceId,
    ).toBe(expectedInstanceId);
  });

  it('regenerates the qr automatically on refresh when the remote state is LOGOUT', async () => {
    const existingConnection = {
      id: 'connection-1',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      sponsorId: 'e7e109cf-6f0d-4ef8-af07-bc4a97f91234',
      status: MessagingConnectionStatus.qr_ready,
      provider: 'EVOLUTION',
      externalInstanceId: 'leadflow-north-sales-ana-sponsor-sponsor-1',
      phone: '+52 55 2222 3333',
      normalizedPhone: '525522223333',
      automationWebhookUrl: null,
      automationEnabled: false,
      qrCodeData: 'data:image/png;base64,old',
      pairingCode: null,
      pairingExpiresAt: new Date('2026-04-21T12:03:00.000Z'),
      metadataJson: null,
      lastSyncedAt: fixedNow,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      runtimeContextStatus: null,
      runtimeContextTenantId: 'workspace-1',
      runtimeContextRegisteredAt: null,
      runtimeContextReadyAt: null,
      runtimeContextLastCheckedAt: null,
      runtimeContextLastErrorAt: null,
      runtimeContextLastErrorMessage: null,
    };

    const prisma = {
      sponsor: {
        findFirst: jest.fn().mockResolvedValue(sponsor),
      },
      messagingConnection: {
        findFirst: jest.fn().mockResolvedValue(existingConnection),
        upsert: jest
          .fn()
          .mockResolvedValueOnce({
            ...existingConnection,
            externalInstanceId: 'leadflow-north-sales-ana-sponsor-e7e109cf',
            status: MessagingConnectionStatus.provisioning,
            qrCodeData: null,
            pairingCode: null,
            pairingExpiresAt: null,
          })
          .mockResolvedValueOnce({
            ...existingConnection,
            externalInstanceId: 'leadflow-north-sales-ana-sponsor-e7e109cf',
            status: MessagingConnectionStatus.qr_ready,
            qrCodeData: 'data:image/png;base64,new',
            pairingCode: null,
            pairingExpiresAt: new Date('2026-04-21T12:05:00.000Z'),
          }),
        update: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'connection-1',
          })
          .mockResolvedValueOnce({
            ...existingConnection,
            externalInstanceId: 'leadflow-north-sales-ana-sponsor-e7e109cf',
            status: MessagingConnectionStatus.qr_ready,
            qrCodeData: 'data:image/png;base64,new',
            pairingCode: null,
            pairingExpiresAt: new Date('2026-04-21T12:05:00.000Z'),
          }),
      },
    };
    const evolutionClient = {
      isConfigured: jest.fn().mockReturnValue(true),
      getConnectionState: jest
        .fn()
        .mockResolvedValueOnce({
          exists: true,
          state: 'LOGOUT',
          phone: null,
          normalizedPhone: null,
          raw: { state: 'LOGOUT' },
        })
        .mockResolvedValueOnce({
          exists: true,
          state: 'created',
          phone: null,
          normalizedPhone: null,
          raw: { state: 'created' },
        })
        .mockResolvedValueOnce({
          exists: true,
          state: 'qrcode',
          phone: null,
          normalizedPhone: null,
          raw: { state: 'qrcode' },
        }),
      shouldRegenerateQrSession: jest.fn().mockReturnValue(true),
      getInstancePrefix: jest.fn().mockReturnValue('leadflow'),
      getAutomationWebhookBaseUrl: jest.fn().mockReturnValue(null),
      ensureInstanceExists: jest.fn().mockResolvedValue({
        exists: true,
        state: 'created',
        phone: null,
        normalizedPhone: null,
        raw: { state: 'created' },
      }),
      buildInboundWebhookUrl: jest
        .fn()
        .mockReturnValue('http://leadflow_api:3001/v1/incoming-webhooks/messaging'),
      recreateInstance: jest.fn().mockResolvedValue(undefined),
      setWebhook: jest.fn().mockResolvedValue(true),
      fetchQr: jest.fn().mockResolvedValue({
        qrCodeData: 'data:image/png;base64,new',
        pairingCode: null,
        expiresAt: new Date('2026-04-21T12:05:00.000Z'),
        raw: { base64: 'new' },
      }),
      getRoutingMode: jest.fn().mockReturnValue('internal'),
    };
    const runtimeContextCentralService = {
      markConnectionProvisioned: jest.fn().mockResolvedValue(undefined),
      ensureConnectionReady: jest.fn().mockResolvedValue({ ready: true }),
    };
    const service = new MessagingIntegrationsService(
      prisma as never,
      evolutionClient as never,
      runtimeContextCentralService as never,
    );

    const result = await service.refreshForMember(scope);

    expect(evolutionClient.recreateInstance).toHaveBeenCalledWith(
      'leadflow-north-sales-ana-sponsor-e7e109cf',
    );
    expect(result.connectionStatus).toBe('qr_ready');
    expect(result.qrCode).toBe('data:image/png;base64,new');
  });
}
