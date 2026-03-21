import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { mapAssignmentRecord } from '../../prisma/prisma.mappers';
import { PrismaService } from '../../prisma/prisma.service';
import { buildEntity } from '../shared/domain.factory';
import { ASSIGNMENT_REPOSITORY } from '../shared/domain.tokens';
import type { CreateAssignmentDto } from './dto/create-assignment.dto';
import type { UpdateMemberAssignmentDto } from './dto/update-member-assignment.dto';
import type {
  Assignment,
  AssignmentRepository,
} from './interfaces/assignment.interface';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
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
    status?: string;
  }): Promise<Assignment[]> {
    if (!this.repository) {
      throw new Error('AssignmentRepository provider is not configured.');
    }

    if (filters?.sponsorId) {
      const records = await this.repository.findBySponsorId(filters.sponsorId);
      return filters.status
        ? records.filter((item) => item.status === filters.status)
        : records;
    }

    if (filters?.funnelPublicationId) {
      const records = await this.repository.findByPublicationId(
        filters.funnelPublicationId,
      );
      return filters.status
        ? records.filter((item) => item.status === filters.status)
        : records;
    }

    if (filters?.teamId) {
      const records = await this.repository.findByTeamId(filters.teamId);
      return filters.status
        ? records.filter((item) => item.status === filters.status)
        : records;
    }

    if (filters?.workspaceId) {
      const records = await this.repository.findByWorkspaceId(
        filters.workspaceId,
      );
      return filters.status
        ? records.filter((item) => item.status === filters.status)
        : records;
    }

    const records = await this.repository.findAll();
    return filters?.status
      ? records.filter((item) => item.status === filters.status)
      : records;
  }

  async updateForMember(
    scope: {
      workspaceId: string;
      teamId: string;
      sponsorId: string;
    },
    assignmentId: string,
    dto: UpdateMemberAssignmentDto,
  ): Promise<Assignment> {
    if (!dto.status) {
      throw new BadRequestException({
        code: 'ASSIGNMENT_UPDATE_EMPTY',
        message: 'An assignment status is required.',
      });
    }

    const assignment = await this.prisma.assignment.findFirst({
      where: {
        id: assignmentId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        sponsorId: scope.sponsorId,
      },
      include: {
        lead: true,
      },
    });

    if (!assignment) {
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'The requested assignment was not found for this member.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.assignment.update({
        where: { id: assignment.id },
        data: {
          status: dto.status,
          resolvedAt: dto.status === 'closed' ? new Date() : null,
        },
      });

      const nextLeadStatus =
        dto.leadStatus ??
        (dto.status === 'accepted' && assignment.lead.status === 'assigned'
          ? 'nurturing'
          : null);

      if (nextLeadStatus) {
        await tx.lead.update({
          where: { id: assignment.leadId },
          data: {
            status: nextLeadStatus,
          },
        });
      }

      return record;
    });

    return mapAssignmentRecord(updated);
  }
}
