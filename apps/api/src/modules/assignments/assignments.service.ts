import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { ASSIGNMENT_REPOSITORY } from '../shared/domain.tokens';
import type { CreateAssignmentDto } from './dto/create-assignment.dto';
import type {
  Assignment,
  AssignmentRepository,
} from './interfaces/assignment.interface';

@Injectable()
export class AssignmentsService {
  constructor(
    @Optional()
    @Inject(ASSIGNMENT_REPOSITORY)
    private readonly repository?: AssignmentRepository,
  ) {}

  createDraft(dto: CreateAssignmentDto): Assignment {
    return buildEntity<Assignment>({
      workspaceId: dto.workspaceId,
      leadId: dto.leadId,
      sponsorId: dto.sponsorId,
      teamId: dto.teamId,
      funnelId: dto.funnelId,
      rotationPoolId: dto.rotationPoolId ?? null,
      status: 'pending',
      reason: dto.reason ?? 'rotation',
      assignedAt: new Date().toISOString(),
      resolvedAt: null,
    });
  }
}
