import { Module } from '@nestjs/common';
import { AssignmentPrismaRepository } from '../../prisma/repositories/assignment-prisma.repository';
import { ASSIGNMENT_REPOSITORY } from '../shared/domain.tokens';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';

@Module({
  controllers: [AssignmentsController],
  providers: [
    AssignmentsService,
    AssignmentPrismaRepository,
    {
      provide: ASSIGNMENT_REPOSITORY,
      useExisting: AssignmentPrismaRepository,
    },
  ],
  exports: [AssignmentsService, ASSIGNMENT_REPOSITORY],
})
export class AssignmentsModule {}
