import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  FunnelStepType,
  Prisma,
  type FunnelTemplate as PrismaFunnelTemplate,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { mapFunnelRecord, mapFunnelTemplateRecord } from '../../prisma/prisma.mappers';
import { StorageService } from '../storage/storage.service';
import type { JsonValue } from '../shared/domain.types';
import { assertSupportedFunnelBlocksJson } from '../shared/funnel-block-validation';
import type { DeployTemplateDto } from './dto/deploy-template.dto';
import type { CreateTemplateDto } from './dto/create-template.dto';
import type { UpdateTemplateDto } from './dto/update-template.dto';

const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

type FunnelCodeLookupClient =
  | Pick<PrismaService, 'funnel' | 'funnelInstance'>
  | Prisma.TransactionClient;

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getStepDefaults(input: {
    workspaceId: string;
    templateKey?: string | null;
    stepType: FunnelStepType;
  }): Promise<{
    blocksJson: JsonValue;
    mediaMap: JsonValue;
    settingsJson: JsonValue;
  }> {
    const templateKey = this.sanitizeOptionalText(input.templateKey);

    if (templateKey) {
      try {
        this.logger.debug(
          `Resolving step defaults from templateKey="${templateKey}" for workspace ${input.workspaceId} and stepType ${input.stepType}.`,
        );

        const template = await this.prisma.funnelTemplate.findFirst({
          where: {
            status: {
              in: ['active', 'draft'],
            },
            OR: [
              { id: templateKey },
              { code: templateKey },
              { name: { equals: templateKey, mode: 'insensitive' } },
            ],
            AND: [
              {
                OR: [{ workspaceId: input.workspaceId }, { workspaceId: null }],
              },
            ],
          },
          orderBy: [{ workspaceId: 'desc' }, { updatedAt: 'desc' }],
        });

        if (template) {
          return {
            blocksJson: template.blocksJson as JsonValue,
            mediaMap: template.mediaMap as JsonValue,
            settingsJson: template.settingsJson as JsonValue,
          };
        }
      } catch (error) {
        this.logger.warn(
          `Template lookup failed for templateKey="${templateKey}" in workspace ${input.workspaceId}. Falling back to in-memory defaults. ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        );
      }
    }

    return this.buildStepDefaults(templateKey, input.stepType);
  }

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

    if (dto.mediaMap !== undefined && dto.hardDeleteAssets === true) {
      await this.deleteRemovedMediaAssets(
        existing.mediaMap as JsonValue,
        mediaMap,
        existing.id,
      );
    }

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
    return this.deployTemplate(templateId, dto);
  }

  async deployTemplate(templateId: string, dto: DeployTemplateDto) {
    const teamId = this.sanitizeRequiredText(dto.teamId, 'teamId');
    const cloneName = this.sanitizeRequiredText(dto.cloneName, 'cloneName');
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

    const deployment = await this.prisma.$transaction(async (tx) => {
      const code = await this.createUniqueFunnelCode(
        tx,
        team.workspaceId,
        team.id,
        cloneName,
      );

      const funnel = await tx.funnel.create({
        data: {
          workspaceId: team.workspaceId,
          name: cloneName,
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

      const funnelInstance = await tx.funnelInstance.create({
        data: {
          workspaceId: team.workspaceId,
          teamId: team.id,
          templateId: template.id,
          funnelId: funnel.id,
          name: cloneName,
          code,
          thumbnailUrl: null,
          status: 'active',
          rotationPoolId: null,
          trackingProfileId: null,
          handoffStrategyId: template.defaultHandoffStrategyId ?? null,
          settingsJson: toInputJson(
            this.buildInstanceSettings(template, cloneName),
          ),
          mediaMap: toInputJson(template.mediaMap as JsonValue),
        },
      });

      await tx.funnelStep.createMany({
        data: this.buildDeploymentSteps({
          template,
          funnelName: cloneName,
          workspaceId: team.workspaceId,
          teamId: team.id,
          funnelInstanceId: funnelInstance.id,
        }),
      });

      return { funnel, funnelInstance };
    });

    const builderUrl = `/admin/tenants/${team.id}/funnels/${deployment.funnel.id}/builder`;

    return {
      funnel: mapFunnelRecord(deployment.funnel),
      funnelInstanceId: deployment.funnelInstance.id,
      newFunnelId: deployment.funnel.id,
      builderUrl,
      template: this.mapTemplateResponse(template),
      team: {
        id: team.id,
        workspaceId: team.workspaceId,
        name: team.name,
        code: team.code,
      },
    };
  }

  private buildDeploymentSteps(input: {
    template: PrismaFunnelTemplate;
    funnelName: string;
    workspaceId: string;
    teamId: string;
    funnelInstanceId: string;
  }): Prisma.FunnelStepCreateManyInput[] {
    const { template, funnelName, workspaceId, teamId, funnelInstanceId } = input;

    return [
      {
        workspaceId,
        teamId,
        funnelInstanceId,
        stepType: FunnelStepType.landing,
        slug: 'captura',
        position: 1,
        isEntryStep: true,
        isConversionStep: true,
        blocksJson: toInputJson(
          this.cloneJsonValue(template.blocksJson as JsonValue),
        ),
        mediaMap: toInputJson(this.cloneJsonValue(template.mediaMap as JsonValue)),
        settingsJson: toInputJson(
          this.buildLandingStepSettings(template, funnelName),
        ),
      },
      {
        workspaceId,
        teamId,
        funnelInstanceId,
        stepType: FunnelStepType.confirmation,
        slug: 'confirmado',
        position: 2,
        isEntryStep: false,
        isConversionStep: false,
        blocksJson: toInputJson(this.buildConfirmationStepBlocks(funnelName)),
        mediaMap: toInputJson(this.cloneJsonValue(template.mediaMap as JsonValue)),
        settingsJson: toInputJson(
          this.buildConfirmationStepSettings(template, funnelName),
        ),
      },
    ];
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

  private buildInstanceSettings(
    template: PrismaFunnelTemplate,
    funnelName: string,
  ): JsonValue {
    const current = this.asRecord(template.settingsJson as JsonValue);

    return {
      ...current,
      theme: template.code,
      locale: this.readString(current.locale) ?? 'es',
      structureId: this.readString(current.structureId) ?? template.code,
      hybridEditor: {
        ...this.asRecord(current.hybridEditor),
        mode: 'data-driven-assembly',
        templateId: template.id,
        structureId: this.readString(current.structureId) ?? template.code,
        blocksJson: template.blocksJson as JsonValue,
      },
      seo: {
        ...this.asRecord(current.seo),
        title: funnelName,
        metaDescription:
          this.readString(this.asRecord(current.seo).metaDescription) ??
          `Publicación base de ${funnelName} desplegada desde el catálogo moderno.`,
      },
    };
  }

  private buildLandingStepSettings(
    template: PrismaFunnelTemplate,
    funnelName: string,
  ): JsonValue {
    const current = this.asRecord(template.settingsJson as JsonValue);
    const structureId = this.readString(current.structureId) ?? template.code;

    return {
      ...current,
      editorSource: 'system-template-deploy',
      isBoilerplate: true,
      templateId: template.id,
      templateCode: template.code,
      structureId,
      hybridRenderer: 'jakawi-bridge',
      blocksJson: template.blocksJson as JsonValue,
      seo: {
        ...this.asRecord(current.seo),
        title: funnelName,
        metaDescription:
          this.readString(this.asRecord(current.seo).metaDescription) ??
          `Landing principal de ${funnelName}.`,
      },
    };
  }

  private buildConfirmationStepSettings(
    template: PrismaFunnelTemplate,
    funnelName: string,
  ): JsonValue {
    const current = this.asRecord(template.settingsJson as JsonValue);
    const structureId = this.readString(current.structureId) ?? template.code;

    return {
      ...current,
      editorSource: 'system-template-deploy',
      isBoilerplate: true,
      templateId: template.id,
      templateCode: template.code,
      structureId,
      hybridRenderer: 'jakawi-bridge',
      blocksJson: this.buildConfirmationStepBlocks(funnelName),
      seo: {
        ...this.asRecord(current.seo),
        title: `${funnelName} - Confirmación`,
        metaDescription: `Paso de confirmación de ${funnelName}.`,
      },
    };
  }

  private buildConfirmationStepBlocks(funnelName: string): JsonValue {
    return [
      {
        type: 'hero',
        key: 'confirmacion-principal',
        eyebrow: 'Confirmación',
        title: 'Tu registro fue recibido',
        description: `El funnel ${funnelName} quedó operativo sobre el catálogo moderno.`,
      },
    ];
  }

  private asRecord(value: JsonValue | null | undefined): Record<string, JsonValue> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, JsonValue>;
  }

  private readString(value: JsonValue | undefined): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private buildStepDefaults(
    templateKey: string | null,
    stepType: FunnelStepType,
  ): {
    blocksJson: JsonValue;
    mediaMap: JsonValue;
    settingsJson: JsonValue;
  } {
    const normalizedTemplateKey =
      templateKey?.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_') ??
      stepType;
    const title = this.humanizeTemplateKey(normalizedTemplateKey);

    return {
      blocksJson: [
        {
          type: 'hero',
          key: `${normalizedTemplateKey}_hero`,
          eyebrow: 'Nuevo paso',
          headline: title,
          subheadline:
            'Este paso fue creado desde el Step Manager. Ajusta el copy y conecta sus salidas en el FlowGraph.',
        },
      ],
      mediaMap: {},
      settingsJson: {
        source: 'step-manager-defaults',
        templateKey: normalizedTemplateKey,
        title,
        stepType,
      },
    };
  }

  private humanizeTemplateKey(value: string) {
    return value
      .split(/[-_]+/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
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
    teamId: string,
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

      if (existing) {
        continue;
      }

      const existingInstance = await tx.funnelInstance.findFirst({
        where: {
          teamId,
          code,
        },
        select: { id: true },
      });

      if (!existingInstance) {
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
    return assertSupportedFunnelBlocksJson(value, {
      invalidArrayCode: 'TEMPLATE_BLOCKS_INVALID',
      invalidArrayMessage: 'The blocks payload must be a JSON array.',
      invalidBlockCode: 'TEMPLATE_BLOCK_TYPE_INVALID',
      field: 'blocks',
    });
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

  private async deleteRemovedMediaAssets(
    existingMediaMap: JsonValue,
    nextMediaMap: JsonValue,
    templateId: string,
  ) {
    const previousUrls = this.collectStorageUrls(existingMediaMap);
    const nextUrls = this.collectStorageUrls(nextMediaMap);
    const removedUrls = [...previousUrls].filter((url) => !nextUrls.has(url));

    for (const removedUrl of removedUrls) {
      try {
        console.log(
          '[TemplateService] Deleting removed media asset from storage',
          {
            templateId,
            key: this.extractStorageObjectKey(removedUrl),
            url: removedUrl,
          },
        );
        await this.storageService.deletePublicObject(removedUrl);
      } catch (error) {
        this.logger.error(
          `Failed to delete media asset "${removedUrl}" for template ${templateId}.`,
          error instanceof Error ? error.stack : undefined,
        );
        throw new InternalServerErrorException({
          code: 'TEMPLATE_MEDIA_DELETE_FAILED',
          message:
            'The selected media file could not be deleted from storage, so the Media Dictionary entry was not removed.',
          assetUrl: removedUrl,
        });
      }
    }
  }

  private extractStorageObjectKey(publicUrl: string): string | null {
    try {
      const pathParts = new URL(publicUrl).pathname
        .split('/')
        .filter(Boolean)
        .map((segment) => decodeURIComponent(segment));
      return pathParts.slice(1).join('/') || null;
    } catch {
      return null;
    }
  }

  private collectStorageUrls(value: JsonValue): Set<string> {
    const urls = new Set<string>();
    this.walkJsonValue(value, urls);
    return urls;
  }

  private walkJsonValue(value: JsonValue, urls: Set<string>) {
    if (typeof value === 'string') {
      const normalizedUrl = this.normalizeStorageUrl(value);

      if (normalizedUrl) {
        urls.add(normalizedUrl);
      }

      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this.walkJsonValue(item, urls);
      }

      return;
    }

    if (value && typeof value === 'object') {
      for (const nestedValue of Object.values(value)) {
        this.walkJsonValue(nestedValue, urls);
      }
    }
  }

  private normalizeStorageUrl(value: string): string | null {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    try {
      const normalizedUrl = new URL(trimmed).toString();
      return this.storageService.isManagedPublicUrl(normalizedUrl)
        ? normalizedUrl
        : null;
    } catch {
      return null;
    }
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

  private cloneJsonValue(value: JsonValue): JsonValue {
    if (value === null || typeof value !== 'object') {
      return value;
    }

    return JSON.parse(JSON.stringify(value)) as JsonValue;
  }
}
