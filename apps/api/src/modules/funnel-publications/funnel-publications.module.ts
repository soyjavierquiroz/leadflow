import { Module } from '@nestjs/common';
import { FunnelPublicationPrismaRepository } from '../../prisma/repositories/funnel-publication-prisma.repository';
import { FUNNEL_PUBLICATION_REPOSITORY } from '../shared/domain.tokens';
import { FunnelPublicationsController } from './funnel-publications.controller';
import { FunnelPublicationsService } from './funnel-publications.service';

@Module({
  controllers: [FunnelPublicationsController],
  providers: [
    FunnelPublicationsService,
    FunnelPublicationPrismaRepository,
    {
      provide: FUNNEL_PUBLICATION_REPOSITORY,
      useExisting: FunnelPublicationPrismaRepository,
    },
  ],
  exports: [FunnelPublicationsService, FUNNEL_PUBLICATION_REPOSITORY],
})
export class FunnelPublicationsModule {}
