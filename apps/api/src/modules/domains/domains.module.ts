import { Module } from '@nestjs/common';
import { DomainPrismaRepository } from '../../prisma/repositories/domain-prisma.repository';
import { DOMAIN_REPOSITORY } from '../shared/domain.tokens';
import { SystemTenantAccessGuard } from '../teams/system-tenant-access.guard';
import { CloudflareSaasClient } from './cloudflare-saas.client';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { SystemDomainsController } from './system-domains.controller';

@Module({
  controllers: [DomainsController, SystemDomainsController],
  providers: [
    DomainsService,
    CloudflareSaasClient,
    SystemTenantAccessGuard,
    DomainPrismaRepository,
    {
      provide: DOMAIN_REPOSITORY,
      useExisting: DomainPrismaRepository,
    },
  ],
  exports: [DomainsService, DOMAIN_REPOSITORY],
})
export class DomainsModule {}
