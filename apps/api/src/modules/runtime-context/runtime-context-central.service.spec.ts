import { MessagingRuntimeContextStatus } from '@prisma/client';
import { RuntimeContextCentralService } from './runtime-context-central.service';

const buildResponse = (status: number, data: unknown) =>
  ({
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  }) as unknown as Response;

describe('RuntimeContextCentralService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('falls back to the v1 register route when /register returns 404', async () => {
    process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL =
      'http://runtime-context.example';
    delete process.env.RUNTIME_CONTEXT_MODE;

    const prisma = {
      messagingConnection: {
        update: jest.fn().mockResolvedValue(null),
      },
    } as never;
    const service = new RuntimeContextCentralService(prisma);
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(buildResponse(404, { code: 'NOT_FOUND' }))
      .mockResolvedValueOnce(buildResponse(201, { ok: true }));

    const result = await service.registerInstanceInRuntimeContext({
      instanceName: 'instance-1',
      tenantId: 'tenant-1',
    });

    expect(result.status).toBe(201);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      'http://runtime-context.example/register',
    );
    expect(fetchSpy.mock.calls[1]?.[0]).toBe(
      'http://runtime-context.example/v1/context/register',
    );
  });

  it('uses local persistence fallback in optional mode when remote register paths return 404', async () => {
    process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL =
      'http://runtime-context.example';
    process.env.RUNTIME_CONTEXT_MODE = 'optional';

    const prisma = {
      messagingConnection: {
        update: jest.fn().mockResolvedValue(null),
      },
    } as never;
    const service = new RuntimeContextCentralService(prisma);

    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(buildResponse(404, { code: 'NOT_FOUND' }))
      .mockResolvedValueOnce(buildResponse(404, { code: 'NOT_FOUND' }));

    const result = await service.ensureConnectionReady({
      id: 'conn-1',
      workspaceId: 'workspace-1',
      externalInstanceId: 'instance-1',
      runtimeContextStatus: MessagingRuntimeContextStatus.PROVISIONED,
      runtimeContextTenantId: 'workspace-1',
    });

    expect(result).toEqual({
      ready: true,
      resolution: {
        mode: 'local',
        reason: 'Runtime context register failed with HTTP 404',
      },
    });
    expect(prisma.messagingConnection.update).toHaveBeenCalledWith({
      where: {
        id: 'conn-1',
      },
      data: expect.objectContaining({
        runtimeContextStatus: MessagingRuntimeContextStatus.READY,
        runtimeContextTenantId: 'workspace-1',
        runtimeContextLastErrorAt: null,
        runtimeContextLastErrorMessage: null,
      }),
    });
  });

  it('uses local persistence fallback in optional mode when central is not configured', async () => {
    delete process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL;
    process.env.RUNTIME_CONTEXT_MODE = 'optional';

    const prisma = {
      messagingConnection: {
        update: jest.fn().mockResolvedValue(null),
      },
    } as never;
    const service = new RuntimeContextCentralService(prisma);

    const result = await service.ensureConnectionReady({
      id: 'conn-2',
      workspaceId: 'workspace-2',
      externalInstanceId: 'instance-2',
      runtimeContextStatus: MessagingRuntimeContextStatus.PROVISIONED,
      runtimeContextTenantId: 'workspace-2',
    });

    expect(result).toEqual({
      ready: true,
      resolution: {
        mode: 'local',
        reason:
          'Runtime Context Central is not configured. Local persistence fallback was used.',
      },
    });
    expect(prisma.messagingConnection.update).toHaveBeenCalledTimes(1);
  });
});
