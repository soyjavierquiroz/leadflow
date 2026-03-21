import { Module } from '@nestjs/common';
import { DomainEventPrismaRepository } from '../../prisma/repositories/domain-event-prisma.repository';
import { DOMAIN_EVENT_REPOSITORY } from '../shared/domain.tokens';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { TrackingEventsService } from './tracking-events.service';

@Module({
  controllers: [EventsController],
  providers: [
    EventsService,
    TrackingEventsService,
    DomainEventPrismaRepository,
    {
      provide: DOMAIN_EVENT_REPOSITORY,
      useExisting: DomainEventPrismaRepository,
    },
  ],
  exports: [EventsService, TrackingEventsService, DOMAIN_EVENT_REPOSITORY],
})
export class EventsModule {}
