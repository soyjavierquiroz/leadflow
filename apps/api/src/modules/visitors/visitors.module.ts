import { Module } from '@nestjs/common';
import { VisitorPrismaRepository } from '../../prisma/repositories/visitor-prisma.repository';
import { VISITOR_REPOSITORY } from '../shared/domain.tokens';
import { VisitorsService } from './visitors.service';

@Module({
  providers: [
    VisitorsService,
    VisitorPrismaRepository,
    {
      provide: VISITOR_REPOSITORY,
      useExisting: VisitorPrismaRepository,
    },
  ],
  exports: [VisitorsService, VISITOR_REPOSITORY],
})
export class VisitorsModule {}
