import { Module } from '@nestjs/common';
import { FunnelPrismaRepository } from '../../prisma/repositories/funnel-prisma.repository';
import { FUNNEL_REPOSITORY } from '../shared/domain.tokens';
import { SystemTenantAccessGuard } from '../teams/system-tenant-access.guard';
import { FunnelsService } from './funnels.service';
import { SystemFunnelsController } from './system-funnels.controller';

@Module({
  controllers: [SystemFunnelsController],
  providers: [
    FunnelsService,
    SystemTenantAccessGuard,
    FunnelPrismaRepository,
    {
      provide: FUNNEL_REPOSITORY,
      useExisting: FunnelPrismaRepository,
    },
  ],
  exports: [FunnelsService, FUNNEL_REPOSITORY],
})
export class FunnelsModule {}
