import {
  buildAutomationWebhookUrl,
  buildEvolutionInstanceId,
  normalizeMessagingPhone,
  normalizeQrCodeData,
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
        'https://n8n.exitosos.com/webhook/leadflow',
        'leadflow-north-ana',
      ),
    ).toBe('https://n8n.exitosos.com/webhook/leadflow/leadflow-north-ana');
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
});
