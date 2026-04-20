import {
  buildAutomationWebhookUrl,
  buildEvolutionInstanceId,
  isDisconnectedEvolutionState,
  isQrExpired,
  normalizeMessagingPhone,
  normalizeQrCodeData,
  resolveQrExpiresAt,
  resolveMessagingConnectionStatus,
} from './messaging-integrations.utils';

describe('messaging integrations utils', () => {
  it('normalizes phones and qr payloads', () => {
    expect(normalizeMessagingPhone('+52 (55) 5000-0099')).toBe('525550000099');
    expect(normalizeQrCodeData('abc123')).toBe('data:image/png;base64,abc123');
  });

  it('builds stable instance ids and automation webhook urls', () => {
    expect(
      buildEvolutionInstanceId({
        prefix: 'Leadflow Staging',
        teamCode: 'north-sales',
        sponsorDisplayName: 'Ana Sponsor',
        sponsorId: 'e7e109cf-6f0d-4ef8-af07-bc4a97f91234',
      }),
    ).toBe('leadflow-staging-north-sales-ana-sponsor-e7e109cf');

    expect(
      buildAutomationWebhookUrl(
        'https://n8n.leadflow.kuruk.in/webhook/leadflow',
        'leadflow-north-ana',
      ),
    ).toBe(
      'https://n8n.leadflow.kuruk.in/webhook/leadflow/leadflow-north-ana',
    );
  });

  it('maps qr and connection states to the persisted status', () => {
    expect(
      resolveMessagingConnectionStatus({
        state: 'open',
      }),
    ).toBe('connected');

    expect(
      resolveMessagingConnectionStatus({
        state: 'close',
        qrCodeData: 'abc123',
      }),
    ).toBe('qr_ready');

    expect(
      resolveMessagingConnectionStatus({
        state: 'pairing',
      }),
    ).toBe('connecting');

    expect(
      resolveMessagingConnectionStatus({
        state: null,
        assumeProvisioning: true,
      }),
    ).toBe('provisioning');
  });

  it('derives qr expiration from ttl and explicit timestamps', () => {
    const now = new Date('2026-04-20T12:00:00.000Z');

    expect(
      resolveQrExpiresAt({
        payload: {
          ttl: 60,
        },
        now,
      })?.toISOString(),
    ).toBe('2026-04-20T12:01:00.000Z');

    expect(
      resolveQrExpiresAt({
        payload: {
          qrcode: {
            expiresAt: '2026-04-20T12:03:00.000Z',
          },
        },
        now,
      })?.toISOString(),
    ).toBe('2026-04-20T12:03:00.000Z');
  });

  it('detects expired qr timestamps and disconnected remote states', () => {
    const now = new Date('2026-04-20T12:05:00.000Z');

    expect(isQrExpired('2026-04-20T12:04:59.000Z', now)).toBe(true);
    expect(isQrExpired('2026-04-20T12:05:10.000Z', now)).toBe(false);
    expect(isDisconnectedEvolutionState('DISCONNECTED')).toBe(true);
    expect(isDisconnectedEvolutionState('connecting')).toBe(false);
  });
});
