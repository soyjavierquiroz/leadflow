import { Module } from '@nestjs/common';
import { AssignmentsModule } from '../assignments/assignments.module';
import { EventsModule } from '../events/events.module';
import { FunnelsModule } from '../funnels/funnels.module';
import { LeadsModule } from '../leads/leads.module';
import { RotationPoolsModule } from '../rotation-pools/rotation-pools.module';
import { SponsorsModule } from '../sponsors/sponsors.module';
import { TeamsModule } from '../teams/teams.module';
import { VisitorsModule } from '../visitors/visitors.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [
    WorkspacesModule,
    TeamsModule,
    SponsorsModule,
    RotationPoolsModule,
    FunnelsModule,
    VisitorsModule,
    LeadsModule,
    AssignmentsModule,
    EventsModule,
  ],
  exports: [
    WorkspacesModule,
    TeamsModule,
    SponsorsModule,
    RotationPoolsModule,
    FunnelsModule,
    VisitorsModule,
    LeadsModule,
    AssignmentsModule,
    EventsModule,
  ],
})
export class DomainModule {}
