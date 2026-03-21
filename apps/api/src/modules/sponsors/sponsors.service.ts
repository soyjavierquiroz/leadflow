import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { SPONSOR_REPOSITORY } from '../shared/domain.tokens';
import { mapSponsorRecord } from '../../prisma/prisma.mappers';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateSponsorDto } from './dto/create-sponsor.dto';
import type { UpdateTeamSponsorDto } from './dto/update-team-sponsor.dto';
import type {
  Sponsor,
  SponsorRepository,
} from './interfaces/sponsor.interface';

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
}
