import { Module } from '@nestjs/common';
import { FunnelPrismaRepository } from '../../prisma/repositories/funnel-prisma.repository';
import { RuntimeContextModule } from '../runtime-context/runtime-context.module';
import { FUNNEL_REPOSITORY } from '../shared/domain.tokens';
import { TemplatesModule } from '../templates/templates.module';
import { SystemTenantAccessGuard } from '../teams/system-tenant-access.guard';
import { BlueprintService } from './blueprint.service';
import { FunnelsController } from './funnels.controller';
import { FunnelsService } from './funnels.service';
import { SystemFunnelsController } from './system-funnels.controller';

@Module({
  imports: [TemplatesModule, RuntimeContextModule],
  controllers: [SystemFunnelsController, FunnelsController],
  providers: [
    FunnelsService,
    BlueprintService,
    SystemTenantAccessGuard,
    FunnelPrismaRepository,
    {
      provide: FUNNEL_REPOSITORY,
      useExisting: FunnelPrismaRepository,
    },
  ],
  exports: [FunnelsService, BlueprintService, FUNNEL_REPOSITORY],
})
export class FunnelsModule {}
