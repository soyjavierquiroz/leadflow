import { Module } from '@nestjs/common';
import { DomainPrismaRepository } from '../../prisma/repositories/domain-prisma.repository';
import { DOMAIN_REPOSITORY } from '../shared/domain.tokens';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';

@Module({
  controllers: [DomainsController],
  providers: [
    DomainsService,
    DomainPrismaRepository,
    {
      provide: DOMAIN_REPOSITORY,
      useExisting: DomainPrismaRepository,
    },
  ],
  exports: [DomainsService, DOMAIN_REPOSITORY],
})
export class DomainsModule {}
