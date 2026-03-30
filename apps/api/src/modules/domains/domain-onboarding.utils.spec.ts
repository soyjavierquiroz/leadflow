import {
  buildDomainDnsInstructions,
  defaultVerificationMethodForDomainType,
  deriveLegacyDomainState,
  deriveDomainLifecycle,
  toCloudflareSslMethod,
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
      dnsTarget: 'customers.leadflow.kurukin.com',
      verificationMethod: 'cname',
      cloudflareStatusJson: null,
      fallbackOrigin: 'proxy-fallback.leadflow.kurukin.com',
    });

    expect(instructions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'cname',
          host: 'promo.cliente.com',
          value: 'customers.leadflow.kurukin.com',
        }),
      ]),
    );
  });

  it('maps the simple cname flow to Cloudflare HTTP validation', () => {
    expect(toCloudflareSslMethod('cname')).toBe('http');
    expect(toCloudflareSslMethod('http')).toBe('http');
    expect(toCloudflareSslMethod('txt')).toBe('txt');
  });

  it('marks a managed custom hostname as active when hostname and ssl are active', () => {
    const lifecycle = deriveDomainLifecycle({
      domainType: 'custom_subdomain',
      dnsTarget: 'customers.leadflow.kurukin.com',
      cloudflareCustomHostnameId: 'cf-hostname-1',
      cloudflareStatusJson: {
        id: 'cf-hostname-1',
        hostname: 'promo.cliente.com',
        status: 'active',
        customOriginServer: 'proxy-fallback.leadflow.kurukin.com',
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
      dnsTarget: 'customers.leadflow.kurukin.com',
      cloudflareCustomHostnameId: null,
      cloudflareStatusJson: null,
    });

    expect(lifecycle.status).toBe('draft');
    expect(lifecycle.onboardingStatus).toBe('pending_dns');
    expect(lifecycle.verificationStatus).toBe('pending');
    expect(lifecycle.sslStatus).toBe('pending');
  });

  it('marks legacy dns targets as requiring recreation', () => {
    const legacy = deriveLegacyDomainState(
      {
        domainType: 'custom_subdomain',
        dnsTarget: 'legacy-saas-target.example.net',
        cloudflareStatusJson: {
          id: 'cf-hostname-legacy',
          hostname: 'www.retodetransformacion.com',
          status: 'active',
          customOriginServer: 'legacy-origin.example.net',
          verificationErrors: [],
          ownershipVerification: null,
          ssl: {
            status: 'active',
            method: 'http',
            type: 'dv',
            validationErrors: [],
            validationRecords: [],
          },
          error: null,
          raw: null,
        },
      },
      {
        customerCnameTarget: 'customers.leadflow.kurukin.com',
        fallbackOrigin: 'proxy-fallback.leadflow.kurukin.com',
      },
    );

    expect(legacy.isLegacyConfiguration).toBe(true);
    expect(legacy.recreateRequired).toBe(true);
    expect(legacy.legacyReason).toContain('DNS target legado');
    expect(legacy.legacyReason).toContain('fallback origin legado');
  });
});
