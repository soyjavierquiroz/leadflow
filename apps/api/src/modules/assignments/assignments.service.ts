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
      funnelInstanceId: dto.funnelInstanceId ?? null,
      funnelPublicationId: dto.funnelPublicationId ?? null,
      rotationPoolId: dto.rotationPoolId ?? null,
      status: 'pending',
      reason: dto.reason ?? 'rotation',
      assignedAt: new Date().toISOString(),
      resolvedAt: null,
    });
  }

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
    sponsorId?: string;
    funnelPublicationId?: string;
  }): Promise<Assignment[]> {
    if (!this.repository) {
      throw new Error('AssignmentRepository provider is not configured.');
    }

    if (filters?.sponsorId) {
      return this.repository.findBySponsorId(filters.sponsorId);
    }

    if (filters?.funnelPublicationId) {
      return this.repository.findByPublicationId(filters.funnelPublicationId);
    }

    if (filters?.teamId) {
      return this.repository.findByTeamId(filters.teamId);
    }

    if (filters?.workspaceId) {
      return this.repository.findByWorkspaceId(filters.workspaceId);
    }

    return this.repository.findAll();
  }
}
