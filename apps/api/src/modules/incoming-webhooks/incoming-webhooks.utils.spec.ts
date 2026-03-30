import {
  matchesIncomingWebhookSecret,
  readIncomingWebhookSecret,
} from './incoming-webhooks.utils';

describe('incoming-webhooks.utils', () => {
  it('reads the webhook secret from the dedicated header first', () => {
    expect(
      readIncomingWebhookSecret({
        'x-leadflow-webhook-secret': 'secret-123',
      }),
    ).toBe('secret-123');
  });

  it('falls back to bearer authorization when needed', () => {
    expect(
      readIncomingWebhookSecret({
        authorization: 'Bearer secret-456',
      }),
    ).toBe('secret-456');
  });

  it('matches webhook secrets using constant-time comparison', () => {
    expect(matchesIncomingWebhookSecret('shared-secret', 'shared-secret')).toBe(
      true,
    );
    expect(matchesIncomingWebhookSecret('shared-secret', 'wrong-secret')).toBe(
      false,
    );
  });
});
