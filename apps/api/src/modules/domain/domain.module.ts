import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../assignments/assignments.module';
import { ConversionEventMappingsModule } from '../conversion-event-mappings/conversion-event-mappings.module';
import { DomainsModule } from '../domains/domains.module';
import { EventsModule } from '../events/events.module';
import { FunnelInstancesModule } from '../funnel-instances/funnel-instances.module';
import { FunnelPublicationsModule } from '../funnel-publications/funnel-publications.module';
import { FunnelStepsModule } from '../funnel-steps/funnel-steps.module';
import { FunnelTemplatesModule } from '../funnel-templates/funnel-templates.module';
import { FunnelsModule } from '../funnels/funnels.module';
import { HandoffStrategiesModule } from '../handoff-strategies/handoff-strategies.module';
import { LeadsModule } from '../leads/leads.module';
import { RotationPoolsModule } from '../rotation-pools/rotation-pools.module';
import { SponsorsModule } from '../sponsors/sponsors.module';
import { TeamsModule } from '../teams/teams.module';
import { TrackingProfilesModule } from '../tracking-profiles/tracking-profiles.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    WorkspacesModule,
    TeamsModule,
    SponsorsModule,
    FunnelsModule,
    DomainsModule,
    FunnelTemplatesModule,
    FunnelInstancesModule,
    FunnelStepsModule,
    FunnelPublicationsModule,
    TrackingProfilesModule,
    HandoffStrategiesModule,
    ConversionEventMappingsModule,
    RotationPoolsModule,
    VisitorsModule,
    LeadsModule,
    AssignmentsModule,
    EventsModule,
  ],
  exports: [
    WorkspacesModule,
    TeamsModule,
    SponsorsModule,
    FunnelsModule,
    DomainsModule,
    FunnelTemplatesModule,
    FunnelInstancesModule,
    FunnelStepsModule,
    FunnelPublicationsModule,
    TrackingProfilesModule,
    HandoffStrategiesModule,
    ConversionEventMappingsModule,
    RotationPoolsModule,
    VisitorsModule,
    LeadsModule,
    AssignmentsModule,
    EventsModule,
  ],
})
export class DomainModule {}
