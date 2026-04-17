import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Prisma } from '@prisma/client';
import { buildEntity } from '../shared/domain.factory';
import { SPONSOR_REPOSITORY } from '../shared/domain.tokens';
import { mapSponsorRecord } from '../../prisma/prisma.mappers';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletEngineService } from '../finance/wallet-engine.service';
import { buildLeadWorkflow } from '../leads/leads-workflows';
import { N8nAutomationClient } from '../messaging-automation/n8n-automation.client';
import {
  normalizeMessagingPhone,
  sanitizeNullableText,
} from '../messaging-integrations/messaging-integrations.utils';
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

const memberLeadAcceptInclude = {
  currentAssignment: {
    include: {
      sponsor: {
        include: {
          messagingConnection: true,
        },
      },
      team: true,
    },
  },
  funnelInstance: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  funnelPublication: {
    select: {
      id: true,
      pathPrefix: true,
      domain: {
        select: {
          host: true,
        },
      },
    },
  },
} satisfies Prisma.LeadInclude;

type MemberLeadAcceptRecord = Prisma.LeadGetPayload<{
  include: typeof memberLeadAcceptInclude;
}>;

type MemberLeadAcceptResult = {
  ok: true;
  leadId: string;
  sponsorId: string;
  assignmentId: string;
  assignmentStatus: 'accepted';
  leadStatus:
    | 'captured'
    | 'qualified'
    | 'assigned'
    | 'nurturing'
    | 'won'
    | 'lost';
  acceptedAt: string;
  alreadyAccepted: boolean;
};

@Injectable()
export class SponsorsService {
  private readonly logger = new Logger(SponsorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly walletEngineService: WalletEngineService,
    private readonly n8nAutomationClient: N8nAutomationClient,
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
      isActive: dto.isActive ?? false,
      avatarUrl: null,
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
        avatarUrl: true,
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
        avatarUrl: sponsor.avatarUrl,
        email: sponsor.email,
        phone: sponsor.phone,
        availabilityStatus: sponsor.availabilityStatus,
      }),
      kpis: new MemberDashboardKpisDto({
        handoffsNew: inbox.filter(
          (item) => item.assignmentStatus === 'assigned',
        ).length,
        actionsToday: inbox.filter(
          (item) =>
            item.reminderBucket === 'overdue' ||
            item.reminderBucket === 'due_today',
        ).length,
        activePortfolio: inbox.filter(
          (item) => item.assignmentStatus === 'accepted',
        ).length,
      }),
      inbox,
    });
  }

  async acceptLeadForMember(
    scope: {
      workspaceId: string;
      teamId: string;
      sponsorId: string;
    },
    leadId: string,
  ): Promise<MemberLeadAcceptResult> {
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        workspaceId: scope.workspaceId,
        currentAssignment: {
          is: {
            sponsorId: scope.sponsorId,
            teamId: scope.teamId,
          },
        },
      },
      include: memberLeadAcceptInclude,
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'The requested lead was not found for this sponsor.',
      });
    }

    const assignment = lead.currentAssignment;

    if (!assignment) {
      throw new BadRequestException({
        code: 'LEAD_ASSIGNMENT_REQUIRED',
        message: 'The lead does not have an active assignment to accept.',
      });
    }

    if (lead.status === 'won' || lead.status === 'lost') {
      throw new BadRequestException({
        code: 'LEAD_NOT_ACCEPTABLE',
        message: 'Terminal leads cannot be accepted manually.',
      });
    }

    if (assignment.status === 'accepted') {
      return {
        ok: true,
        leadId: lead.id,
        sponsorId: assignment.sponsorId,
        assignmentId: assignment.id,
        assignmentStatus: 'accepted',
        leadStatus: lead.status,
        acceptedAt:
          assignment.acceptedAt?.toISOString() ??
          assignment.updatedAt.toISOString(),
        alreadyAccepted: true,
      };
    }

    if (assignment.status !== 'pending' && assignment.status !== 'assigned') {
      throw new BadRequestException({
        code: 'ASSIGNMENT_NOT_ACCEPTABLE',
        message: 'Only pending or assigned leads can be accepted manually.',
      });
    }

    const acceptedAt = new Date();
    const nextLeadStatus =
      lead.status === 'captured' || lead.status === 'assigned'
        ? 'nurturing'
        : lead.status;

    await this.prisma.$transaction(async (tx) => {
      await tx.assignment.update({
        where: {
          id: assignment.id,
        },
        data: {
          status: 'accepted',
          acceptedAt,
        },
      });

      if (nextLeadStatus !== lead.status) {
        await tx.lead.update({
          where: {
            id: lead.id,
          },
          data: {
            status: nextLeadStatus,
          },
        });
      }
    });

    const result: MemberLeadAcceptResult = {
      ok: true,
      leadId: lead.id,
      sponsorId: assignment.sponsorId,
      assignmentId: assignment.id,
      assignmentStatus: 'accepted',
      leadStatus: nextLeadStatus,
      acceptedAt: acceptedAt.toISOString(),
      alreadyAccepted: false,
    };

    const outboundWebhookUrl = this.getOutboundWebhookUrl();

    if (outboundWebhookUrl) {
      void this.dispatchOutboundRescueWebhook(
        outboundWebhookUrl,
        this.buildOutboundRescuePayload(lead, {
          acceptedAt: result.acceptedAt,
          assignmentStatus: result.assignmentStatus,
          leadStatus: result.leadStatus,
        }),
      );
    } else {
      this.logger.warn(
        `Skipping outbound rescue webhook for lead ${lead.id}: N8N_OUTBOUND_WEBHOOK_URL is not configured.`,
      );
    }

    return result;
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

  async getKreditsForMember(scope: {
    workspaceId: string;
    teamId: string;
    sponsorId: string;
  }): Promise<{ balance: string }> {
    await this.findForMember(scope);

    const account = await this.walletEngineService.upsertSponsorAccount(
      scope.sponsorId,
    );
    const balance = await this.walletEngineService.getSponsorKredits(
      account.accountId,
    );

    return { balance };
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
      dto.avatarUrl === undefined &&
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
    const nextAvatarUrl = this.normalizeSponsorAvatarUrl(dto.avatarUrl);

    const record = await this.prisma.sponsor.update({
      where: { id: sponsor.id },
      data: {
        displayName,
        avatarUrl:
          nextAvatarUrl !== undefined ? nextAvatarUrl : sponsor.avatarUrl,
        email: nextEmail !== undefined ? nextEmail : sponsor.email,
        phone: nextPhone !== undefined ? nextPhone : sponsor.phone,
        availabilityStatus:
          dto.availabilityStatus ?? sponsor.availabilityStatus,
      },
    });

    return mapSponsorRecord(record);
  }

  private normalizeSponsorAvatarUrl(
    value: string | null | undefined,
  ): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(trimmed);
    } catch {
      throw new BadRequestException({
        code: 'SPONSOR_AVATAR_URL_INVALID',
        message: 'Avatar URL must be a valid absolute URL.',
      });
    }

    const configuredBaseUrl = this.configService
      .get<string>('MINIO_PUBLIC_URL')
      ?.trim();

    if (configuredBaseUrl) {
      try {
        const publicBaseUrl = new URL(configuredBaseUrl);

        if (parsedUrl.origin !== publicBaseUrl.origin) {
          throw new BadRequestException({
            code: 'SPONSOR_AVATAR_URL_INVALID_ORIGIN',
            message:
              'Avatar URL must point to the configured Leadflow CDN origin.',
          });
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
      }
    }

    return parsedUrl.toString();
  }

  private getOutboundWebhookUrl() {
    const configuredValue = sanitizeNullableText(
      this.configService.get<string>('N8N_OUTBOUND_WEBHOOK_URL'),
    );

    if (!configuredValue) {
      return null;
    }

    try {
      return new URL(configuredValue).toString();
    } catch {
      this.logger.warn(
        `Skipping outbound rescue webhook because N8N_OUTBOUND_WEBHOOK_URL is invalid: ${configuredValue}`,
      );
      return null;
    }
  }

  private buildOutboundRescuePayload(
    lead: MemberLeadAcceptRecord,
    input: {
      acceptedAt: string;
      assignmentStatus: 'accepted';
      leadStatus: MemberLeadAcceptResult['leadStatus'];
    },
  ) {
    const assignment = lead.currentAssignment;

    if (!assignment) {
      throw new Error(
        'Lead assignment is required to build the outbound payload.',
      );
    }

    const messagingConnection = assignment.sponsor.messagingConnection;

    return {
      version: 'leadflow.outbound-rescue.v1',
      event: 'LEAD_OUTBOUND_RESCUE_ACCEPTED',
      occurredAt: input.acceptedAt,
      leadId: lead.id,
      sponsorId: assignment.sponsorId,
      assignmentId: assignment.id,
      lead: {
        id: lead.id,
        status: input.leadStatus,
        sourceChannel: lead.sourceChannel,
        fullName: sanitizeNullableText(lead.fullName),
        email: sanitizeNullableText(lead.email),
        phone: sanitizeNullableText(lead.phone),
        normalizedPhone: normalizeMessagingPhone(lead.phone),
        companyName: sanitizeNullableText(lead.companyName),
        qualificationGrade: lead.qualificationGrade,
        summaryText: sanitizeNullableText(lead.summaryText),
        nextActionLabel: sanitizeNullableText(lead.nextActionLabel),
        followUpAt: lead.followUpAt?.toISOString() ?? null,
        tags: lead.tags,
      },
      sponsor: {
        id: assignment.sponsor.id,
        displayName: assignment.sponsor.displayName,
        email: sanitizeNullableText(assignment.sponsor.email),
        phone: sanitizeNullableText(assignment.sponsor.phone),
      },
      team: {
        id: assignment.team.id,
        name: assignment.team.name,
        code: assignment.team.code,
      },
      assignment: {
        id: assignment.id,
        status: input.assignmentStatus,
        reason: assignment.reason,
        assignedAt: assignment.assignedAt.toISOString(),
        acceptedAt: input.acceptedAt,
      },
      messagingConnection: messagingConnection
        ? {
            id: messagingConnection.id,
            provider: messagingConnection.provider,
            status: messagingConnection.status,
            runtimeContextStatus: messagingConnection.runtimeContextStatus,
            externalInstanceId: messagingConnection.externalInstanceId,
            phone: sanitizeNullableText(messagingConnection.phone),
            normalizedPhone:
              sanitizeNullableText(messagingConnection.normalizedPhone) ??
              normalizeMessagingPhone(messagingConnection.phone),
            automationWebhookUrl: sanitizeNullableText(
              messagingConnection.automationWebhookUrl,
            ),
            automationEnabled: messagingConnection.automationEnabled,
          }
        : null,
      funnelInstance: lead.funnelInstance
        ? {
            id: lead.funnelInstance.id,
            name: lead.funnelInstance.name,
            code: lead.funnelInstance.code,
          }
        : null,
      publication: lead.funnelPublication
        ? {
            id: lead.funnelPublication.id,
            pathPrefix: lead.funnelPublication.pathPrefix,
            domainHost: lead.funnelPublication.domain.host,
          }
        : null,
    };
  }

  private async dispatchOutboundRescueWebhook(url: string, payload: unknown) {
    try {
      const response = await this.n8nAutomationClient.dispatch(url, payload);

      if (response.status < 200 || response.status >= 300) {
        this.logger.warn(
          `Outbound rescue webhook responded with HTTP ${response.status}.`,
        );
        return;
      }

      this.logger.log(
        `Outbound rescue webhook accepted with HTTP ${response.status}.`,
      );
    } catch (error) {
      this.logger.error(
        `Outbound rescue webhook failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
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

  private resolveDashboardLeadPriority(lead: MemberDashboardLeadDto): number {
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
