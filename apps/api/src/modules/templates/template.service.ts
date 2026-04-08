import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type FunnelTemplate as PrismaFunnelTemplate } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { mapFunnelRecord, mapFunnelTemplateRecord } from '../../prisma/prisma.mappers';
import type { JsonValue } from '../shared/domain.types';
import type { DeployTemplateDto } from './dto/deploy-template.dto';
import type { CreateTemplateDto } from './dto/create-template.dto';
import type { UpdateTemplateDto } from './dto/update-template.dto';

const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

type FunnelCodeLookupClient =
  | Pick<PrismaService, 'funnel'>
  | Prisma.TransactionClient;

@Injectable()
export class TemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTemplateDto) {
    const name = this.sanitizeRequiredText(dto.name, 'name');
    const description = this.sanitizeOptionalText(dto.description);
    const blocks = this.assertBlocks(dto.blocks);
    const mediaMap = this.assertMediaMap(dto.mediaMap ?? {});
    const code = await this.createAvailableTemplateCode(name);

    const record = await this.prisma.funnelTemplate.create({
      data: {
        workspaceId: null,
        name,
        description,
        code,
        status: 'draft',
        version: 1,
        funnelType: 'hybrid',
        blocksJson: toInputJson(blocks),
        mediaMap: toInputJson(mediaMap),
        settingsJson: toInputJson({}),
        allowedOverridesJson: toInputJson({}),
        defaultHandoffStrategyId: null,
      },
    });

    return this.mapTemplateResponse(record);
  }

  async list() {
    const records = await this.prisma.funnelTemplate.findMany({
      where: {
        workspaceId: null,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return records.map((record) => this.mapTemplateResponse(record));
  }

  async getById(templateId: string) {
    const record = await this.findTemplateRecord(templateId);
    return this.mapTemplateResponse(record);
  }

  async update(templateId: string, dto: UpdateTemplateDto) {
    const existing = await this.findTemplateRecord(templateId);
    const name =
      dto.name === undefined
        ? existing.name
        : this.sanitizeRequiredText(dto.name, 'name');
    const description =
      dto.description === undefined
        ? existing.description
        : this.sanitizeOptionalText(dto.description);
    const blocks =
      dto.blocks === undefined
        ? (existing.blocksJson as JsonValue)
        : this.assertBlocks(dto.blocks);
    const mediaMap =
      dto.mediaMap === undefined
        ? (existing.mediaMap as JsonValue)
        : this.assertMediaMap(dto.mediaMap);

    const record = await this.prisma.funnelTemplate.update({
      where: { id: existing.id },
      data: {
        name,
        description,
        blocksJson: toInputJson(blocks),
        mediaMap: toInputJson(mediaMap),
      },
    });

    return this.mapTemplateResponse(record);
  }

  async deploy(templateId: string, dto: DeployTemplateDto) {
    const teamId = this.sanitizeRequiredText(dto.teamId, 'teamId');
    const template = await this.findTemplateRecord(templateId);
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        code: true,
      },
    });

    if (!team) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: 'The selected tenant was not found.',
      });
    }

    const record = await this.prisma.$transaction(async (tx) => {
      const code = await this.createUniqueFunnelCode(
        tx,
        team.workspaceId,
        template.code,
      );

      return tx.funnel.create({
        data: {
          workspaceId: team.workspaceId,
          name: template.name,
          description: template.description,
          code,
          thumbnailUrl: null,
          config: toInputJson({
            source: 'global-template-engine',
            template: {
              id: template.id,
              code: template.code,
              name: template.name,
              version: template.version,
              funnelType: template.funnelType,
            },
            blocks: template.blocksJson as JsonValue,
            mediaMap: template.mediaMap as JsonValue,
            settings: template.settingsJson as JsonValue,
          }),
          status: 'active',
          isTemplate: false,
          stages: ['captured', 'qualified', 'assigned'],
          entrySources: ['manual', 'form', 'landing_page', 'api'],
          defaultTeamId: team.id,
          defaultRotationPoolId: null,
        },
      });
    });

    return {
      funnel: mapFunnelRecord(record),
      template: this.mapTemplateResponse(template),
      team: {
        id: team.id,
        workspaceId: team.workspaceId,
        name: team.name,
        code: team.code,
      },
    };
  }

  private mapTemplateResponse(record: PrismaFunnelTemplate) {
    const template = mapFunnelTemplateRecord(record);

    return {
      ...template,
      description: template.description,
      blocks: template.blocksJson,
      mediaMap: template.mediaMap,
    };
  }

  private async findTemplateRecord(templateId: string) {
    const normalizedTemplateId = this.sanitizeRequiredText(
      templateId,
      'templateId',
    );
    const record = await this.prisma.funnelTemplate.findFirst({
      where: {
        id: normalizedTemplateId,
        workspaceId: null,
      },
    });

    if (!record) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'The requested template was not found.',
      });
    }

    return record;
  }

  private async createAvailableTemplateCode(name: string) {
    const baseCode = this.normalizeCode(name);

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = attempt === 0 ? baseCode : `${baseCode}-${attempt + 1}`;
      const existing = await this.prisma.funnelTemplate.findFirst({
        where: { code },
        select: { id: true },
      });

      if (!existing) {
        return code;
      }
    }

    throw new ConflictException({
      code: 'TEMPLATE_CODE_CONFLICT',
      message: 'We could not generate a unique code for this template.',
    });
  }

  private async createUniqueFunnelCode(
    tx: FunnelCodeLookupClient,
    workspaceId: string,
    sourceCode: string,
  ) {
    const baseCode = this.normalizeCode(sourceCode);

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
      code: 'FUNNEL_CODE_CONFLICT',
      message: 'We could not generate a unique code for the deployed funnel.',
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

  private assertBlocks(value: JsonValue) {
    if (!Array.isArray(value)) {
      throw new BadRequestException({
        code: 'TEMPLATE_BLOCKS_INVALID',
        message: 'The blocks payload must be a JSON array.',
        field: 'blocks',
      });
    }

    return value;
  }

  private assertMediaMap(value: JsonValue) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException({
        code: 'TEMPLATE_MEDIA_MAP_INVALID',
        message: 'The mediaMap payload must be a JSON object.',
        field: 'mediaMap',
      });
    }

    return value;
  }

  private normalizeCode(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (!normalized) {
      throw new BadRequestException({
        code: 'TEMPLATE_CODE_REQUIRED',
        message: 'A valid template code is required.',
      });
    }

    return normalized;
  }
}
