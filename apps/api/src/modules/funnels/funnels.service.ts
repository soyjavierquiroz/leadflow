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
import type { JsonValue } from '../shared/domain.types';
import type { CreateFunnelDto } from './dto/create-funnel.dto';
import type { CreateSystemFunnelTemplateDto } from './dto/create-system-funnel-template.dto';
import type { UpdateSystemFunnelTemplateDto } from './dto/update-system-funnel-template.dto';
import type { Funnel, FunnelRepository } from './interfaces/funnel.interface';

const DEFAULT_TEMPLATE_STAGES = ['captured', 'qualified', 'won'];
const DEFAULT_TEMPLATE_ENTRY_SOURCES: Funnel['entrySources'] = [
  'manual',
  'form',
  'landing-page',
  'api',
];
const ALLOWED_FUNNEL_STATUSES: Funnel['status'][] = [
  'draft',
  'active',
  'archived',
];

const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

type FunnelCodeLookupClient =
  | Pick<PrismaService, 'funnel'>
  | Prisma.TransactionClient;

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
      description: dto.description ?? null,
      code: dto.code,
      thumbnailUrl: null,
      config: {},
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
          description: template.description,
          code,
          thumbnailUrl: template.thumbnailUrl,
          config: toInputJson(
            this.cloneJsonValue(template.config as JsonValue),
          ),
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

  async createSystemTemplate(
    dto: CreateSystemFunnelTemplateDto,
  ): Promise<Funnel> {
    const workspaceId = await this.resolveSystemTemplateWorkspaceId();
    const name = this.sanitizeRequiredText(dto.name, 'name');
    const description = this.sanitizeOptionalText(dto.description);
    const status = this.resolveTemplateStatus(dto.status);
    const stages = this.resolveStages(dto.stages);
    const entrySources = this.resolveEntrySources(dto.entrySources);
    const thumbnailUrl = this.sanitizeOptionalText(dto.thumbnailUrl);
    const config = this.resolveFunnelConfig(dto.config);
    const code = await this.createAvailableCode(this.prisma, workspaceId, name);

    const record = await this.prisma.funnel.create({
      data: {
        workspaceId,
        name,
        description,
        code,
        thumbnailUrl,
        config: toInputJson(config),
        status,
        isTemplate: true,
        stages,
        entrySources: entrySources.map((item) => this.toDbSource(item)),
        defaultTeamId: null,
        defaultRotationPoolId: null,
      },
    });

    return mapFunnelRecord(record);
  }

  async listSystemTemplates(): Promise<Funnel[]> {
    const records = await this.prisma.funnel.findMany({
      where: {
        isTemplate: true,
        defaultTeamId: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapFunnelRecord);
  }

  async getSystemTemplate(templateId: string): Promise<Funnel> {
    const record = await this.findSystemTemplateRecord(templateId);
    return mapFunnelRecord(record);
  }

  async updateSystemTemplate(
    templateId: string,
    dto: UpdateSystemFunnelTemplateDto,
  ): Promise<Funnel> {
    const existing = await this.findSystemTemplateRecord(templateId);
    const name =
      dto.name === undefined
        ? existing.name
        : this.sanitizeRequiredText(dto.name, 'name');
    const description =
      dto.description === undefined
        ? existing.description
        : this.sanitizeOptionalText(dto.description);
    const status =
      dto.status === undefined
        ? existing.status
        : this.resolveTemplateStatus(dto.status);
    const stages =
      dto.stages === undefined
        ? existing.stages
        : this.resolveStages(dto.stages);
    const entrySources =
      dto.entrySources === undefined
        ? existing.entrySources.map((item) =>
            item === 'landing_page' ? 'landing-page' : item,
          )
        : this.resolveEntrySources(dto.entrySources);
    const thumbnailUrl =
      dto.thumbnailUrl === undefined
        ? existing.thumbnailUrl
        : this.sanitizeOptionalText(dto.thumbnailUrl);
    const config =
      dto.config === undefined
        ? this.cloneJsonValue(existing.config as JsonValue)
        : this.resolveFunnelConfig(dto.config);

    const record = await this.prisma.funnel.update({
      where: { id: existing.id },
      data: {
        name,
        description,
        status,
        stages,
        entrySources: entrySources.map((item) => this.toDbSource(item)),
        thumbnailUrl,
        config: toInputJson(config),
        isTemplate: true,
        defaultTeamId: null,
        defaultRotationPoolId: null,
      },
    });

    return mapFunnelRecord(record);
  }

  async deleteSystemTemplate(templateId: string): Promise<{
    id: string;
    deleted: true;
  }> {
    const existing = await this.findSystemTemplateRecord(templateId);

    await this.prisma.funnel.delete({
      where: { id: existing.id },
    });

    return {
      id: existing.id,
      deleted: true,
    };
  }

  private resolveCloneName(originalName: string, nextName?: string) {
    const normalized = nextName?.trim();
    return normalized ? normalized : `Copia de ${originalName}`;
  }

  private resolveFunnelConfig(value: JsonValue | undefined): JsonValue {
    return this.cloneJsonValue(value ?? {});
  }

  private cloneJsonValue(value: JsonValue): JsonValue {
    return JSON.parse(JSON.stringify(value)) as JsonValue;
  }

  private async findSystemTemplateRecord(templateId: string) {
    const normalizedTemplateId = this.sanitizeRequiredText(
      templateId,
      'templateId',
    );
    const record = await this.prisma.funnel.findFirst({
      where: {
        id: normalizedTemplateId,
        isTemplate: true,
        defaultTeamId: null,
      },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'FUNNEL_TEMPLATE_NOT_FOUND',
        message: 'The requested funnel template was not found.',
      });
    }

    return record;
  }

  private async resolveSystemTemplateWorkspaceId() {
    const existingTemplate = await this.prisma.funnel.findFirst({
      where: {
        isTemplate: true,
        defaultTeamId: null,
      },
      select: {
        workspaceId: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (existingTemplate?.workspaceId) {
      return existingTemplate.workspaceId;
    }

    const workspace = await this.prisma.workspace.findFirst({
      select: {
        id: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (!workspace) {
      throw new ConflictException({
        code: 'SYSTEM_TEMPLATE_WORKSPACE_UNAVAILABLE',
        message:
          'A workspace is required before creating the first global funnel template.',
      });
    }

    return workspace.id;
  }

  private async createUniqueCode(
    tx: FunnelCodeLookupClient,
    workspaceId: string,
    sourceCode: string,
  ) {
    return this.createCodeWithFallback(
      tx,
      workspaceId,
      this.normalizeCode(`${sourceCode}-copy`),
      'FUNNEL_CLONE_CODE_CONFLICT',
      'We could not generate a unique code for the cloned funnel.',
    );
  }

  private async createAvailableCode(
    tx: FunnelCodeLookupClient,
    workspaceId: string,
    sourceName: string,
  ) {
    return this.createCodeWithFallback(
      tx,
      workspaceId,
      this.normalizeCode(sourceName),
      'FUNNEL_TEMPLATE_CODE_CONFLICT',
      'We could not generate a unique code for the funnel template.',
    );
  }

  private async createCodeWithFallback(
    tx: FunnelCodeLookupClient,
    workspaceId: string,
    baseCode: string,
    errorCode: string,
    errorMessage: string,
  ) {
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
      code: errorCode,
      message: errorMessage,
    });
  }

  private sanitizeRequiredText(
    value: string | null | undefined,
    field: string,
  ) {
    if (typeof value !== 'string') {
      throw new BadRequestException({
        code: 'FIELD_REQUIRED',
        message: `${field} is required.`,
        field,
      });
    }

    const trimmed = value.trim();

    if (!trimmed) {
      throw new BadRequestException({
        code: 'FIELD_REQUIRED',
        message: `${field} is required.`,
        field,
      });
    }

    return trimmed;
  }

  private sanitizeOptionalText(value: string | null | undefined) {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private resolveTemplateStatus(status?: string): Funnel['status'] {
    if (!status) {
      return 'draft';
    }

    if (ALLOWED_FUNNEL_STATUSES.includes(status as Funnel['status'])) {
      return status as Funnel['status'];
    }

    throw new BadRequestException({
      code: 'INVALID_FUNNEL_STATUS',
      message: 'status must be one of: draft, active, archived.',
      field: 'status',
    });
  }

  private resolveStages(stages?: string[]) {
    if (!stages) {
      return [...DEFAULT_TEMPLATE_STAGES];
    }

    if (!Array.isArray(stages) || stages.length === 0) {
      throw new BadRequestException({
        code: 'INVALID_FUNNEL_STAGES',
        message: 'stages must contain at least one valid stage.',
        field: 'stages',
      });
    }

    const normalized = stages.map((item) => item.trim()).filter(Boolean);

    if (normalized.length === 0) {
      throw new BadRequestException({
        code: 'INVALID_FUNNEL_STAGES',
        message: 'stages must contain at least one valid stage.',
        field: 'stages',
      });
    }

    return normalized;
  }

  private resolveEntrySources(
    entrySources?: Funnel['entrySources'],
  ): Funnel['entrySources'] {
    if (!entrySources) {
      return [...DEFAULT_TEMPLATE_ENTRY_SOURCES];
    }

    const allowed = new Set<Funnel['entrySources'][number]>([
      'manual',
      'form',
      'landing-page',
      'api',
      'import',
      'automation',
    ]);

    if (!Array.isArray(entrySources) || entrySources.length === 0) {
      throw new BadRequestException({
        code: 'INVALID_FUNNEL_ENTRY_SOURCES',
        message:
          'entrySources must contain at least one supported lead source.',
        field: 'entrySources',
      });
    }

    const normalized = entrySources.map((item) => {
      const value = item.trim() as Funnel['entrySources'][number];

      if (!allowed.has(value)) {
        throw new BadRequestException({
          code: 'INVALID_FUNNEL_ENTRY_SOURCE',
          message: `Unsupported entry source: ${item}.`,
          field: 'entrySources',
        });
      }

      return value;
    });

    return normalized;
  }

  private toDbSource(value: Funnel['entrySources'][number]) {
    return value === 'landing-page' ? 'landing_page' : value;
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
