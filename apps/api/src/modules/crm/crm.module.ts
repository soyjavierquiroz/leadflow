import { Module } from '@nestjs/common';
import { CrmIdentityMatcher } from './crm-identity-matcher';
import { KurukinCrmReadClient } from './kurukin-crm-read.client';
import { LeadflowCrmReadRepository } from './leadflow-crm-read.repository';
import { TeamCrmController } from './team-crm.controller';
import { UnifiedCrmInboxService } from './unified-crm-inbox.service';
import { UnifiedCrmMapper } from './unified-crm.mapper';

@Module({
  controllers: [TeamCrmController],
  providers: [
    LeadflowCrmReadRepository,
    CrmIdentityMatcher,
    KurukinCrmReadClient,
    UnifiedCrmInboxService,
    UnifiedCrmMapper,
  ],
})
export class CrmModule {}
