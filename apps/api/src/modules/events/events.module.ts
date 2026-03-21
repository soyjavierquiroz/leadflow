import { Module } from '@nestjs/common';
import { DomainEventPrismaRepository } from '../../prisma/repositories/domain-event-prisma.repository';
import { DOMAIN_EVENT_REPOSITORY } from '../shared/domain.tokens';
import { EventsService } from './events.service';

@Module({
  providers: [
    EventsService,
    DomainEventPrismaRepository,
    {
      provide: DOMAIN_EVENT_REPOSITORY,
      useExisting: DomainEventPrismaRepository,
    },
  ],
  exports: [EventsService, DOMAIN_EVENT_REPOSITORY],
})
export class EventsModule {}
