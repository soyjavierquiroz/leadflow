import type { DomainRecord } from '../../prisma/prisma.mappers';
import { mapDomainRecord } from '../../prisma/prisma.mappers';
import type { PrismaService } from '../../prisma/prisma.service';
import type { DomainEntity } from './interfaces/domain.interface';
import type { CloudflareSaasClient } from './cloudflare-saas.client';
import { DomainsService } from './domains.service';

type DomainFindFirstArgs = Parameters<PrismaService['domain']['findFirst']>[0];
type DomainUpdateArgs = Parameters<PrismaService['domain']['update']>[0];
type TransactionCallback = Parameters<PrismaService['$transaction']>[0];

type PrismaMock = {
  $transaction: jest.Mock<
    ReturnType<PrismaService['$transaction']>,
    [TransactionCallback]
  >;
  domain: {
    findFirst: jest.Mock<Promise<DomainRecord | null>, [DomainFindFirstArgs]>;
    update: jest.Mock<Promise<DomainRecord>, [DomainUpdateArgs]>;
  };
};

type CloudflareSaasClientMock = {
  isConfigured: jest.Mock<boolean, []>;
  getFallbackOrigin: jest.Mock<string | null, []>;
  getCustomerCnameTarget: jest.Mock<string | null, []>;
  deleteCustomHostname: jest.Mock<Promise<void>, [string]>;
  createCustomHostname: jest.Mock;
  updateCustomHostname: jest.Mock;
  refreshCustomHostname: jest.Mock;
};

const buildDomainRecord = (
  overrides: Partial<DomainRecord> = {},
): DomainRecord => {
  const now = new Date('2026-03-27T00:00:00.000Z');

  return {
    id: 'domain-1',
    workspaceId: 'workspace-1',
    teamId: 'team-1',
    host: 'www.retodetransformacion.com',
    normalizedHost: 'www.retodetransformacion.com',
    status: 'active',
    onboardingStatus: 'active',
    domainType: 'custom_subdomain',
    isPrimary: false,
    canonicalHost: 'www.retodetransformacion.com',
    redirectToPrimary: false,
    verificationStatus: 'verified',
    sslStatus: 'active',
    verificationMethod: 'cname',
    cloudflareCustomHostnameId: 'cf-hostname-1',
    cloudflareStatusJson: null,
    dnsTarget: 'legacy-saas-target.example.net',
    lastCloudflareSyncAt: now,
    activatedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

const buildDomainEntity = (record: DomainRecord): DomainEntity =>
  mapDomainRecord(record);

describe('DomainsService', () => {
  const scope = {
    workspaceId: 'workspace-1',
    teamId: 'team-1',
  };

  const createService = () => {
    const findFirst = jest.fn<
      Promise<DomainRecord | null>,
      [DomainFindFirstArgs]
    >();
    const updateMany = jest.fn<Promise<{ count: number }>, [unknown]>();
    const update = jest.fn<Promise<DomainRecord>, [DomainUpdateArgs]>();
    const transaction = jest.fn<
      ReturnType<PrismaService['$transaction']>,
      [TransactionCallback]
    >(async (callback) => {
      const tx = {
        domain: {
          updateMany,
          update,
        },
      };

      return callback(tx as never);
    });

    const prisma: PrismaMock = {
      $transaction: transaction,
      domain: {
        findFirst,
        update,
      },
    };

    const cloudflareSaasClient: CloudflareSaasClientMock = {
      isConfigured: jest.fn(() => true),
      getFallbackOrigin: jest.fn(() => 'proxy-fallback.leadflow.kurukin.com'),
      getCustomerCnameTarget: jest.fn(() => 'customers.leadflow.kurukin.com'),
      deleteCustomHostname: jest.fn<Promise<void>, [string]>(() =>
        Promise.resolve(),
      ),
      createCustomHostname: jest.fn(),
      updateCustomHostname: jest.fn(),
      refreshCustomHostname: jest.fn(),
    };

    return {
      service: new DomainsService(
        prisma as unknown as PrismaService,
        cloudflareSaasClient as unknown as CloudflareSaasClient,
      ),
      findFirst,
      updateMany,
      update,
    };
  };

  it('recreates onboarding without request body using the persisted domain as source of truth', async () => {
    const { service, findFirst, update } = createService();
    const existingRecord = buildDomainRecord();
    const updatedRecord = buildDomainRecord({
      status: 'draft',
      onboardingStatus: 'pending_dns',
      verificationStatus: 'pending',
      sslStatus: 'pending',
      dnsTarget: 'customers.leadflow.kurukin.com',
      cloudflareCustomHostnameId: null,
      cloudflareStatusJson: null,
      lastCloudflareSyncAt: null,
      activatedAt: null,
    });

    findFirst.mockResolvedValue(existingRecord);
    update.mockResolvedValue(updatedRecord);

    const deleteCustomHostnameSpy = jest
      .spyOn(service as any, 'deleteCloudflareCustomHostname')
      .mockImplementation(async () => undefined);
    const syncDomainToCloudflareSpy = jest
      .spyOn(service as any, 'syncDomainToCloudflare')
      .mockImplementation(async () => buildDomainEntity(updatedRecord));

    const result = await service.recreateOnboardingForTeam(scope, 'domain-1');
    const updateCall = update.mock.calls[0]?.[0];

    expect(deleteCustomHostnameSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'www.retodetransformacion.com',
        cloudflareCustomHostnameId: 'cf-hostname-1',
      }),
    );
    expect(updateCall).toBeDefined();
    expect(updateCall?.where).toEqual({ id: 'domain-1' });
    expect(updateCall?.data.host).toBe('www.retodetransformacion.com');
    expect(updateCall?.data.normalizedHost).toBe(
      'www.retodetransformacion.com',
    );
    expect(updateCall?.data.domainType).toBe('custom_subdomain');
    expect(updateCall?.data.canonicalHost).toBe('www.retodetransformacion.com');
    expect(updateCall?.data.dnsTarget).toBe('customers.leadflow.kurukin.com');
    expect(updateCall?.data.cloudflareCustomHostnameId).toBeNull();
    expect(syncDomainToCloudflareSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'www.retodetransformacion.com',
        dnsTarget: 'customers.leadflow.kurukin.com',
      }),
      {
        mode: 'create',
        allowCreate: true,
      },
    );
    expect(result.host).toBe('www.retodetransformacion.com');
    expect(result.dnsTarget).toBe('customers.leadflow.kurukin.com');
  });

  it('recreates onboarding with explicit overrides from the request body', async () => {
    const { service, findFirst, update, updateMany } = createService();
    const existingRecord = buildDomainRecord();
    const updatedRecord = buildDomainRecord({
      host: 'clientes.retodetransformacion.com',
      normalizedHost: 'clientes.retodetransformacion.com',
      domainType: 'custom_apex',
      canonicalHost: 'retodetransformacion.com',
      isPrimary: true,
      redirectToPrimary: true,
      verificationMethod: 'txt',
      status: 'draft',
      onboardingStatus: 'pending_dns',
      verificationStatus: 'pending',
      sslStatus: 'pending',
      dnsTarget: 'customers.leadflow.kurukin.com',
      cloudflareCustomHostnameId: null,
      cloudflareStatusJson: null,
      lastCloudflareSyncAt: null,
      activatedAt: null,
    });

    findFirst.mockResolvedValueOnce(existingRecord).mockResolvedValueOnce(null);
    update.mockResolvedValue(updatedRecord);

    jest
      .spyOn(service as any, 'deleteCloudflareCustomHostname')
      .mockImplementation(async () => undefined);
    jest
      .spyOn(service as any, 'syncDomainToCloudflare')
      .mockImplementation(async () => buildDomainEntity(updatedRecord));

    const result = await service.recreateOnboardingForTeam(scope, 'domain-1', {
      host: ' clientes.retodetransformacion.com ',
      domainType: 'custom_apex',
      canonicalHost: 'RETODETRANSFORMACION.COM',
      isPrimary: true,
      redirectToPrimary: true,
      verificationMethod: 'txt',
    });
    const updateCall = update.mock.calls[0]?.[0];
    const updateManyCall = updateMany.mock.calls[0]?.[0];

    expect(updateManyCall).toEqual({
      where: {
        teamId: 'team-1',
        isPrimary: true,
        NOT: { id: 'domain-1' },
      },
      data: {
        isPrimary: false,
      },
    });
    expect(updateCall).toBeDefined();
    expect(updateCall?.where).toEqual({ id: 'domain-1' });
    expect(updateCall?.data.host).toBe('clientes.retodetransformacion.com');
    expect(updateCall?.data.normalizedHost).toBe(
      'clientes.retodetransformacion.com',
    );
    expect(updateCall?.data.domainType).toBe('custom_apex');
    expect(updateCall?.data.canonicalHost).toBe('retodetransformacion.com');
    expect(updateCall?.data.isPrimary).toBe(true);
    expect(updateCall?.data.redirectToPrimary).toBe(true);
    expect(updateCall?.data.verificationMethod).toBe('txt');
    expect(updateCall?.data.dnsTarget).toBe('customers.leadflow.kurukin.com');
    expect(result.host).toBe('clientes.retodetransformacion.com');
    expect(result.domainType).toBe('custom_apex');
    expect(result.canonicalHost).toBe('retodetransformacion.com');
  });
});
