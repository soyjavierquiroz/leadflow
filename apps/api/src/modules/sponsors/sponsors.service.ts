import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { type Prisma } from '@prisma/client';
import { buildEntity } from '../shared/domain.factory';
import { SPONSOR_REPOSITORY } from '../shared/domain.tokens';
import { mapSponsorRecord } from '../../prisma/prisma.mappers';
import { PrismaService } from '../../prisma/prisma.service';
import { buildLeadWorkflow } from '../leads/leads-workflows';
import type { CreateSponsorDto } from './dto/create-sponsor.dto';
import {
  MemberDashboardDto,
  MemberDashboardKpisDto,
  MemberDashboardLeadDto,
  MemberDashboardSponsorDto,
} from './dto/member-dashboard.dto';
import type { UpdateMemberSponsorDto } from './dto/update-member-sponsor.dto';
import type { UpdateTeamSponsorDto } from './dto/update-team-sponsor.dto';
import type {
  Sponsor,
  SponsorRepository,
} from './interfaces/sponsor.interface';

const memberDashboardAssignmentInclude = {
  lead: {
    include: {
      funnelInstance: {
        select: {
          name: true,
        },
      },
      funnelPublication: {
        select: {
          pathPrefix: true,
          domain: {
            select: {
              host: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.AssignmentInclude;

type MemberDashboardAssignmentRecord = Prisma.AssignmentGetPayload<{
  include: typeof memberDashboardAssignmentInclude;
}>;

@Injectable()
export class SponsorsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(SPONSOR_REPOSITORY)
    private readonly repository?: SponsorRepository,
  ) {}

  createDraft(dto: CreateSponsorDto): Sponsor {
    return buildEntity<Sponsor>({
      workspaceId: dto.workspaceId,
      teamId: dto.teamId,
      displayName: dto.displayName,
      status: 'draft',
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      availabilityStatus: dto.availabilityStatus ?? 'available',
      routingWeight: dto.routingWeight ?? 1,
      memberPortalEnabled: dto.memberPortalEnabled ?? true,
    });
  }

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
  }): Promise<Sponsor[]> {
    if (!this.repository) {
      throw new Error('SponsorRepository provider is not configured.');
    }

    if (filters?.teamId) {
      return this.repository.findByTeamId(filters.teamId);
    }

    if (filters?.workspaceId) {
      return this.repository.findByWorkspaceId(filters.workspaceId);
    }

    return this.repository.findAll();
  }

  async getDashboardForMember(scope: {
    workspaceId: string;
    teamId: string;
    sponsorId: string;
  }): Promise<MemberDashboardDto> {
    const sponsor = await this.prisma.sponsor.findFirst({
      where: {
        id: scope.sponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        phone: true,
        availabilityStatus: true,
      },
    });

    if (!sponsor) {
      throw new NotFoundException({
        code: 'SPONSOR_NOT_FOUND',
        message: 'The requested sponsor was not found for this member.',
      });
    }

    const assignments = await this.prisma.assignment.findMany({
      where: {
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        sponsorId: scope.sponsorId,
        status: {
          in: ['assigned', 'accepted'],
        },
      },
      include: memberDashboardAssignmentInclude,
      orderBy: {
        assignedAt: 'desc',
      },
    });

    const inbox = assignments
      .map((assignment) => this.toMemberDashboardLead(assignment))
      .sort((left, right) => {
        const leftScore = this.resolveDashboardLeadPriority(left);
        const rightScore = this.resolveDashboardLeadPriority(right);

        if (leftScore !== rightScore) {
          return leftScore - rightScore;
        }

        return right.assignedAt.localeCompare(left.assignedAt);
      });

    return new MemberDashboardDto({
      sponsor: new MemberDashboardSponsorDto({
        id: sponsor.id,
        displayName: sponsor.displayName,
        email: sponsor.email,
        phone: sponsor.phone,
        availabilityStatus: sponsor.availabilityStatus,
      }),
      kpis: new MemberDashboardKpisDto({
        handoffsNew: inbox.filter((item) => item.assignmentStatus === 'assigned')
          .length,
        actionsToday: inbox.filter(
          (item) =>
            item.reminderBucket === 'overdue' ||
            item.reminderBucket === 'due_today',
        ).length,
        activePortfolio: inbox.length,
      }),
      inbox,
    });
  }

  async findForMember(scope: {
    workspaceId: string;
    teamId: string;
    sponsorId: string;
  }): Promise<Sponsor> {
    const sponsor = await this.prisma.sponsor.findFirst({
      where: {
        id: scope.sponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
    });

    if (!sponsor) {
      throw new NotFoundException({
        code: 'SPONSOR_NOT_FOUND',
        message: 'The requested sponsor was not found for this member.',
      });
    }

    return mapSponsorRecord(sponsor);
  }

  async updateForTeam(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    sponsorId: string,
    dto: UpdateTeamSponsorDto,
  ): Promise<Sponsor> {
    const sponsor = await this.prisma.sponsor.findFirst({
      where: {
        id: sponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
    });

    if (!sponsor) {
      throw new NotFoundException({
        code: 'SPONSOR_NOT_FOUND',
        message: 'The requested sponsor was not found for this team.',
      });
    }

    if (dto.status === undefined && dto.availabilityStatus === undefined) {
      throw new BadRequestException({
        code: 'SPONSOR_UPDATE_EMPTY',
        message: 'At least one sponsor operation field is required.',
      });
    }

    const record = await this.prisma.sponsor.update({
      where: { id: sponsor.id },
      data: {
        status: dto.status ?? sponsor.status,
        availabilityStatus:
          dto.availabilityStatus ??
          (dto.status === 'paused' ? 'paused' : sponsor.availabilityStatus),
      },
    });

    return mapSponsorRecord(record);
  }

  async updateForMember(
    scope: {
      workspaceId: string;
      teamId: string;
      sponsorId: string;
    },
    dto: UpdateMemberSponsorDto,
  ): Promise<Sponsor> {
    if (
      dto.displayName === undefined &&
      dto.email === undefined &&
      dto.phone === undefined &&
      dto.availabilityStatus === undefined
    ) {
      throw new BadRequestException({
        code: 'SPONSOR_UPDATE_EMPTY',
        message: 'At least one sponsor profile field is required.',
      });
    }

    const sponsor = await this.prisma.sponsor.findFirst({
      where: {
        id: scope.sponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
    });

    if (!sponsor) {
      throw new NotFoundException({
        code: 'SPONSOR_NOT_FOUND',
        message: 'The requested sponsor was not found for this member.',
      });
    }

    const displayName =
      dto.displayName !== undefined
        ? dto.displayName.trim()
        : sponsor.displayName;

    if (!displayName) {
      throw new BadRequestException({
        code: 'SPONSOR_DISPLAY_NAME_REQUIRED',
        message: 'Sponsor display name is required.',
      });
    }

    const normalizeNullable = (
      value: string | null | undefined,
    ): string | null | undefined => {
      if (value === undefined) {
        return undefined;
      }

      if (value === null) {
        return null;
      }

      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    };

    const nextEmail = normalizeNullable(dto.email);
    const nextPhone = normalizeNullable(dto.phone);

    const record = await this.prisma.sponsor.update({
      where: { id: sponsor.id },
      data: {
        displayName,
        email: nextEmail !== undefined ? nextEmail : sponsor.email,
        phone: nextPhone !== undefined ? nextPhone : sponsor.phone,
        availabilityStatus:
          dto.availabilityStatus ?? sponsor.availabilityStatus,
      },
    });

    return mapSponsorRecord(record);
  }

  private toMemberDashboardLead(
    assignment: MemberDashboardAssignmentRecord,
  ): MemberDashboardLeadDto {
    const lead = assignment.lead;
    const workflow = buildLeadWorkflow({
      status: lead.status,
      qualificationGrade: lead.qualificationGrade,
      nextActionLabel: lead.nextActionLabel,
      followUpAt: lead.followUpAt?.toISOString() ?? null,
      lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
      lastQualifiedAt: lead.lastQualifiedAt?.toISOString() ?? null,
    });
    const contactLabel =
      lead.email?.trim() ||
      lead.phone?.trim() ||
      'Sin datos de contacto visibles';
    const assignmentStatus =
      assignment.status === 'accepted' ? 'accepted' : 'assigned';

    return new MemberDashboardLeadDto({
      id: lead.id,
      assignmentId: assignment.id,
      leadName: lead.fullName?.trim() || 'Lead sin nombre',
      companyName: lead.companyName?.trim() || null,
      contactLabel,
      leadStatus: lead.status,
      assignmentStatus,
      reminderBucket: workflow.reminder.bucket,
      reminderLabel: workflow.reminder.label,
      needsAttention: workflow.reminder.needsAttention,
      nextActionLabel:
        lead.nextActionLabel?.trim() || workflow.effectiveNextAction,
      assignedAt: assignment.assignedAt.toISOString(),
      followUpAt: lead.followUpAt?.toISOString() ?? null,
      publicationPath: lead.funnelPublication?.pathPrefix ?? null,
      domainHost: lead.funnelPublication?.domain.host ?? null,
      funnelName: lead.funnelInstance?.name ?? null,
    });
  }

  private resolveDashboardLeadPriority(
    lead: MemberDashboardLeadDto,
  ): number {
    if (lead.assignmentStatus === 'assigned') {
      return 0;
    }

    switch (lead.reminderBucket) {
      case 'overdue':
        return 1;
      case 'due_today':
        return 2;
      case 'unscheduled':
        return 3;
      case 'upcoming':
        return 4;
      default:
        return 5;
    }
  }
}
