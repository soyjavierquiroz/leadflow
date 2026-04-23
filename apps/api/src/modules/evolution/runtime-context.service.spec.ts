import { ServiceUnavailableException } from '@nestjs/common';
import { RuntimeContextService } from './runtime-context.service';

const buildResponse = (status: number, data: unknown) =>
  ({
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  }) as unknown as Response;

describe('RuntimeContextService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('posts the admin upsert payload with internal auth headers', async () => {
    process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL =
      'http://runtime-context.example/';
    process.env.RUNTIME_CONTEXT_CENTRAL_API_KEY = 'secret-key';

    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(buildResponse(201, { ok: true }));
    const service = new RuntimeContextService();

    await service.registerBinding({
      instanceName: 'lf-dxn-freddy',
      tenantId: 'team-123',
      verticalKey: 'mlm',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://runtime-context.example/v1/admin/channel-bindings/upsert',
      {
        method: 'POST',
        signal: expect.any(AbortSignal),
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': 'secret-key',
          'x-service-key': 'leadflow-api',
        },
        body: JSON.stringify({
          provider: 'evolution',
          channel: 'whatsapp',
          instance_name: 'lf-dxn-freddy',
          tenant_id: 'team-123',
          service_owner_key: 'lead-handler',
          status: 'active',
          source_system: 'leadflow',
          vertical_key: 'mlm',
        }),
      },
    );
  });

  it('avoids duplicating the v1 prefix when the runtime-context base url already includes it', async () => {
    process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL =
      'http://runtime-context.example/v1';
    process.env.RUNTIME_CONTEXT_CENTRAL_API_KEY = 'secret-key';

    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(buildResponse(201, { ok: true }));
    const service = new RuntimeContextService();

    await service.registerBinding({
      instanceName: 'lf-dxn-freddy',
      tenantId: 'team-123',
      verticalKey: 'mlm',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://runtime-context.example/v1/admin/channel-bindings/upsert',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('deletes the admin binding and treats 404 as an idempotent success', async () => {
    process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL =
      'http://runtime-context.example';
    process.env.RUNTIME_CONTEXT_CENTRAL_API_KEY = 'secret-key';

    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(buildResponse(404, { code: 'NOT_FOUND' }));
    const service = new RuntimeContextService();

    await expect(
      service.deleteBinding('lf-dxn-freddy'),
    ).resolves.toStrictEqual({
      success: true,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://runtime-context.example/v1/admin/channel-bindings/lf-dxn-freddy',
      {
        method: 'DELETE',
        signal: expect.any(AbortSignal),
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': 'secret-key',
          'x-service-key': 'leadflow-api',
        },
      },
    );
  });

  it('rejects admin upserts before sending a POST without a payload', async () => {
    process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL =
      'http://runtime-context.example/';
    process.env.RUNTIME_CONTEXT_CENTRAL_API_KEY = 'secret-key';

    const fetchSpy = jest.spyOn(global, 'fetch');
    const service = new RuntimeContextService();
    jest.spyOn(service as any, 'buildPayload').mockReturnValue(undefined);

    await expect(
      service.registerBinding({
        instanceName: 'lf-dxn-freddy',
        tenantId: 'team-123',
        verticalKey: 'mlm',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'RUNTIME_CONTEXT_UPSERT_PAYLOAD_REQUIRED',
      }),
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requires runtime context admin configuration before calling the service', async () => {
    delete process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL;
    delete process.env.RUNTIME_CONTEXT_URL;
    delete process.env.RUNTIME_CONTEXT_CENTRAL_API_KEY;
    delete process.env.RUNTIME_CONTEXT_INTERNAL_KEY;

    const service = new RuntimeContextService();

    await expect(
      service.registerBinding({
        instanceName: 'lf-dxn-freddy',
        tenantId: 'team-123',
        verticalKey: 'unknown',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('maps transport failures into a bad gateway error', async () => {
    process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL =
      'http://runtime-context.example';
    process.env.RUNTIME_CONTEXT_CENTRAL_API_KEY = 'secret-key';

    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('socket hang up'));
    const service = new RuntimeContextService();

    await expect(
      service.deleteBinding('lf-dxn-freddy'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'RUNTIME_CONTEXT_UNREACHABLE',
      }),
    });
  });
});
