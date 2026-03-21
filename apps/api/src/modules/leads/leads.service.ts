import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { mapLeadRecord } from '../../prisma/prisma.mappers';
import { PrismaService } from '../../prisma/prisma.service';
import { buildEntity } from '../shared/domain.factory';
import { LEAD_REPOSITORY } from '../shared/domain.tokens';
import type { CreateLeadDto } from './dto/create-lead.dto';
import type { UpdateMemberLeadDto } from './dto/update-member-lead.dto';
import type { Lead, LeadRepository } from './interfaces/lead.interface';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(LEAD_REPOSITORY)
    private readonly repository?: LeadRepository,
  ) {}

  createDraft(dto: CreateLeadDto): Lead {
    return buildEntity<Lead>({
      workspaceId: dto.workspaceId,
      funnelId: dto.funnelId,
      funnelInstanceId: dto.funnelInstanceId ?? null,
      funnelPublicationId: dto.funnelPublicationId ?? null,
      visitorId: dto.visitorId ?? null,
      sourceChannel: dto.sourceChannel,
      fullName: dto.fullName ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      companyName: dto.companyName ?? null,
      status: 'captured',
      currentAssignmentId: null,
      tags: dto.tags ?? [],
    });
  }

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
    sponsorId?: string;
    funnelPublicationId?: string;
    status?: string;
  }): Promise<Lead[]> {
    if (!this.repository) {
      throw new Error('LeadRepository provider is not configured.');
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

  async findOne(filters: {
    id: string;
    workspaceId?: string;
    teamId?: string;
    sponsorId?: string;
  }): Promise<Lead> {
    const record = await this.prisma.lead.findFirst({
      where: {
        id: filters.id,
        ...(filters.workspaceId ? { workspaceId: filters.workspaceId } : {}),
        ...(filters.teamId
          ? {
              OR: [
                {
                  assignments: {
                    some: { teamId: filters.teamId },
                  },
                },
                {
                  funnelInstance: {
                    teamId: filters.teamId,
                  },
                },
                {
                  funnelPublication: {
                    teamId: filters.teamId,
                  },
                },
              ],
            }
          : {}),
        ...(filters.sponsorId
          ? {
              assignments: {
                some: { sponsorId: filters.sponsorId },
              },
            }
          : {}),
      },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'The requested lead was not found for this scope.',
      });
    }

    return mapLeadRecord(record);
  }

  async updateForMember(
    scope: {
      workspaceId: string;
      teamId: string;
      sponsorId: string;
    },
    leadId: string,
    dto: UpdateMemberLeadDto,
  ): Promise<Lead> {
    if (!dto.status) {
      throw new BadRequestException({
        code: 'LEAD_UPDATE_EMPTY',
        message: 'A lead status is required.',
      });
    }

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId: scope.workspaceId,
        assignments: {
          some: {
            sponsorId: scope.sponsorId,
            teamId: scope.teamId,
          },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'The requested lead was not found for this member.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: dto.status,
        },
      });

      if (
        lead.currentAssignmentId &&
        (dto.status === 'won' || dto.status === 'lost')
      ) {
        await tx.assignment.updateMany({
          where: {
            id: lead.currentAssignmentId,
            sponsorId: scope.sponsorId,
            status: {
              not: 'closed',
            },
          },
          data: {
            status: 'closed',
            resolvedAt: new Date(),
          },
        });
      }

      return record;
    });

    return mapLeadRecord(updated);
  }
}
