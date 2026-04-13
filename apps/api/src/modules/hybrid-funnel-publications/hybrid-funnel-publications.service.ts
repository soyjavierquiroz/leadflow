import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePublicationPathPrefix } from '../shared/publication-resolution.utils';
import type { JsonValue } from '../shared/domain.types';
import type { CreateTeamHybridFunnelPublicationDto } from './dto/create-team-hybrid-funnel-publication.dto';
import type { UpdateTeamHybridFunnelPublicationDto } from './dto/update-team-hybrid-funnel-publication.dto';

const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const DEFAULT_STRUCTURE_ID = 'split-media-focus';

const asJsonRecord = (value: JsonValue | null | undefined) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : null;

const funnelThemeIds = ['default', 'expert-secrets'] as const;
type FunnelThemeId = (typeof funnelThemeIds)[number];

const isFunnelThemeId = (value: unknown): value is FunnelThemeId =>
  typeof value === 'string' &&
  (funnelThemeIds as readonly string[]).includes(value);

type TeamScope = {
  workspaceId: string;
  teamId: string;
};

type HybridPublicationStepDetail = {
  id: string;
  slug: string;
  stepType: string;
  position: number;
  isEntryStep: boolean;
  isConversionStep: boolean;
  blocksJson: JsonValue;
  mediaMap: JsonValue;
  settingsJson: JsonValue;
};

type HybridPublicationDetail = {
  publication: {
    id: string;
    funnelInstanceId: string;
    domainId: string;
    pathPrefix: string;
    status: string;
    isPrimary: boolean;
  };
  funnelInstance: {
    id: string;
    templateId: string;
    name: string;
    code: string;
    status: string;
    settingsJson: JsonValue;
  };
  step: {
    id: string;
    slug: string;
    stepType: string;
    position: number;
    blocksJson: JsonValue;
    mediaMap: JsonValue;
    settingsJson: JsonValue;
  };
  steps: HybridPublicationStepDetail[];
  seo: {
    title: string;
    metaDescription: string;
  };
};

type FunnelStepHistoryEntry = {
  id: string;
  stepId: string;
  blocksJson: JsonValue;
  settingsJson: JsonValue;
  createdAt: Date;
  createdBy: string | null;
};

@Injectable()
export class HybridFunnelPublicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findForSystemTenant(
    teamId: string,
    publicationId: string,
  ): Promise<HybridPublicationDetail> {
    const scope = await this.resolveSystemScope(teamId);
    return this.findForTeam(scope, publicationId);
  }

  async listStepHistoryForSystemTenant(
    teamId: string,
    publicationId: string,
    stepId: string,
  ): Promise<FunnelStepHistoryEntry[]> {
    const scope = await this.resolveSystemScope(teamId);
    return this.listStepHistoryForTeam(scope, publicationId, stepId);
  }

  async findForTeam(
    scope: TeamScope,
    publicationId: string,
  ): Promise<HybridPublicationDetail> {
    const publication = await this.prisma.funnelPublication.findFirst({
      where: {
        id: publicationId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
      include: {
        funnelInstance: {
          include: {
            legacyFunnel: {
              select: {
                config: true,
              },
            },
            steps: {
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    if (!publication) {
      throw new NotFoundException({
        code: 'HYBRID_PUBLICATION_NOT_FOUND',
        message: 'The requested hybrid funnel publication was not found.',
      });
    }

    const step =
      publication.funnelInstance.steps.find((item) => item.isEntryStep) ??
      publication.funnelInstance.steps[0];

    if (!step) {
      throw new NotFoundException({
        code: 'HYBRID_PUBLICATION_STEP_NOT_FOUND',
        message: 'The selected funnel instance does not have a landing step.',
      });
    }

    const steps = publication.funnelInstance.steps.map((item) =>
      this.mapPublicationStepDetail(item),
    );

    return {
      publication: {
        id: publication.id,
        funnelInstanceId: publication.funnelInstanceId,
        domainId: publication.domainId,
        pathPrefix: publication.pathPrefix,
        status: publication.status,
        isPrimary: publication.isPrimary,
      },
      funnelInstance: {
        id: publication.funnelInstance.id,
        templateId: publication.funnelInstance.templateId,
        name: publication.funnelInstance.name,
        code: publication.funnelInstance.code,
        status: publication.funnelInstance.status,
        settingsJson: publication.funnelInstance.settingsJson as JsonValue,
      },
      step: {
        id: step.id,
        slug: step.slug,
        stepType: step.stepType,
        position: step.position,
        blocksJson: step.blocksJson as JsonValue,
        mediaMap: step.mediaMap as JsonValue,
        settingsJson: step.settingsJson as JsonValue,
      },
      steps,
      seo: this.extractSeo(
        step.settingsJson as JsonValue,
        publication.funnelInstance.name,
      ),
    };
  }

  async listStepHistoryForTeam(
    scope: TeamScope,
    publicationId: string,
    stepId: string,
  ): Promise<FunnelStepHistoryEntry[]> {
    const step = await this.prisma.funnelStep.findFirst({
      where: {
        id: stepId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        funnelInstance: {
          is: {
            publications: {
              some: {
                id: publicationId,
                workspaceId: scope.workspaceId,
                teamId: scope.teamId,
              },
            },
          },
        },
      },
      include: {
        history: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 20,
        },
      },
    });

    if (!step) {
      throw new NotFoundException({
        code: 'HYBRID_PUBLICATION_STEP_NOT_FOUND',
        message:
          'The requested funnel step was not found for the selected publication.',
      });
    }

    return step.history.map((entry) => this.mapStepHistoryEntry(entry));
  }

  async createForTeam(
    scope: TeamScope,
    dto: CreateTeamHybridFunnelPublicationDto,
  ): Promise<HybridPublicationDetail> {
    const normalized = this.normalizeEditorInput({
      ...dto,
      settingsJson: dto.settingsJson,
    });

    await this.assertDomain(scope, normalized.domainId);
    const template = await this.assertTemplate(
      scope.workspaceId,
      normalized.templateId,
    );
    await this.assertPublicationPathConflict(
      normalized.domainId,
      normalized.pathPrefix,
    );

    const detail = await this.prisma.$transaction(async (tx) => {
      const code = await this.createUniqueCode(
        tx,
        scope.teamId,
        normalized.name,
        normalized.pathPrefix,
      );

      const legacyFunnel = await tx.funnel.create({
        data: {
          workspaceId: scope.workspaceId,
          name: normalized.name,
          code,
          config: toInputJson(
            this.buildLegacyFunnelConfig(
              null,
              template.id,
              template.code,
              normalized.theme,
              this.resolveStructureId(template.settingsJson as JsonValue),
              normalized.blocksJson,
              {
                title: normalized.seoTitle,
                metaDescription: normalized.metaDescription,
              },
            ),
          ),
          status: 'active',
          stages: ['captured', 'qualified', 'assigned'],
          entrySources: ['manual', 'form', 'landing_page', 'api'],
          defaultTeamId: scope.teamId,
          defaultRotationPoolId: null,
        },
      });

      const funnelInstance = await tx.funnelInstance.create({
        data: {
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
          templateId: template.id,
          legacyFunnelId: legacyFunnel.id,
          name: normalized.name,
          code,
          status: 'active',
          rotationPoolId: null,
          trackingProfileId: null,
          handoffStrategyId: template.defaultHandoffStrategyId ?? null,
          settingsJson: toInputJson(
            this.buildInstanceSettings(
              template.settingsJson as JsonValue,
              template.id,
              template.code,
              normalized.theme,
              this.resolveStructureId(template.settingsJson as JsonValue),
              normalized.blocksJson,
              {
                title: normalized.seoTitle,
                metaDescription: normalized.metaDescription,
              },
            ),
          ),
          mediaMap: toInputJson(normalized.mediaMap),
        },
      });

      const step = await tx.funnelStep.create({
        data: {
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
          funnelInstanceId: funnelInstance.id,
          stepType: 'landing',
          slug: 'landing',
          position: 1,
          isEntryStep: true,
          isConversionStep: false,
          blocksJson: toInputJson(normalized.blocksJson),
          mediaMap: toInputJson(normalized.mediaMap),
          settingsJson: toInputJson(
            this.buildStepSettings(template.code, normalized.blocksJson, {
              templateId: template.id,
              structureId: this.resolveStructureId(
                template.settingsJson as JsonValue,
              ),
              title: normalized.seoTitle,
              metaDescription: normalized.metaDescription,
              existingSettings: normalized.settingsJson,
            }),
          ),
        },
      });

      await tx.funnelPublication.updateMany({
        where: {
          domainId: normalized.domainId,
          teamId: scope.teamId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });

      const publication = await tx.funnelPublication.create({
        data: {
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
          domainId: normalized.domainId,
          funnelInstanceId: funnelInstance.id,
          trackingProfileId: null,
          handoffStrategyId: funnelInstance.handoffStrategyId,
          pathPrefix: normalized.pathPrefix,
          status: 'active',
          isActive: true,
          isPrimary: normalized.pathPrefix === '/',
        },
      });

      const confirmationStep = await tx.funnelStep.create({
        data: {
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
          funnelInstanceId: funnelInstance.id,
          stepType: 'thank_you',
          slug: 'confirmado',
          position: 2,
          isEntryStep: false,
          isConversionStep: true,
          blocksJson: toInputJson([]),
          mediaMap: toInputJson({}),
          settingsJson: toInputJson(
            this.buildStepSettings(template.code, [], {
              templateId: template.id,
              structureId: this.resolveStructureId(
                template.settingsJson as JsonValue,
              ),
              title: normalized.seoTitle,
              metaDescription: normalized.metaDescription,
              existingSettings: {},
            }),
          ),
        },
      });

      return {
        publication,
        funnelInstance,
        step,
        steps: [step, confirmationStep],
      };
    });

    return {
      publication: {
        id: detail.publication.id,
        funnelInstanceId: detail.publication.funnelInstanceId,
        domainId: detail.publication.domainId,
        pathPrefix: detail.publication.pathPrefix,
        status: detail.publication.status,
        isPrimary: detail.publication.isPrimary,
      },
      funnelInstance: {
        id: detail.funnelInstance.id,
        templateId: detail.funnelInstance.templateId,
        name: detail.funnelInstance.name,
        code: detail.funnelInstance.code,
        status: detail.funnelInstance.status,
        settingsJson: detail.funnelInstance.settingsJson as JsonValue,
      },
      step: {
        id: detail.step.id,
        slug: detail.step.slug,
        stepType: detail.step.stepType,
        position: detail.step.position,
        blocksJson: detail.step.blocksJson as JsonValue,
        mediaMap: detail.step.mediaMap as JsonValue,
        settingsJson: detail.step.settingsJson as JsonValue,
      },
      steps: detail.steps.map((item) => this.mapPublicationStepDetail(item)),
      seo: {
        title: normalized.seoTitle,
        metaDescription: normalized.metaDescription,
      },
    };
  }

  async updateForTeam(
    scope: TeamScope,
    publicationId: string,
    dto: UpdateTeamHybridFunnelPublicationDto,
    createdBy: string | null = null,
  ): Promise<HybridPublicationDetail> {
    const existing = await this.prisma.funnelPublication.findFirst({
      where: {
        id: publicationId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
      include: {
        funnelInstance: {
          include: {
            legacyFunnel: {
              select: {
                config: true,
              },
            },
            steps: {
              orderBy: { position: 'asc' },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'HYBRID_PUBLICATION_NOT_FOUND',
        message: 'The requested hybrid funnel publication was not found.',
      });
    }

    const entryStep =
      existing.funnelInstance.steps.find((item) => item.isEntryStep) ??
      existing.funnelInstance.steps[0];

    if (!entryStep) {
      throw new NotFoundException({
        code: 'HYBRID_PUBLICATION_STEP_NOT_FOUND',
        message: 'The selected funnel instance does not have a landing step.',
      });
    }

    const targetStep =
      this.resolveRequestedStep(
        existing.funnelInstance.steps,
        dto.stepId,
        dto.stepKey,
        entryStep.id,
      ) ?? entryStep;

    const normalized = this.normalizeEditorInput({
      name: dto.name ?? existing.funnelInstance.name,
      domainId: dto.domainId ?? existing.domainId,
      pathPrefix: dto.pathPrefix ?? existing.pathPrefix,
      templateId: dto.templateId ?? existing.funnelInstance.templateId,
      theme:
        dto.theme ??
        this.extractFunnelTheme(existing.funnelInstance.settingsJson as JsonValue) ??
        'default',
      seoTitle:
        dto.seoTitle ??
        this.extractSeo(
          entryStep.settingsJson as JsonValue,
          existing.funnelInstance.name,
        ).title,
      metaDescription:
        dto.metaDescription ??
        this.extractSeo(
          entryStep.settingsJson as JsonValue,
          existing.funnelInstance.name,
        ).metaDescription,
      blocksJson: (dto.blocksJson ?? targetStep.blocksJson) as JsonValue,
      mediaMap: (dto.mediaMap ?? targetStep.mediaMap) as JsonValue,
      settingsJson: (dto.settingsJson ?? targetStep.settingsJson) as JsonValue,
    });

    await this.assertDomain(scope, normalized.domainId);
    const template = await this.assertTemplate(
      scope.workspaceId,
      normalized.templateId,
    );
    await this.assertPublicationPathConflict(
      normalized.domainId,
      normalized.pathPrefix,
      existing.id,
    );

    const detail = await this.prisma.$transaction(async (tx) => {
      await tx.funnel.updateMany({
        where: { id: existing.funnelInstance.legacyFunnelId ?? '__missing__' },
        data: {
          name: normalized.name,
          config: toInputJson(
            this.buildLegacyFunnelConfig(
              asJsonRecord(existing.funnelInstance.legacyFunnel?.config as JsonValue),
              template.id,
              template.code,
              normalized.theme,
              this.resolveStructureId(
                entryStep.settingsJson as JsonValue,
                existing.funnelInstance.settingsJson as JsonValue,
                template.settingsJson as JsonValue,
              ),
              targetStep.id === entryStep.id
                ? normalized.blocksJson
                : (entryStep.blocksJson as JsonValue),
              {
                title: normalized.seoTitle,
                metaDescription: normalized.metaDescription,
              },
            ),
          ),
          status: 'active',
        },
      });

      const funnelInstance = await tx.funnelInstance.update({
        where: { id: existing.funnelInstance.id },
        data: {
          templateId: template.id,
          name: normalized.name,
          status: 'active',
          handoffStrategyId:
            template.defaultHandoffStrategyId ??
            existing.funnelInstance.handoffStrategyId,
          settingsJson: toInputJson(
            this.buildInstanceSettings(
              template.settingsJson as JsonValue,
              template.id,
              template.code,
              normalized.theme,
              this.resolveStructureId(
                entryStep.settingsJson as JsonValue,
                existing.funnelInstance.settingsJson as JsonValue,
                template.settingsJson as JsonValue,
              ),
              targetStep.id === entryStep.id
                ? normalized.blocksJson
                : (entryStep.blocksJson as JsonValue),
              {
                title: normalized.seoTitle,
                metaDescription: normalized.metaDescription,
              },
            ),
          ),
          mediaMap: toInputJson(
            targetStep.id === entryStep.id
              ? normalized.mediaMap
              : (entryStep.mediaMap as JsonValue),
          ),
        },
      });

      let ensuredTargetStep = targetStep;

      if (dto.stepKey === 'confirmado' && targetStep.id === entryStep.id) {
        const createdConfirmationStep = await tx.funnelStep.create({
          data: {
            workspaceId: scope.workspaceId,
            teamId: scope.teamId,
            funnelInstanceId: existing.funnelInstance.id,
            stepType: 'thank_you',
            slug: 'confirmado',
            position:
              Math.max(...existing.funnelInstance.steps.map((item) => item.position)) + 1,
            isEntryStep: false,
            isConversionStep: true,
            blocksJson: toInputJson(normalized.blocksJson),
            mediaMap: toInputJson(normalized.mediaMap),
            settingsJson: toInputJson(
              this.buildStepSettings(template.code, normalized.blocksJson, {
                templateId: template.id,
                structureId: this.resolveStructureId(
                  entryStep.settingsJson as JsonValue,
                  existing.funnelInstance.settingsJson as JsonValue,
                  template.settingsJson as JsonValue,
                ),
                title: normalized.seoTitle,
                metaDescription: normalized.metaDescription,
                existingSettings: normalized.settingsJson,
              }),
            ),
          },
        });

        ensuredTargetStep = createdConfirmationStep;
      } else {
        await this.snapshotStepHistory(
          tx,
          targetStep.id,
          targetStep.blocksJson as JsonValue,
          targetStep.settingsJson as JsonValue,
          createdBy,
        );
        ensuredTargetStep = await tx.funnelStep.update({
          where: { id: targetStep.id },
          data: {
            blocksJson: toInputJson(normalized.blocksJson),
            mediaMap: toInputJson(normalized.mediaMap),
            settingsJson: toInputJson(
              this.buildStepSettings(template.code, normalized.blocksJson, {
                templateId: template.id,
                structureId: this.resolveStructureId(
                  targetStep.settingsJson as JsonValue,
                  existing.funnelInstance.settingsJson as JsonValue,
                  template.settingsJson as JsonValue,
                ),
                title: normalized.seoTitle,
                metaDescription: normalized.metaDescription,
                existingSettings: normalized.settingsJson,
              }),
            ),
          },
        });
      }

      if (targetStep.id !== entryStep.id && (dto.seoTitle !== undefined || dto.metaDescription !== undefined)) {
        await this.snapshotStepHistory(
          tx,
          entryStep.id,
          entryStep.blocksJson as JsonValue,
          entryStep.settingsJson as JsonValue,
          createdBy,
        );
        await tx.funnelStep.update({
          where: { id: entryStep.id },
          data: {
            settingsJson: toInputJson(
              this.buildStepSettings(
                template.code,
                entryStep.blocksJson as JsonValue,
                {
                  templateId: template.id,
                  structureId: this.resolveStructureId(
                    entryStep.settingsJson as JsonValue,
                    existing.funnelInstance.settingsJson as JsonValue,
                    template.settingsJson as JsonValue,
                  ),
                  title: normalized.seoTitle,
                  metaDescription: normalized.metaDescription,
                  existingSettings: entryStep.settingsJson as JsonValue,
                },
              ),
            ),
          },
        });
      }

      const shouldBePrimary =
        normalized.pathPrefix === '/' || existing.isPrimary;
      if (shouldBePrimary) {
        await tx.funnelPublication.updateMany({
          where: {
            domainId: normalized.domainId,
            teamId: scope.teamId,
            isPrimary: true,
            NOT: { id: existing.id },
          },
          data: {
            isPrimary: false,
          },
        });
      }

      const publication = await tx.funnelPublication.update({
        where: { id: existing.id },
        data: {
          domainId: normalized.domainId,
          funnelInstanceId: existing.funnelInstance.id,
          handoffStrategyId: funnelInstance.handoffStrategyId,
          pathPrefix: normalized.pathPrefix,
          status: 'active',
          isActive: true,
          isPrimary: shouldBePrimary,
        },
      });

      const steps = await tx.funnelStep.findMany({
        where: {
          funnelInstanceId: existing.funnelInstance.id,
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
        },
        orderBy: { position: 'asc' },
      });

      return {
        publication,
        funnelInstance,
        step: ensuredTargetStep,
        steps,
      };
    });

    return {
      publication: {
        id: detail.publication.id,
        funnelInstanceId: detail.publication.funnelInstanceId,
        domainId: detail.publication.domainId,
        pathPrefix: detail.publication.pathPrefix,
        status: detail.publication.status,
        isPrimary: detail.publication.isPrimary,
      },
      funnelInstance: {
        id: detail.funnelInstance.id,
        templateId: detail.funnelInstance.templateId,
        name: detail.funnelInstance.name,
        code: detail.funnelInstance.code,
        status: detail.funnelInstance.status,
        settingsJson: detail.funnelInstance.settingsJson as JsonValue,
      },
      step: {
        id: detail.step.id,
        slug: detail.step.slug,
        stepType: detail.step.stepType,
        position: detail.step.position,
        blocksJson: detail.step.blocksJson as JsonValue,
        mediaMap: detail.step.mediaMap as JsonValue,
        settingsJson: detail.step.settingsJson as JsonValue,
      },
      steps: detail.steps.map((item) => this.mapPublicationStepDetail(item)),
      seo: {
        title: normalized.seoTitle,
        metaDescription: normalized.metaDescription,
      },
    };
  }

  async updateForSystemTenant(
    teamId: string,
    publicationId: string,
    dto: UpdateTeamHybridFunnelPublicationDto,
    createdBy: string | null = null,
  ): Promise<HybridPublicationDetail> {
    const scope = await this.resolveSystemScope(teamId);
    return this.updateForTeam(scope, publicationId, dto, createdBy);
  }

  private normalizeEditorInput(input: {
    name: string;
    domainId: string;
    pathPrefix: string;
    templateId: string;
    theme?: string;
    seoTitle?: string;
    metaDescription?: string;
    blocksJson: JsonValue;
    mediaMap: JsonValue;
    settingsJson?: JsonValue;
  }) {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        code: 'HYBRID_FUNNEL_NAME_REQUIRED',
        message: 'A funnel name is required.',
      });
    }

    const pathPrefix = normalizePublicationPathPrefix(input.pathPrefix);
    const blocksJson = this.assertBlocksJson(input.blocksJson);
    const mediaMap = this.assertMediaMap(input.mediaMap);

    if (!input.domainId) {
      throw new BadRequestException({
        code: 'HYBRID_FUNNEL_DOMAIN_REQUIRED',
        message: 'An active domain is required.',
      });
    }

    if (!input.templateId) {
      throw new BadRequestException({
        code: 'HYBRID_FUNNEL_TEMPLATE_REQUIRED',
        message: 'A funnel template is required.',
      });
    }

    return {
      name,
      domainId: input.domainId,
      pathPrefix,
      templateId: input.templateId,
      theme: this.normalizeFunnelTheme(input.theme),
      seoTitle: (input.seoTitle ?? name).trim() || name,
      metaDescription: (input.metaDescription ?? '').trim(),
      blocksJson,
      mediaMap,
      settingsJson: this.assertSettingsJson(input.settingsJson),
    };
  }

  private assertBlocksJson(value: JsonValue) {
    if (!Array.isArray(value)) {
      throw new BadRequestException({
        code: 'HYBRID_BLOCKS_JSON_INVALID',
        message: 'The blocksJson payload must be a JSON array.',
      });
    }

    return value;
  }

  private assertMediaMap(value: JsonValue) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException({
        code: 'HYBRID_MEDIA_MAP_INVALID',
        message: 'The mediaMap payload must be a JSON object.',
      });
    }

    return value;
  }

  private assertSettingsJson(value: JsonValue | undefined) {
    if (value === undefined || value === null) {
      return {} as JsonValue;
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException({
        code: 'HYBRID_SETTINGS_JSON_INVALID',
        message: 'The settingsJson payload must be a JSON object.',
      });
    }

    return value;
  }

  private mapPublicationStepDetail(step: {
    id: string;
    slug: string;
    stepType: string;
    position: number;
    isEntryStep: boolean;
    isConversionStep: boolean;
    blocksJson: unknown;
    mediaMap: unknown;
    settingsJson: unknown;
  }): HybridPublicationStepDetail {
    return {
      id: step.id,
      slug: step.slug,
      stepType: step.stepType,
      position: step.position,
      isEntryStep: step.isEntryStep,
      isConversionStep: step.isConversionStep,
      blocksJson: step.blocksJson as JsonValue,
      mediaMap: step.mediaMap as JsonValue,
      settingsJson: step.settingsJson as JsonValue,
    };
  }

  private mapStepHistoryEntry(entry: {
    id: string;
    stepId: string;
    blocksJson: unknown;
    settingsJson: unknown;
    createdAt: Date;
    createdBy: string | null;
  }): FunnelStepHistoryEntry {
    return {
      id: entry.id,
      stepId: entry.stepId,
      blocksJson: entry.blocksJson as JsonValue,
      settingsJson: entry.settingsJson as JsonValue,
      createdAt: entry.createdAt,
      createdBy: entry.createdBy,
    };
  }

  private async snapshotStepHistory(
    tx: Prisma.TransactionClient,
    stepId: string,
    blocksJson: JsonValue,
    settingsJson: JsonValue,
    createdBy: string | null,
  ) {
    await tx.funnelStepHistory.create({
      data: {
        stepId,
        blocksJson: toInputJson(blocksJson),
        settingsJson: toInputJson(settingsJson),
        createdBy,
      },
    });

    const versionsToKeep = await tx.funnelStepHistory.findMany({
      where: { stepId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 20,
      select: { id: true },
    });

    if (versionsToKeep.length === 0) {
      return;
    }

    await tx.funnelStepHistory.deleteMany({
      where: {
        id: {
          in: versionsToKeep.map((entry) => entry.id),
        },
      },
    });
  }

  private resolveRequestedStep<
    T extends {
      id: string;
      slug: string;
      stepType: string;
      position: number;
      isEntryStep: boolean;
      isConversionStep: boolean;
      blocksJson: unknown;
      mediaMap: unknown;
      settingsJson: unknown;
    },
  >(
    steps: T[],
    stepId: string | undefined,
    stepKey: 'captura' | 'confirmado' | undefined,
    entryStepId: string,
  ): T | undefined {
    if (stepId) {
      const directMatch = steps.find((item) => item.id === stepId);
      if (directMatch) {
        return directMatch;
      }
    }

    if (stepKey === 'captura') {
      return (
        steps.find((item) => item.slug === 'captura') ??
        steps.find((item) => item.id === entryStepId) ??
        steps[0]
      );
    }

    if (stepKey === 'confirmado') {
      return (
        steps.find((item) => item.slug === 'confirmado') ??
        steps.find((item) =>
          ['handoff', 'confirmation', 'thank_you', 'redirect'].includes(
            item.stepType,
          ),
        ) ??
        steps.find((item) => item.id !== entryStepId) ??
        steps.find((item) => item.id === entryStepId) ??
        steps[0]
      );
    }

    return steps.find((item) => item.id === entryStepId) ?? steps[0];
  }

  private buildInstanceSettings(
    templateSettings: JsonValue,
    templateId: string,
    templateCode: string,
    theme: FunnelThemeId,
    structureId: string,
    blocksJson: JsonValue,
    seo: {
      title: string;
      metaDescription: string;
    },
  ): JsonValue {
    const safeTemplateSettings =
      templateSettings &&
      typeof templateSettings === 'object' &&
      !Array.isArray(templateSettings)
        ? (templateSettings as Record<string, JsonValue>)
        : {};

    return {
      ...safeTemplateSettings,
      theme,
      structureId,
      hybridEditor: {
        mode: 'data-driven-assembly',
        templateId,
        templateCode,
        structureId,
        blocksJson,
      },
      seo,
    };
  }

  private buildStepSettings(
    templateCode: string,
    blocksJson: JsonValue,
    input: {
      templateId: string;
      structureId: string;
      title: string;
      metaDescription: string;
      existingSettings?: JsonValue;
    },
  ): JsonValue {
    const safeExistingSettings = asJsonRecord(input.existingSettings) ?? {};
    const safeExistingSeo = asJsonRecord(safeExistingSettings.seo) ?? {};

    return {
      ...safeExistingSettings,
      editorSource: 'team-publications-new-vsl',
      templateId: input.templateId,
      templateCode,
      structureId: input.structureId,
      hybridRenderer: 'jakawi-bridge',
      blocksJson,
      seo: {
        ...safeExistingSeo,
        title: input.title,
        metaDescription: input.metaDescription,
      },
    };
  }

  private buildLegacyFunnelConfig(
    existingConfig: Record<string, JsonValue> | null,
    templateId: string,
    templateCode: string,
    theme: FunnelThemeId,
    structureId: string,
    blocksJson: JsonValue,
    seo: {
      title: string;
      metaDescription: string;
    },
  ): JsonValue {
    const safeConfig = existingConfig ?? {};
    const safeHybridEditor = asJsonRecord(safeConfig.hybridEditor) ?? {};
    const safeContent = asJsonRecord(safeConfig.content) ?? {};
    const safeSeo = asJsonRecord(safeConfig.seo) ?? {};

    return {
      ...safeConfig,
      theme,
      templateId,
      templateCode,
      structureId,
      blocksJson,
      hybridEditor: {
        ...safeHybridEditor,
        mode: 'data-driven-assembly',
        templateId,
        templateCode,
        structureId,
        blocksJson,
      },
      content: {
        ...safeContent,
        templateId,
        templateCode,
        structureId,
        blocksJson,
      },
      seo: {
        ...safeSeo,
        title: seo.title,
        metaDescription: seo.metaDescription,
      },
    };
  }

  private resolveStructureId(...sources: (JsonValue | null | undefined)[]) {
    for (const source of sources) {
      const safeSource = asJsonRecord(source);
      const directStructureId = safeSource?.structureId;
      if (
        typeof directStructureId === 'string' &&
        directStructureId.trim().length > 0
      ) {
        return directStructureId.trim();
      }

      const hybridEditor = asJsonRecord(safeSource?.hybridEditor);
      const nestedStructureId = hybridEditor?.structureId;
      if (
        typeof nestedStructureId === 'string' &&
        nestedStructureId.trim().length > 0
      ) {
        return nestedStructureId.trim();
      }
    }

    return DEFAULT_STRUCTURE_ID;
  }

  private extractSeo(stepSettings: JsonValue, fallbackTitle: string) {
    const safeStepSettings =
      stepSettings &&
      typeof stepSettings === 'object' &&
      !Array.isArray(stepSettings)
        ? (stepSettings as Record<string, JsonValue>)
        : {};
    const seoValue = safeStepSettings.seo;
    const safeSeo =
      seoValue && typeof seoValue === 'object' && !Array.isArray(seoValue)
        ? (seoValue as Record<string, JsonValue>)
        : {};

    return {
      title:
        (typeof safeSeo.title === 'string' && safeSeo.title.trim()) ||
        fallbackTitle,
      metaDescription:
        (typeof safeSeo.metaDescription === 'string' &&
          safeSeo.metaDescription.trim()) ||
        '',
    };
  }

  private normalizeFunnelTheme(value: string | undefined): FunnelThemeId {
    if (value === undefined) {
      return 'default';
    }

    const normalizedValue = value.trim();
    if (!isFunnelThemeId(normalizedValue)) {
      throw new BadRequestException({
        code: 'HYBRID_FUNNEL_THEME_INVALID',
        message: `theme must be one of: ${funnelThemeIds.join(', ')}.`,
      });
    }

    return normalizedValue;
  }

  private extractFunnelTheme(settingsJson: JsonValue): FunnelThemeId | null {
    const settings = asJsonRecord(settingsJson);
    const theme = settings?.theme;

    return isFunnelThemeId(theme) ? theme : null;
  }

  private async assertDomain(scope: TeamScope, domainId: string) {
    const domain = await this.prisma.domain.findFirst({
      where: {
        id: domainId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        status: 'active',
      },
    });

    if (!domain) {
      throw new NotFoundException({
        code: 'HYBRID_DOMAIN_NOT_FOUND',
        message: 'The selected active domain is not available for this team.',
      });
    }

    return domain;
  }

  private async assertTemplate(workspaceId: string, templateId: string) {
    const template = await this.prisma.funnelTemplate.findFirst({
      where: {
        id: templateId,
        status: {
          in: ['active', 'draft'],
        },
        OR: [{ workspaceId }, { workspaceId: null }],
      },
    });

    if (!template) {
      throw new NotFoundException({
        code: 'HYBRID_TEMPLATE_NOT_FOUND',
        message: 'The selected template is not available.',
      });
    }

    return template;
  }

  private async assertPublicationPathConflict(
    domainId: string,
    pathPrefix: string,
    excludePublicationId?: string,
  ) {
    const conflict = await this.prisma.funnelPublication.findFirst({
      where: {
        domainId,
        pathPrefix,
        ...(excludePublicationId ? { NOT: { id: excludePublicationId } } : {}),
      },
      select: { id: true },
    });

    if (conflict) {
      throw new ConflictException({
        code: 'HYBRID_PUBLICATION_PATH_CONFLICT',
        message: 'Another publication already uses this domain and path.',
      });
    }
  }

  private async createUniqueCode(
    tx: Prisma.TransactionClient,
    teamId: string,
    name: string,
    pathPrefix: string,
  ) {
    const baseCode = this.normalizeCode(`${name}-${pathPrefix}`);

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = attempt === 0 ? baseCode : `${baseCode}-${attempt + 1}`;
      const existing = await tx.funnelInstance.findFirst({
        where: {
          teamId,
          code,
        },
        select: { id: true },
      });

      if (!existing) {
        return code;
      }
    }

    throw new ConflictException({
      code: 'HYBRID_FUNNEL_CODE_CONFLICT',
      message: 'We could not generate a unique code for this funnel.',
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
        code: 'HYBRID_FUNNEL_CODE_REQUIRED',
        message: 'A valid internal code is required for the funnel.',
      });
    }

    return normalized;
  }

  private async resolveSystemScope(teamId: string): Promise<TeamScope> {
    const normalizedTeamId = teamId.trim();

    if (!normalizedTeamId) {
      throw new BadRequestException({
        code: 'HYBRID_TEAM_REQUIRED',
        message: 'A tenant id is required.',
      });
    }

    const team = await this.prisma.team.findUnique({
      where: { id: normalizedTeamId },
      select: {
        id: true,
        workspaceId: true,
      },
    });

    if (!team) {
      throw new NotFoundException({
        code: 'HYBRID_TEAM_NOT_FOUND',
        message: 'The selected tenant was not found.',
      });
    }

    return {
      workspaceId: team.workspaceId,
      teamId: team.id,
    };
  }
}
