import { Module } from '@nestjs/common';
import { DomainPrismaRepository } from '../../prisma/repositories/domain-prisma.repository';
import { DOMAIN_REPOSITORY } from '../shared/domain.tokens';
import { CloudflareSaasClient } from './cloudflare-saas.client';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';

@Module({
  controllers: [DomainsController],
  providers: [
    DomainsService,
    CloudflareSaasClient,
    DomainPrismaRepository,
    {
      provide: DOMAIN_REPOSITORY,
      useExisting: DomainPrismaRepository,
    },
  ],
  exports: [DomainsService, DOMAIN_REPOSITORY],
})
export class DomainsModule {}
