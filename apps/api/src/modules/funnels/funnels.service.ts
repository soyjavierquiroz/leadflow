import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { buildEntity } from '../shared/domain.factory';
import { FUNNEL_REPOSITORY } from '../shared/domain.tokens';
import { mapFunnelRecord } from '../../prisma/prisma.mappers';
import type { CreateFunnelDto } from './dto/create-funnel.dto';
import type { Funnel, FunnelRepository } from './interfaces/funnel.interface';

@Injectable()
export class FunnelsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(FUNNEL_REPOSITORY)
    private readonly repository?: FunnelRepository,
  ) {}

  createDraft(dto: CreateFunnelDto): Funnel {
    return buildEntity<Funnel>({
      workspaceId: dto.workspaceId,
      name: dto.name,
      code: dto.code,
      thumbnailUrl: null,
      status: 'draft',
      isTemplate: dto.isTemplate ?? false,
      stages: dto.stages ?? ['captured', 'qualified', 'won'],
      entrySources: dto.entrySources ?? [
        'manual',
        'form',
        'landing-page',
        'api',
      ],
      defaultTeamId: dto.defaultTeamId ?? null,
      defaultRotationPoolId: dto.defaultRotationPoolId ?? null,
    });
  }

  async cloneTemplateToTeam(
    templateId: string,
    targetTeamId: string,
    newName?: string,
  ): Promise<Funnel> {
    const normalizedTeamId = targetTeamId.trim();

    if (!normalizedTeamId) {
      throw new BadRequestException({
        code: 'TARGET_TEAM_REQUIRED',
        message: 'A target team is required to clone the funnel template.',
      });
    }

    const targetTeam = await this.prisma.team.findUnique({
      where: { id: normalizedTeamId },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    if (!targetTeam) {
      throw new NotFoundException({
        code: 'TARGET_TEAM_NOT_FOUND',
        message: 'The target team was not found.',
      });
    }

    const template = await this.prisma.funnel.findFirst({
      where: {
        id: templateId,
        isTemplate: true,
      },
    });

    if (!template) {
      throw new NotFoundException({
        code: 'FUNNEL_TEMPLATE_NOT_FOUND',
        message: 'Solo se pueden clonar plantillas validas.',
      });
    }

    const name = this.resolveCloneName(template.name, newName);

    const record = await this.prisma.$transaction(async (tx) => {
      const code = await this.createUniqueCode(
        tx,
        targetTeam.workspaceId,
        template.code,
      );

      // The current legacy Funnel model has no nested design relations.
      // Deep-copying this aggregate means cloning the scalar configuration
      // fields into a new record and dropping operational links.
      return tx.funnel.create({
        data: {
          workspaceId: targetTeam.workspaceId,
          name,
          code,
          thumbnailUrl: template.thumbnailUrl,
          status: template.status,
          isTemplate: false,
          stages: [...template.stages],
          entrySources: [...template.entrySources],
          defaultTeamId: targetTeam.id,
          defaultRotationPoolId: null,
        },
      });
    });

    return mapFunnelRecord(record);
  }

  private resolveCloneName(originalName: string, nextName?: string) {
    const normalized = nextName?.trim();
    return normalized ? normalized : `Copia de ${originalName}`;
  }

  private async createUniqueCode(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    sourceCode: string,
  ) {
    const baseCode = this.normalizeCode(`${sourceCode}-copy`);

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = attempt === 0 ? baseCode : `${baseCode}-${attempt + 1}`;
      const existing = await tx.funnel.findFirst({
        where: {
          workspaceId,
          code,
        },
        select: { id: true },
      });

      if (!existing) {
        return code;
      }
    }

    throw new ConflictException({
      code: 'FUNNEL_CLONE_CODE_CONFLICT',
      message: 'We could not generate a unique code for the cloned funnel.',
    });
  }

  private normalizeCode(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!normalized) {
      throw new BadRequestException({
        code: 'FUNNEL_CODE_REQUIRED',
        message: 'A valid funnel code is required.',
      });
    }

    return normalized;
  }
}
