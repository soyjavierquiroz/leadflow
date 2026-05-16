import * as crypto from 'crypto';
import { KloserApiClient } from './kloser-api.client';

describe('KloserApiClient', () => {
  const fixedNow = '2026-05-16T10:00:00.000Z';

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(fixedNow));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    delete process.env.KLOSER_API_URL;
    delete process.env.KLOSER_HMAC_SECRET;
    delete process.env.KLOSER_REQUEST_TIMEOUT_MS;
    jest.restoreAllMocks();
  });

  it('signs createMission requests as HMAC_SHA256(Timestamp.Nonce.RawBody, Secret)', async () => {
    process.env.KLOSER_API_URL = 'https://kloser.example.com/api/v1/';
    process.env.KLOSER_HMAC_SECRET = 'test-secret';

    const nonce =
      '00000000-0000-4000-8000-000000000000' as ReturnType<
        typeof crypto.randomUUID
      >;

    jest.spyOn(crypto, 'randomUUID').mockReturnValue(nonce);

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 202,
      text: jest.fn(),
    } as unknown as Response);
    const client = new KloserApiClient();
    const payload = {
      tenant_id: 'team-1',
      lead_id: 'lead-1',
      remote_jid: '525512345678@s.whatsapp.net',
      strategy_id: 'strategy-1',
    };

    await client.createMission(payload);

    const rawBody = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', 'test-secret')
      .update(`1778925600.${nonce}.${rawBody}`)
      .digest('hex');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://kloser.example.com/api/v1/missions',
      expect.objectContaining({
        method: 'POST',
        body: rawBody,
        headers: {
          'Content-Type': 'application/json',
          'X-Kloser-Timestamp': '1778925600',
          'X-Kloser-Nonce': nonce,
          'X-Kloser-Signature': expectedSignature,
        },
      }),
    );
  });

  it('returns false instead of throwing when Kloser is unavailable', async () => {
    process.env.KLOSER_HMAC_SECRET = 'test-secret';

    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

    const client = new KloserApiClient();

    await expect(client.createMission({ lead_id: 'lead-1' })).resolves.toBe(
      false,
    );
  });

  it('fires cancelMission without waiting for Kloser to respond', async () => {
    process.env.KLOSER_API_URL = 'https://kloser.example.com/api/v1';
    process.env.KLOSER_HMAC_SECRET = 'test-secret';

    let resolveFetch: (response: Response) => void = () => undefined;
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
      );

    const client = new KloserApiClient();

    await expect(
      client.cancelMission(
        'team-1',
        '525512345678@s.whatsapp.net',
        'strategy-1',
        'lead_inbound_message',
      ),
    ).resolves.toBeUndefined();

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://kloser.example.com/api/v1/missions/cancel',
      expect.objectContaining({
        method: 'POST',
      }),
    );

    resolveFetch({
      ok: true,
      status: 202,
      text: jest.fn(),
    } as unknown as Response);
    await Promise.resolve();
  });
});
