import { IdentityTokenService } from './identity-token.service';

describe('IdentityTokenService', () => {
  const originalTtl = process.env.IDENTITY_TOKEN_TTL_HOURS;

  afterEach(() => {
    if (originalTtl === undefined) {
      delete process.env.IDENTITY_TOKEN_TTL_HOURS;
    } else {
      process.env.IDENTITY_TOKEN_TTL_HOURS = originalTtl;
    }
  });

  it('hashToken is deterministic for the same token', () => {
    const service = new IdentityTokenService();

    expect(service.hashToken('ctx-token')).toBe(service.hashToken('ctx-token'));
  });

  it('hashToken changes when the token changes', () => {
    const service = new IdentityTokenService();

    expect(service.hashToken('ctx-token-a')).not.toBe(
      service.hashToken('ctx-token-b'),
    );
  });

  it('getDefaultExpiresAt uses the configured ttl', () => {
    process.env.IDENTITY_TOKEN_TTL_HOURS = '2';
    const service = new IdentityTokenService();
    const now = new Date('2026-05-30T12:00:00.000Z');

    expect(service.getDefaultExpiresAt(now)?.toISOString()).toBe(
      '2026-05-30T14:00:00.000Z',
    );
  });
});
