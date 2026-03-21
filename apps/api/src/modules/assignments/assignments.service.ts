import { Injectable } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import type { CreateAssignmentDto } from './dto/create-assignment.dto';
import type { Assignment } from './interfaces/assignment.interface';

@Injectable()
export class AssignmentsService {
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
