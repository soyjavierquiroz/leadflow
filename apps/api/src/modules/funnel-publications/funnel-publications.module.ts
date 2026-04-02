import { Module } from '@nestjs/common';
import { FunnelPublicationPrismaRepository } from '../../prisma/repositories/funnel-publication-prisma.repository';
import { FUNNEL_PUBLICATION_REPOSITORY } from '../shared/domain.tokens';
import { SystemTenantAccessGuard } from '../teams/system-tenant-access.guard';
import { FunnelPublicationsController } from './funnel-publications.controller';
import { FunnelPublicationsService } from './funnel-publications.service';
import { SystemPublicationsController } from './system-publications.controller';
import { SystemPublicationsService } from './system-publications.service';

@Module({
  controllers: [FunnelPublicationsController, SystemPublicationsController],
  providers: [
    FunnelPublicationsService,
    SystemPublicationsService,
    SystemTenantAccessGuard,
    FunnelPublicationPrismaRepository,
    {
      provide: FUNNEL_PUBLICATION_REPOSITORY,
      useExisting: FunnelPublicationPrismaRepository,
    },
  ],
  exports: [
    FunnelPublicationsService,
    SystemPublicationsService,
    FUNNEL_PUBLICATION_REPOSITORY,
  ],
})
export class FunnelPublicationsModule {}
