import {
  buildDomainDnsInstructions,
  defaultVerificationMethodForDomainType,
  deriveDomainLifecycle,
} from './domain-onboarding.utils';

describe('domain onboarding utils', () => {
  it('resolves the default verification method per domain type', () => {
    expect(defaultVerificationMethodForDomainType('custom_subdomain')).toBe(
      'cname',
    );
    expect(defaultVerificationMethodForDomainType('custom_apex')).toBe('txt');
    expect(defaultVerificationMethodForDomainType('system_subdomain')).toBe(
      'none',
    );
  });

  it('builds a CNAME instruction for custom subdomains', () => {
    const instructions = buildDomainDnsInstructions({
      host: 'promo.cliente.com',
      domainType: 'custom_subdomain',
      dnsTarget: 'proxy-fallback.exitosos.com',
      verificationMethod: 'cname',
      cloudflareStatusJson: null,
    });

    expect(instructions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'cname',
          host: 'promo.cliente.com',
          value: 'proxy-fallback.exitosos.com',
        }),
      ]),
    );
  });

  it('marks a managed custom hostname as active when hostname and ssl are active', () => {
    const lifecycle = deriveDomainLifecycle({
      domainType: 'custom_subdomain',
      dnsTarget: 'proxy-fallback.exitosos.com',
      cloudflareCustomHostnameId: 'cf-hostname-1',
      cloudflareStatusJson: {
        id: 'cf-hostname-1',
        hostname: 'promo.cliente.com',
        status: 'active',
        customOriginServer: 'proxy-fallback.exitosos.com',
        verificationErrors: [],
        ownershipVerification: null,
        ssl: {
          status: 'active',
          method: 'txt',
          type: 'dv',
          validationErrors: [],
          validationRecords: [],
        },
        error: null,
        raw: null,
      },
    });

    expect(lifecycle.status).toBe('active');
    expect(lifecycle.onboardingStatus).toBe('active');
    expect(lifecycle.verificationStatus).toBe('verified');
    expect(lifecycle.sslStatus).toBe('active');
  });

  it('keeps a custom hostname in pending_dns before Cloudflare activation', () => {
    const lifecycle = deriveDomainLifecycle({
      domainType: 'custom_subdomain',
      dnsTarget: 'proxy-fallback.exitosos.com',
      cloudflareCustomHostnameId: null,
      cloudflareStatusJson: null,
    });

    expect(lifecycle.status).toBe('draft');
    expect(lifecycle.onboardingStatus).toBe('pending_dns');
    expect(lifecycle.verificationStatus).toBe('pending');
    expect(lifecycle.sslStatus).toBe('pending');
  });
});
