import type { ConfigService } from '@nestjs/config';
import { EvolutionApiClient } from './evolution-api.client';

const buildConfigService = (
  values: Record<string, string | undefined>,
): ConfigService =>
  ({
    get: (key: string) => values[key],
  }) as ConfigService;

describe('EvolutionApiClient', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('builds the inbound webhook URL using API_INTERNAL_BASE_URL and the shared secret', () => {
    const client = new EvolutionApiClient(
      buildConfigService({
        EVOLUTION_API_INTERNAL_BASE_URL: 'http://evolution_api_v2:8080',
        EVOLUTION_API_KEY: 'test-api-key',
        API_INTERNAL_BASE_URL: 'http://leadflow_api:3001',
        INCOMING_MESSAGING_WEBHOOK_SECRET: 'secret 123',
      }),
    );

    expect(client.buildInboundWebhookUrl('instance-1')).toBe(
      'http://leadflow_api:3001/v1/incoming-webhooks/messaging?secret=secret+123',
    );
  });

  it('falls back to process.env and the default internal api base url for webhook registration', () => {
    const previousApiInternalBaseUrl = process.env.API_INTERNAL_BASE_URL;
    delete process.env.API_INTERNAL_BASE_URL;

    const client = new EvolutionApiClient(
      buildConfigService({
        EVOLUTION_API_INTERNAL_BASE_URL: 'http://evolution_api_v2:8080',
        EVOLUTION_API_KEY: 'test-api-key',
      }),
    );

    expect(client.buildInboundWebhookUrl('instance-1')).toBe(
      'http://leadflow_api:3001/v1/incoming-webhooks/messaging',
    );

    if (previousApiInternalBaseUrl === undefined) {
      delete process.env.API_INTERNAL_BASE_URL;
    } else {
      process.env.API_INTERNAL_BASE_URL = previousApiInternalBaseUrl;
    }
  });

  it('warns and returns false when webhook registration fails', async () => {
    const client = new EvolutionApiClient(
      buildConfigService({
        EVOLUTION_API_INTERNAL_BASE_URL: 'http://evolution_api_v2:8080',
        EVOLUTION_API_KEY: 'test-api-key',
        API_INTERNAL_BASE_URL: 'http://leadflow_api:3001',
        INCOMING_MESSAGING_WEBHOOK_SECRET: 'secret-123',
        EVOLUTION_QR_POLL_ATTEMPTS: '1',
        EVOLUTION_QR_POLL_DELAY_MS: '1',
      }),
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    (client as unknown as { request: jest.Mock }).request = jest
      .fn()
      .mockResolvedValue({
        status: 500,
        data: {
          message: 'boom',
        },
        baseUrl: 'http://evolution_api_v2:8080',
      });

    await expect(
      client.setWebhook(
        'instance-1',
        'http://leadflow_api:3001/v1/incoming-webhooks/messaging?secret=secret-123',
      ),
    ).resolves.toBe(false);

    expect(warnSpy).toHaveBeenCalledWith(
      'EVOLUTION_WEBHOOK_SET_FAILED:',
      expect.objectContaining({
        instanceId: 'instance-1',
        webhookUrl:
          'http://leadflow_api:3001/v1/incoming-webhooks/messaging?secret=secret-123',
      }),
    );
  });

  it('retries qr fetches on 404 until the instance becomes available', async () => {
    jest.useFakeTimers();
    const client = new EvolutionApiClient(
      buildConfigService({
        EVOLUTION_API_INTERNAL_BASE_URL: 'http://evolution_api_v2:8080',
        EVOLUTION_API_KEY: 'test-api-key',
        EVOLUTION_QR_POLL_ATTEMPTS: '2',
        EVOLUTION_QR_POLL_DELAY_MS: '1',
      }),
    );

    (client as unknown as { request: jest.Mock }).request = jest
      .fn()
      .mockResolvedValueOnce({
        status: 404,
        data: {
          message: 'Instance not found',
        },
        baseUrl: 'http://evolution_api_v2:8080',
      })
      .mockResolvedValueOnce({
        status: 201,
        data: {
          ok: true,
        },
        baseUrl: 'http://evolution_api_v2:8080',
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          base64: 'abc123',
        },
        baseUrl: 'http://evolution_api_v2:8080',
      });

    const pending = client.fetchQr('instance-1');
    await jest.advanceTimersByTimeAsync(2_000);

    await expect(pending).resolves.toMatchObject({
      qrCodeData: 'data:image/png;base64,abc123',
    });

    expect(
      ((client as unknown as { request: jest.Mock }).request as jest.Mock).mock
        .calls,
    ).toEqual([
      ['instance/connect/instance-1', { method: 'GET' }],
      [
        'instance/create',
        expect.objectContaining({
          method: 'POST',
        }),
      ],
      ['instance/connect/instance-1', { method: 'GET' }],
    ]);
  });

  it('sends the configured EVOLUTION_API_KEY on outbound requests', async () => {
    const client = new EvolutionApiClient(
      buildConfigService({
        EVOLUTION_API_INTERNAL_BASE_URL: 'http://evolution_api_v2:8080/',
        EVOLUTION_API_KEY: 'test-api-key',
      }),
    );
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      } as Response);

    await client.createInstance('instance-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://evolution_api_v2:8080/instance/create',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'test-api-key',
          'x-api-key': 'test-api-key',
          Authorization: 'Bearer test-api-key',
        }),
      }),
    );
  });

  it('creates the instance and retries the webhook once after a 404 without throwing', async () => {
    jest.useFakeTimers();
    const client = new EvolutionApiClient(
      buildConfigService({
        EVOLUTION_API_INTERNAL_BASE_URL: 'http://evolution_api_v2:8080/',
        EVOLUTION_API_KEY: 'test-api-key',
      }),
    );

    const requestMock = jest
      .fn()
      .mockResolvedValueOnce({
        status: 404,
        data: {
          message: 'Instance not found',
        },
        baseUrl: 'http://evolution_api_v2:8080/',
      })
      .mockResolvedValueOnce({
        status: 201,
        data: {
          ok: true,
        },
        baseUrl: 'http://evolution_api_v2:8080/',
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          ok: true,
        },
        baseUrl: 'http://evolution_api_v2:8080/',
      });

    (client as unknown as { request: jest.Mock }).request = requestMock;

    const pending = client.setWebhook(
      'instance-404',
      'http://leadflow_api:3001/v1/incoming-webhooks/messaging',
    );
    await jest.advanceTimersByTimeAsync(2_000);

    await expect(pending).resolves.toBe(true);

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      'webhook/set/instance-404',
      expect.any(Object),
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      'instance/create',
      expect.any(Object),
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      'webhook/set/instance-404',
      expect.any(Object),
    );
  });

  it('warns and continues when the webhook still fails after the self-healing retry', async () => {
    jest.useFakeTimers();
    const client = new EvolutionApiClient(
      buildConfigService({
        EVOLUTION_API_INTERNAL_BASE_URL: 'http://evolution_api_v2:8080/',
        EVOLUTION_API_KEY: 'test-api-key',
      }),
    );
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const requestMock = jest
      .fn()
      .mockResolvedValueOnce({
        status: 404,
        data: {
          message: 'Instance not found',
        },
        baseUrl: 'http://evolution_api_v2:8080/',
      })
      .mockResolvedValueOnce({
        status: 201,
        data: {
          ok: true,
        },
        baseUrl: 'http://evolution_api_v2:8080/',
      })
      .mockResolvedValueOnce({
        status: 404,
        data: {
          message: 'Still missing',
        },
        baseUrl: 'http://evolution_api_v2:8080/',
      });

    (client as unknown as { request: jest.Mock }).request = requestMock;

    const pending = client.setWebhook(
      'instance-404',
      'http://leadflow_api:3001/v1/incoming-webhooks/messaging',
    );
    await jest.advanceTimersByTimeAsync(2_000);

    await expect(pending).resolves.toBe(false);

    expect(warnSpy).toHaveBeenCalledWith(
      'EVOLUTION_WEBHOOK_SET_FAILED:',
      expect.objectContaining({
        instanceId: 'instance-404',
        webhookUrl: 'http://leadflow_api:3001/v1/incoming-webhooks/messaging',
      }),
    );
  });
});
