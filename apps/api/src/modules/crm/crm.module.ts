import { Module } from '@nestjs/common';
import { AdvisorCrmInboxService } from './advisor-crm-inbox.service';
import { CrmIdentityMatcher } from './crm-identity-matcher';
import { CrmAssignmentService } from './crm-assignment.service';
import { CrmConversationOwnershipService } from './crm-conversation-ownership.service';
import { CrmKloserMissionController } from './crm-kloser-mission.controller';
import { CrmKloserMissionService } from './crm-kloser-mission.service';
import { CRM_EXTERNAL_DISPATCHER } from './crm-external-dispatcher.port';
import { CrmMessageTemplateService } from './crm-message-template.service';
import { CrmOutreachDispatchBridgeService } from './crm-outreach-dispatch-bridge.service';
import { CRM_OUTREACH_DISPATCHER } from './crm-outreach-dispatcher.port';
import { CrmOutreachPolicyService } from './crm-outreach-policy.service';
import { CrmOutreachQueueService } from './crm-outreach-queue.service';
import { CrmOutreachSchedulerService } from './crm-outreach-scheduler.service';
import { CrmOwnershipPolicyService } from './crm-ownership-policy.service';
import { KurukinCrmReadClient } from './kurukin-crm-read.client';
import { LeadflowCrmReadRepository } from './leadflow-crm-read.repository';
import { NoopCrmExternalDispatcherService } from './noop-crm-external-dispatcher.service';
import { NoopOutreachDispatcherService } from './noop-outreach-dispatcher.service';
import { SponsorCrmAssignmentsController } from './sponsor-crm-assignments.controller';
import { TeamCrmController } from './team-crm.controller';
import { UnifiedCrmInboxService } from './unified-crm-inbox.service';
import { UnifiedCrmMapper } from './unified-crm.mapper';

@Module({
  controllers: [
    TeamCrmController,
    SponsorCrmAssignmentsController,
    CrmKloserMissionController,
  ],
  providers: [
    LeadflowCrmReadRepository,
    CrmIdentityMatcher,
    KurukinCrmReadClient,
    AdvisorCrmInboxService,
    UnifiedCrmInboxService,
    UnifiedCrmMapper,
    CrmOwnershipPolicyService,
    CrmOutreachPolicyService,
    CrmOutreachQueueService,
    CrmOutreachDispatchBridgeService,
    CrmMessageTemplateService,
    CrmOutreachSchedulerService,
    CrmAssignmentService,
    CrmConversationOwnershipService,
    CrmKloserMissionService,
    NoopCrmExternalDispatcherService,
    NoopOutreachDispatcherService,
    {
      provide: CRM_EXTERNAL_DISPATCHER,
      useExisting: CrmKloserMissionService,
    },
    {
      provide: CRM_OUTREACH_DISPATCHER,
      useExisting: NoopOutreachDispatcherService,
    },
  ],
  exports: [
    AdvisorCrmInboxService,
    CrmAssignmentService,
    CrmConversationOwnershipService,
    CrmOwnershipPolicyService,
    CrmOutreachPolicyService,
    CrmOutreachQueueService,
    CrmOutreachDispatchBridgeService,
    CrmOutreachSchedulerService,
    CrmKloserMissionService,
  ],
})
export class CrmModule {}
