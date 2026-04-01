import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../assignments/assignments.module';
import { ConversionEventMappingsModule } from '../conversion-event-mappings/conversion-event-mappings.module';
import { DomainsModule } from '../domains/domains.module';
import { EventsModule } from '../events/events.module';
import { WalletEngineModule } from '../finance/wallet-engine.module';
import { FunnelInstancesModule } from '../funnel-instances/funnel-instances.module';
import { FunnelPublicationsModule } from '../funnel-publications/funnel-publications.module';
import { FunnelStepsModule } from '../funnel-steps/funnel-steps.module';
import { FunnelTemplatesModule } from '../funnel-templates/funnel-templates.module';
import { FunnelsModule } from '../funnels/funnels.module';
import { HandoffStrategiesModule } from '../handoff-strategies/handoff-strategies.module';
import { HybridFunnelPublicationsModule } from '../hybrid-funnel-publications/hybrid-funnel-publications.module';
import { IncomingWebhooksModule } from '../incoming-webhooks/incoming-webhooks.module';
import { LeadsModule } from '../leads/leads.module';
import { MessagingAutomationModule } from '../messaging-automation/messaging-automation.module';
import { MessagingIntegrationsModule } from '../messaging-integrations/messaging-integrations.module';
import { PublicFunnelRuntimeModule } from '../public-funnel-runtime/public-funnel-runtime.module';
import { RotationPoolsModule } from '../rotation-pools/rotation-pools.module';
import { SponsorsModule } from '../sponsors/sponsors.module';
import { StorageModule } from '../storage/storage.module';
import { TeamsModule } from '../teams/teams.module';
import { TrackingProfilesModule } from '../tracking-profiles/tracking-profiles.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    WorkspacesModule,
    TeamsModule,
    SponsorsModule,
    StorageModule,
    FunnelsModule,
    DomainsModule,
    FunnelTemplatesModule,
    FunnelInstancesModule,
    FunnelStepsModule,
    FunnelPublicationsModule,
    TrackingProfilesModule,
    HandoffStrategiesModule,
    HybridFunnelPublicationsModule,
    ConversionEventMappingsModule,
    IncomingWebhooksModule,
    PublicFunnelRuntimeModule,
    RotationPoolsModule,
    VisitorsModule,
    WebhooksModule,
    LeadsModule,
    WalletEngineModule,
    MessagingAutomationModule,
    MessagingIntegrationsModule,
    AssignmentsModule,
    EventsModule,
  ],
  exports: [
    WorkspacesModule,
    TeamsModule,
    SponsorsModule,
    StorageModule,
    FunnelsModule,
    DomainsModule,
    FunnelTemplatesModule,
    FunnelInstancesModule,
    FunnelStepsModule,
    FunnelPublicationsModule,
    TrackingProfilesModule,
    HandoffStrategiesModule,
    HybridFunnelPublicationsModule,
    ConversionEventMappingsModule,
    IncomingWebhooksModule,
    PublicFunnelRuntimeModule,
    RotationPoolsModule,
    VisitorsModule,
    WebhooksModule,
    LeadsModule,
    WalletEngineModule,
    MessagingAutomationModule,
    MessagingIntegrationsModule,
    AssignmentsModule,
    EventsModule,
  ],
})
export class DomainModule {}
