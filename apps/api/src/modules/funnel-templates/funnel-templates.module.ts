import { Module } from '@nestjs/common';
import { FunnelTemplatePrismaRepository } from '../../prisma/repositories/funnel-template-prisma.repository';
import { FUNNEL_TEMPLATE_REPOSITORY } from '../shared/domain.tokens';
import { FunnelTemplatesController } from './funnel-templates.controller';
import { FunnelTemplatesService } from './funnel-templates.service';

@Module({
  controllers: [FunnelTemplatesController],
  providers: [
    FunnelTemplatesService,
    FunnelTemplatePrismaRepository,
    {
      provide: FUNNEL_TEMPLATE_REPOSITORY,
      useExisting: FunnelTemplatePrismaRepository,
    },
  ],
  exports: [FunnelTemplatesService, FUNNEL_TEMPLATE_REPOSITORY],
})
export class FunnelTemplatesModule {}
