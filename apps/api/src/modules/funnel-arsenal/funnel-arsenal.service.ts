import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  FunnelArsenalTemplateStatus,
  LibraryAssetVersionStatus,
  Prisma,
} from '@prisma/client';
import {
  getBusinessBlueprintByKey,
  getFunnelArsenalTemplateByKey,
  getFunnelArsenalTemplatesForBlueprint,
  funnelArsenalTemplates,
  type FunnelArsenalTemplate,
} from '@leadflow/account-model';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CommercialProfileService } from '../commercial-profile/commercial-profile.service';
import type { JsonValue } from '../shared/domain.types';
import type { CreateMarketplaceMasterFunnelDto } from './dto/create-marketplace-master-funnel.dto';
import type { CreateSystemFunnelArsenalTemplateDto } from './dto/create-system-funnel-arsenal-template.dto';
import type { UpdateSystemFunnelArsenalTemplateDto } from './dto/update-system-funnel-arsenal-template.dto';
import { FunnelMasterClonerService } from './funnel-master-cloner.service';
import { ensureLeadFlowArsenalWorkspace } from './leadflow-arsenal-workspace';

const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

type EnabledPublication = {
  id: string;
  pathPrefix: string;
  funnelInstanceId: string;
  domain: {
    host: string;
  };
};

type ArsenalTemplateDefinition = FunnelArsenalTemplate & {
  assetSlug: string;
  vertical: string;
  status: 'draft' | 'active' | 'archived';
  industry?: string | null;
  subindustry?: string | null;
  businessModel?: string | null;
  funnelType?: string | null;
  funnelFormat?: string | null;
  framework?: string | null;
  objective?: string | null;
  stepsCount?: number | null;
  language?: string | null;
  country?: string | null;
  market?: string | null;
  level?: string | null;
  estimatedTimeMinutes?: number | null;
  tags: string[];
  coverUrl?: string | null;
  thumbnailUrl?: string | null;
  screenshots: JsonValue;
  videoPreviewUrl?: string | null;
  headline?: string | null;
  version: string;
  authorName?: string | null;
  publishedAt?: Date | null;
  problemSolved?: string | null;
  idealFor?: string | null;
  flowSummary: JsonValue;
  compatibleBlueprints: string[];
  assets: JsonValue;
  media: JsonValue;
  history: JsonValue;
  cloneCount: number;
  activeInstallations: number;
  lastActivatedAt?: Date | null;
  favoriteCount: number;
  funnelTemplateId?: string | null;
  sourceFunnelId?: string | null;
  sourceFunnelInstanceId?: string | null;
  libraryAssetVersionId?: string | null;
};

type ArsenalTemplateView = ArsenalTemplateDefinition & {
  enabled: boolean;
  hasMasterFunnel: boolean;
  source?: 'master_clone' | 'fallback';
  warning?: string;
  funnelInstanceId?: string;
  publicationId?: string;
  publicUrl?: string;
  pathPrefix?: string;
};

type FunnelArsenalResponse = {
  blueprintKey: string | null;
  requiresCommercialProfile: boolean;
  templates: ArsenalTemplateView[];
};

type SystemFunnelArsenalTemplateView = ArsenalTemplateDefinition & {
  id?: string;
  hasMasterFunnel: boolean;
  sourceFunnelInstanceLabel?: string | null;
  builderUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type DbFunnelArsenalTemplate = Prisma.FunnelArsenalTemplateGetPayload<object>;

type SystemSourceFunnelInstanceInfo = {
  label: string;
  builderUrl: string | null;
  funnelId: string | null;
  teamId: string | null;
  workspaceId: string | null;
};

type MarketplaceMasterFunnelResponse = {
  sourceFunnelInstanceId: string;
  sourceFunnelId: string;
  builderUrl: string;
  workspaceId: string;
  teamId: string;
};

const slugifySegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const asJsonValue = (value: unknown, fallback: JsonValue): JsonValue =>
  value === undefined ? fallback : (value as JsonValue);

@Injectable()
export class FunnelArsenalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commercialProfileService: CommercialProfileService,
    private readonly funnelMasterClonerService: FunnelMasterClonerService,
  ) {}

  async listForCurrentTeam(
    user: AuthenticatedUser,
  ): Promise<FunnelArsenalResponse> {
    await this.commercialProfileService.assertCurrentTeamSupportsCommercialProfile(
      user,
    );

    const profile =
      await this.commercialProfileService.getCommercialProfileForTeam(
        user.teamId!,
      );

    if (
      !profile ||
      !this.commercialProfileService.isCommercialProfileComplete(profile)
    ) {
      return {
        blueprintKey: profile?.blueprintKey ?? null,
        requiresCommercialProfile: true,
        templates: [],
      };
    }

    const blueprintKey = profile.blueprintKey;
    const templates = await this.getTemplatesForBlueprint(blueprintKey);
    const enabledByCode = await this.getEnabledPublicationsByInstanceCode(
      user.teamId!,
      templates,
    );

    return {
      blueprintKey,
      requiresCommercialProfile: false,
      templates: templates.map((template) =>
        this.toTemplateView(
          template,
          enabledByCode.get(this.toInstanceCode(template)),
        ),
      ),
    };
  }

  async enableForCurrentTeam(
    user: AuthenticatedUser,
    templateKey: string,
  ): Promise<ArsenalTemplateView> {
    await this.commercialProfileService.assertCurrentTeamSupportsCommercialProfile(
      user,
    );

    const profile =
      await this.commercialProfileService.getCommercialProfileForTeam(
        user.teamId!,
      );

    if (
      !profile ||
      !this.commercialProfileService.isCommercialProfileComplete(profile)
    ) {
      throw new BadRequestException({
        code: 'FUNNEL_ARSENAL_COMMERCIAL_PROFILE_REQUIRED',
        message:
          'Complete your commercial profile before enabling funnel templates.',
      });
    }

    const blueprintKey = profile.blueprintKey;
    const template = await this.getTemplateForEnable(templateKey);

    if (!template || template.blueprintKey !== blueprintKey) {
      throw new BadRequestException({
        code: 'FUNNEL_ARSENAL_TEMPLATE_NOT_AVAILABLE',
        message:
          'This funnel template is not available for the current business blueprint.',
      });
    }

    const instanceCode = this.toInstanceCode(template);
    const existing = await this.findEnabledPublicationByInstanceCode(
      user.teamId!,
      instanceCode,
    );

    if (existing) {
      return this.toTemplateView(template, existing, {
        source: template.sourceFunnelInstanceId ? 'master_clone' : 'fallback',
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const existingInsideTransaction =
        await this.findEnabledPublicationByInstanceCode(
          user.teamId!,
          instanceCode,
          tx,
        );

      if (existingInsideTransaction) {
        return existingInsideTransaction;
      }

      const seo = this.buildSeo(template, profile?.businessName ?? null);
      if (template.sourceFunnelInstanceId) {
        const cloned =
          await this.funnelMasterClonerService.cloneMasterFunnelInstanceToTeamInTransaction(
            tx,
            {
              sourceFunnelInstanceId: template.sourceFunnelInstanceId,
              targetWorkspaceId: user.workspaceId!,
              targetTeamId: user.teamId!,
              targetSponsorId: user.sponsorId ?? undefined,
              requestedPath: template.pathSuggestion,
              publicationName: seo.title,
              createdByUserId: user.id,
              templateKey: template.templateKey,
              blueprintKey: template.blueprintKey,
              templateLabel: template.label,
              templateDescription: template.description,
              instanceCode,
            },
          );

        return {
          id: cloned.publicationId,
          pathPrefix: cloned.pathPrefix,
          funnelInstanceId: cloned.funnelInstanceId,
          domain: {
            host: new URL(cloned.publicUrl ?? 'https://leadflow.kuruk.in').host,
          },
        };
      }

      const funnelInstance = await this.createMinimalFunnelInstance(tx, {
        workspaceId: user.workspaceId!,
        teamId: user.teamId!,
        instanceCode,
        template,
        businessName: profile?.businessName,
        seo,
      });
      const publicationTarget =
        await this.funnelMasterClonerService.resolvePublicationTarget(tx, {
          workspaceId: user.workspaceId!,
          teamId: user.teamId!,
          teamSlug: user.team?.code ?? user.team?.name ?? user.teamId!,
          requestedPath: template.pathSuggestion,
        });

      return tx.funnelPublication.create({
        data: {
          workspaceId: user.workspaceId!,
          teamId: user.teamId!,
          domainId: publicationTarget.domainId,
          funnelInstanceId: funnelInstance.id,
          trackingProfileId: null,
          handoffStrategyId: null,
          seoTitle: seo.title,
          seoDescription: seo.description,
          ogImageUrl: null,
          faviconUrl: null,
          manifestVersion: 1,
          runtimeHealthStatus: 'healthy',
          metaPixelId: null,
          tiktokPixelId: null,
          metaCapiToken: null,
          tiktokAccessToken: null,
          pathPrefix: publicationTarget.pathPrefix,
          status: 'active',
          isActive: true,
          isPrimary: false,
        },
        select: {
          id: true,
          pathPrefix: true,
          funnelInstanceId: true,
          domain: {
            select: {
              host: true,
            },
          },
        },
      });
    });

    await this.recordTemplateActivation(template.templateKey);

    return this.toTemplateView(template, created, {
      source: template.sourceFunnelInstanceId ? 'master_clone' : 'fallback',
    });
  }

  async listSystemTemplates(): Promise<SystemFunnelArsenalTemplateView[]> {
    const records = await this.prisma.funnelArsenalTemplate.findMany({
      orderBy: [{ blueprintKey: 'asc' }, { label: 'asc' }],
    });
    const sourceInfo = await this.resolveSystemSourceFunnelInstanceInfo(
      records.map((record) => record.sourceFunnelInstanceId),
    );

    return records.map((record) =>
      this.mapDbTemplate(record, {
        sourceFunnelInstanceLabel:
          sourceInfo.get(record.sourceFunnelInstanceId ?? '')?.label ?? null,
        builderUrl:
          sourceInfo.get(record.sourceFunnelInstanceId ?? '')?.builderUrl ??
          null,
      }),
    );
  }

  async getSystemTemplate(
    assetSlug: string,
  ): Promise<SystemFunnelArsenalTemplateView> {
    const record = await this.findTemplateRecordBySlug(assetSlug);

    if (!record) {
      throw new NotFoundException({
        code: 'FUNNEL_MARKETPLACE_ASSET_NOT_FOUND',
        message: 'The requested funnel marketplace asset was not found.',
      });
    }

    const [sourceInfo] = await Promise.all([
      this.resolveSystemSourceFunnelInstanceInfo([
        record.sourceFunnelInstanceId,
      ]),
    ]);

    return this.mapDbTemplate(record, {
      sourceFunnelInstanceLabel:
        sourceInfo.get(record.sourceFunnelInstanceId ?? '')?.label ?? null,
      builderUrl:
        sourceInfo.get(record.sourceFunnelInstanceId ?? '')?.builderUrl ?? null,
    });
  }

  async createSystemMarketplaceMasterFunnel(
    assetSlug: string,
    dto: CreateMarketplaceMasterFunnelDto = {},
  ): Promise<MarketplaceMasterFunnelResponse> {
    const record = await this.findTemplateRecordBySlug(assetSlug);

    if (!record) {
      throw new NotFoundException({
        code: 'FUNNEL_MARKETPLACE_ASSET_NOT_FOUND',
        message: 'The requested funnel marketplace asset was not found.',
      });
    }

    const template = await this.resolveLibraryVersionForTemplate(
      this.mapDbTemplate(record),
      {
        requirePublished: false,
      },
    );

    if (template.sourceFunnelInstanceId) {
      return this.resolveExistingMasterFunnelResponse(
        record,
        template.sourceFunnelInstanceId,
        template.sourceFunnelId,
      );
    }

    const arsenal = await ensureLeadFlowArsenalWorkspace(this.prisma);
    const name = this.optionalText(dto.name) ?? `${template.label} — Master`;
    const baseTemplateCode = this.optionalText(dto.baseTemplateCode);

    const created = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.funnelArsenalTemplate.findUnique({
        where: { id: record.id },
      });

      if (!latest) {
        throw new NotFoundException({
          code: 'FUNNEL_MARKETPLACE_ASSET_NOT_FOUND',
          message: 'The requested funnel marketplace asset was not found.',
        });
      }

      if (latest.sourceFunnelInstanceId) {
        const source = await tx.funnelInstance.findUnique({
          where: { id: latest.sourceFunnelInstanceId },
          select: {
            id: true,
            workspaceId: true,
            teamId: true,
            funnelId: true,
          },
        });

        if (!source?.funnelId) {
          throw new NotFoundException({
            code: 'FUNNEL_MARKETPLACE_MASTER_NOT_FOUND',
            message:
              'The existing Master Funnel is missing its builder funnel link.',
          });
        }

        return {
          sourceFunnelInstanceId: source.id,
          sourceFunnelId: source.funnelId,
          workspaceId: source.workspaceId,
          teamId: source.teamId,
        };
      }

      const existingMaster = await tx.funnelInstance.findFirst({
        where: {
          teamId: arsenal.teamId,
          code: this.toMasterInstanceCode(template),
        },
        select: {
          id: true,
          workspaceId: true,
          teamId: true,
          funnelId: true,
        },
      });

      if (existingMaster?.funnelId) {
        await tx.funnelArsenalTemplate.update({
          where: { id: latest.id },
          data: {
            sourceFunnelInstanceId: existingMaster.id,
            sourceFunnelId: existingMaster.funnelId,
          },
        });

        return {
          sourceFunnelInstanceId: existingMaster.id,
          sourceFunnelId: existingMaster.funnelId,
          workspaceId: existingMaster.workspaceId,
          teamId: existingMaster.teamId,
        };
      }

      const master = await this.createMasterFunnelInstance(tx, {
        workspaceId: arsenal.workspaceId,
        teamId: arsenal.teamId,
        template,
        name,
        baseTemplateCode,
      });

      await tx.funnelArsenalTemplate.update({
        where: { id: latest.id },
        data: {
          sourceFunnelInstanceId: master.id,
          sourceFunnelId: master.funnelId,
        },
      });

      if (latest.libraryAssetVersionId) {
        await tx.libraryFunnelVersion.upsert({
          where: {
            assetVersionId: latest.libraryAssetVersionId,
          },
          create: {
            assetVersionId: latest.libraryAssetVersionId,
            sourceFunnelInstanceId: master.id,
            sourceFunnelId: master.funnelId,
            stepsCount: template.stepsCount,
            framework: template.framework,
            difficulty: template.difficulty,
            estimatedMinutes: template.estimatedTimeMinutes,
            flowSummary: toInputJson(template.flowSummary),
          },
          update: {
            sourceFunnelInstanceId: master.id,
            sourceFunnelId: master.funnelId,
            stepsCount: template.stepsCount,
            framework: template.framework,
            difficulty: template.difficulty,
            estimatedMinutes: template.estimatedTimeMinutes,
            flowSummary: toInputJson(template.flowSummary),
          },
        });
      }

      return {
        sourceFunnelInstanceId: master.id,
        sourceFunnelId: master.funnelId,
        workspaceId: arsenal.workspaceId,
        teamId: arsenal.teamId,
      };
    });

    return {
      ...created,
      builderUrl: this.toBuilderUrl(created.teamId, created.sourceFunnelId),
    };
  }

  async getTemplateForCurrentTeam(
    user: AuthenticatedUser,
    assetSlug: string,
  ): Promise<ArsenalTemplateView> {
    const snapshot = await this.listForCurrentTeam(user);
    const template = snapshot.templates.find(
      (item) =>
        item.assetSlug === assetSlug ||
        item.templateKey === assetSlug ||
        slugifySegment(item.label) === assetSlug,
    );

    if (!template) {
      throw new NotFoundException({
        code: 'FUNNEL_MARKETPLACE_ASSET_NOT_FOUND',
        message: 'The requested funnel marketplace asset was not found.',
      });
    }

    return template;
  }

  async getSystemPreviewRuntime(assetSlug: string, stepSlug?: string) {
    const record = await this.findTemplateRecordBySlug(assetSlug);

    if (!record) {
      throw new NotFoundException({
        code: 'FUNNEL_MARKETPLACE_ASSET_NOT_FOUND',
        message: 'The requested funnel marketplace asset was not found.',
      });
    }

    const template = await this.resolveLibraryVersionForTemplate(
      this.mapDbTemplate(record),
      {
        requirePublished: true,
      },
    );

    return this.buildPreviewRuntime(template, stepSlug);
  }

  async getPreviewRuntimeForCurrentTeam(
    user: AuthenticatedUser,
    assetSlug: string,
    stepSlug?: string,
  ) {
    const template = await this.resolveLibraryVersionForTemplate(
      await this.getTemplateForCurrentTeam(user, assetSlug),
      {
        requirePublished: true,
      },
    );

    return this.buildPreviewRuntime(template, stepSlug);
  }

  async createSystemTemplate(dto: CreateSystemFunnelArsenalTemplateDto) {
    await this.assertSourceFunnelInstanceExists(dto.sourceFunnelInstanceId);
    await this.assertLibraryAssetVersionExists(dto.libraryAssetVersionId);
    const data = this.buildSystemTemplateData(dto, {
      requireAllFields: true,
    }) as Prisma.FunnelArsenalTemplateUncheckedCreateInput;

    const record = await this.prisma.funnelArsenalTemplate.create({
      data,
    });

    return this.mapDbTemplate(record);
  }

  async updateSystemTemplate(
    templateKey: string,
    dto: UpdateSystemFunnelArsenalTemplateDto,
  ) {
    const existing = await this.prisma.funnelArsenalTemplate.findUnique({
      where: {
        templateKey,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'FUNNEL_ARSENAL_TEMPLATE_NOT_FOUND',
        message: 'The requested funnel arsenal template was not found.',
      });
    }

    await this.assertSourceFunnelInstanceExists(dto.sourceFunnelInstanceId);
    await this.assertLibraryAssetVersionExists(dto.libraryAssetVersionId);
    const data = this.buildSystemTemplateData(dto, {
      requireAllFields: false,
    }) as Prisma.FunnelArsenalTemplateUncheckedUpdateInput;

    const record = await this.prisma.funnelArsenalTemplate.update({
      where: {
        templateKey,
      },
      data,
    });

    return this.mapDbTemplate(record);
  }

  async archiveSystemTemplate(templateKey: string) {
    const record = await this.prisma.funnelArsenalTemplate.update({
      where: {
        templateKey,
      },
      data: {
        status: FunnelArsenalTemplateStatus.archived,
      },
    });

    return this.mapDbTemplate(record);
  }

  async seedStaticTemplates() {
    const results = [];

    for (const template of funnelArsenalTemplates) {
      const blueprint = getBusinessBlueprintByKey(template.blueprintKey);
      const record = await this.prisma.funnelArsenalTemplate.upsert({
        where: {
          templateKey: template.templateKey,
        },
        create: {
          templateKey: template.templateKey,
          assetSlug: slugifySegment(template.templateKey),
          blueprintKey: template.blueprintKey,
          vertical:
            blueprint?.vertical ?? this.resolveVertical(template.blueprintKey),
          industry: null,
          businessModel: null,
          funnelType: null,
          funnelFormat: null,
          objective: template.goal,
          stepsCount: null,
          language: 'es',
          level: template.difficulty,
          tags: [
            blueprint?.vertical ?? this.resolveVertical(template.blueprintKey),
            template.difficulty,
          ],
          country: null,
          market: null,
          label: template.label,
          description: template.description,
          headline: template.label,
          goal: template.goal,
          recommendedFor: template.recommendedFor,
          cta: template.cta,
          pathSuggestion: template.pathSuggestion,
          difficulty: template.difficulty,
          status: FunnelArsenalTemplateStatus.active,
          version: '1.0.0',
          authorName: 'LeadFlow',
          problemSolved: template.description,
          idealFor: template.recommendedFor,
          compatibleBlueprints: [template.blueprintKey],
          flowSummaryJson: toInputJson([
            { label: 'Landing', description: template.description },
            { label: 'Captura', description: template.cta },
          ]),
          blocksPresetKey: template.blocksPresetKey ?? null,
          funnelTemplateId: null,
          sourceFunnelId: null,
          sourceFunnelInstanceId: null,
        },
        update: {
          assetSlug: slugifySegment(template.templateKey),
          blueprintKey: template.blueprintKey,
          vertical:
            blueprint?.vertical ?? this.resolveVertical(template.blueprintKey),
          objective: template.goal,
          language: 'es',
          level: template.difficulty,
          label: template.label,
          description: template.description,
          headline: template.label,
          goal: template.goal,
          recommendedFor: template.recommendedFor,
          cta: template.cta,
          pathSuggestion: template.pathSuggestion,
          difficulty: template.difficulty,
          status: FunnelArsenalTemplateStatus.active,
          compatibleBlueprints: [template.blueprintKey],
          blocksPresetKey: template.blocksPresetKey ?? null,
        },
      });

      results.push(this.mapDbTemplate(record));
    }

    return {
      count: results.length,
      templates: results,
    };
  }

  private async getTemplatesForBlueprint(
    blueprintKey: string,
  ): Promise<ArsenalTemplateDefinition[]> {
    const dbTemplates = await this.prisma.funnelArsenalTemplate.findMany({
      where: {
        blueprintKey,
        status: FunnelArsenalTemplateStatus.active,
      },
      orderBy: [{ label: 'asc' }],
    });

    if (dbTemplates.length > 0) {
      return Promise.all(
        dbTemplates.map((template) =>
          this.resolveLibraryVersionForTemplate(this.mapDbTemplate(template), {
            requirePublished: false,
          }),
        ),
      );
    }

    return getFunnelArsenalTemplatesForBlueprint(blueprintKey).map((template) =>
      this.mapStaticTemplate(template),
    );
  }

  private async getTemplateForEnable(
    templateKey: string,
  ): Promise<ArsenalTemplateDefinition | undefined> {
    const dbTemplate = await this.prisma.funnelArsenalTemplate.findFirst({
      where: {
        templateKey,
        status: FunnelArsenalTemplateStatus.active,
      },
    });

    if (dbTemplate) {
      return this.resolveLibraryVersionForTemplate(this.mapDbTemplate(dbTemplate), {
        requirePublished: true,
      });
    }

    const staticTemplate = getFunnelArsenalTemplateByKey(templateKey);

    return staticTemplate ? this.mapStaticTemplate(staticTemplate) : undefined;
  }

  private buildSystemTemplateData(
    dto:
      | CreateSystemFunnelArsenalTemplateDto
      | UpdateSystemFunnelArsenalTemplateDto,
    options: {
      requireAllFields: boolean;
    },
  ): Partial<Prisma.FunnelArsenalTemplateUncheckedCreateInput> &
    Prisma.FunnelArsenalTemplateUncheckedUpdateInput {
    const required = (value: string | null | undefined, field: string) => {
      const normalized = this.optionalText(value);

      if (!normalized && options.requireAllFields) {
        throw new BadRequestException({
          code: 'FIELD_REQUIRED',
          field,
          message: `${field} is required.`,
        });
      }

      return normalized;
    };
    const status = this.normalizeStatus(dto.status);
    const difficulty = this.normalizeDifficulty(dto.difficulty);
    const data: Partial<Prisma.FunnelArsenalTemplateUncheckedCreateInput> &
      Prisma.FunnelArsenalTemplateUncheckedUpdateInput = {};

    const templateKey = required(dto.templateKey, 'templateKey');
    const assetSlug = this.nullableText(dto.assetSlug);
    const blueprintKey = required(dto.blueprintKey, 'blueprintKey');
    const vertical = required(dto.vertical, 'vertical');
    const industry = this.nullableText(dto.industry);
    const subindustry = this.nullableText(dto.subindustry);
    const businessModel = this.nullableText(dto.businessModel);
    const funnelType = this.nullableText(dto.funnelType);
    const funnelFormat = this.nullableText(dto.funnelFormat);
    const framework = this.nullableText(dto.framework);
    const objective = this.nullableText(dto.objective);
    const language = this.nullableText(dto.language);
    const country = this.nullableText(dto.country);
    const market = this.nullableText(dto.market);
    const level = this.nullableText(dto.level);
    const stepsCount = this.normalizeOptionalPositiveInteger(dto.stepsCount);
    const estimatedTimeMinutes = this.normalizeOptionalPositiveInteger(
      dto.estimatedTimeMinutes,
    );
    const label = required(dto.label, 'label');
    const description = required(dto.description, 'description');
    const headline = this.nullableText(dto.headline);
    const goal = required(dto.goal, 'goal');
    const recommendedFor = required(dto.recommendedFor, 'recommendedFor');
    const cta = required(dto.cta, 'cta');
    const pathSuggestion = required(dto.pathSuggestion, 'pathSuggestion');
    const version = this.nullableText(dto.version);
    const authorName = this.nullableText(dto.authorName);
    const publishedAt = this.normalizeOptionalDate(dto.publishedAt);
    const problemSolved = this.nullableText(dto.problemSolved);
    const idealFor = this.nullableText(dto.idealFor);
    const cloneCount = this.normalizeOptionalNonNegativeInteger(dto.cloneCount);
    const activeInstallations = this.normalizeOptionalNonNegativeInteger(
      dto.activeInstallations,
    );
    const lastActivatedAt = this.normalizeOptionalDate(dto.lastActivatedAt);
    const favoriteCount = this.normalizeOptionalNonNegativeInteger(
      dto.favoriteCount,
    );

    if (templateKey) data.templateKey = templateKey;
    if (assetSlug !== undefined) {
      data.assetSlug =
        assetSlug || (templateKey ? slugifySegment(templateKey) : null);
    } else if (templateKey && options.requireAllFields) {
      data.assetSlug = slugifySegment(templateKey);
    }
    if (blueprintKey) data.blueprintKey = blueprintKey;
    if (vertical) data.vertical = vertical;
    if (industry !== undefined) data.industry = industry;
    if (subindustry !== undefined) data.subindustry = subindustry;
    if (businessModel !== undefined) data.businessModel = businessModel;
    if (funnelType !== undefined) data.funnelType = funnelType;
    if (funnelFormat !== undefined) data.funnelFormat = funnelFormat;
    if (framework !== undefined) data.framework = framework;
    if (objective !== undefined) data.objective = objective;
    if (stepsCount !== undefined) data.stepsCount = stepsCount;
    if (language !== undefined) data.language = language ?? 'es';
    if (country !== undefined) data.country = country;
    if (market !== undefined) data.market = market;
    if (level !== undefined) data.level = level;
    if (estimatedTimeMinutes !== undefined) {
      data.estimatedTimeMinutes = estimatedTimeMinutes;
    }
    if ('tags' in dto) data.tags = this.normalizeStringList(dto.tags);
    if ('coverUrl' in dto) data.coverUrl = this.nullableText(dto.coverUrl);
    if ('thumbnailUrl' in dto) {
      data.thumbnailUrl = this.nullableText(dto.thumbnailUrl);
    }
    if ('screenshots' in dto) {
      data.screenshotsJson = toInputJson(
        asJsonValue(dto.screenshots, [] as JsonValue),
      );
    }
    if ('videoPreviewUrl' in dto) {
      data.videoPreviewUrl = this.nullableText(dto.videoPreviewUrl);
    }
    if (label) data.label = label;
    if (description) data.description = description;
    if (headline !== undefined) data.headline = headline;
    if (goal) data.goal = goal;
    if (recommendedFor) data.recommendedFor = recommendedFor;
    if (cta) data.cta = cta;
    if (pathSuggestion) data.pathSuggestion = pathSuggestion;
    if (difficulty) data.difficulty = difficulty;
    if (status) data.status = status;
    if (version !== undefined) data.version = version ?? '1.0.0';
    if (authorName !== undefined) data.authorName = authorName;
    if (publishedAt !== undefined) data.publishedAt = publishedAt;
    if (problemSolved !== undefined) data.problemSolved = problemSolved;
    if (idealFor !== undefined) data.idealFor = idealFor;
    if ('flowSummary' in dto) {
      data.flowSummaryJson = toInputJson(
        asJsonValue(dto.flowSummary, [] as JsonValue),
      );
    }
    if ('compatibleBlueprints' in dto) {
      data.compatibleBlueprints = this.normalizeStringList(
        dto.compatibleBlueprints,
      );
    } else if (blueprintKey && options.requireAllFields) {
      data.compatibleBlueprints = [blueprintKey];
    }
    if ('assets' in dto) {
      data.assetsJson = toInputJson(asJsonValue(dto.assets, {} as JsonValue));
    }
    if ('media' in dto) {
      data.mediaJson = toInputJson(asJsonValue(dto.media, {} as JsonValue));
    }
    if ('history' in dto) {
      data.historyJson = toInputJson(asJsonValue(dto.history, [] as JsonValue));
    }
    if (cloneCount !== undefined) data.cloneCount = cloneCount ?? 0;
    if (activeInstallations !== undefined) {
      data.activeInstallations = activeInstallations ?? 0;
    }
    if (lastActivatedAt !== undefined) data.lastActivatedAt = lastActivatedAt;
    if (favoriteCount !== undefined) data.favoriteCount = favoriteCount ?? 0;

    if ('blocksPresetKey' in dto) {
      data.blocksPresetKey = this.nullableText(dto.blocksPresetKey);
    }

    if ('funnelTemplateId' in dto) {
      data.funnelTemplateId = this.nullableText(dto.funnelTemplateId);
    }

    if ('sourceFunnelId' in dto) {
      data.sourceFunnelId = this.nullableText(dto.sourceFunnelId);
    }

    if ('sourceFunnelInstanceId' in dto) {
      data.sourceFunnelInstanceId = this.nullableText(
        dto.sourceFunnelInstanceId,
      );
    }

    if ('libraryAssetVersionId' in dto) {
      data.libraryAssetVersionId = this.nullableText(
        dto.libraryAssetVersionId,
      );
    }

    if (options.requireAllFields && !difficulty) {
      data.difficulty = 'basic';
    }

    if (options.requireAllFields && level === undefined) {
      data.level = difficulty ?? 'basic';
    }

    if (options.requireAllFields && !status) {
      data.status = FunnelArsenalTemplateStatus.draft;
    }

    if (options.requireAllFields && language === undefined) {
      data.language = 'es';
    }

    if (options.requireAllFields && !version) {
      data.version = '1.0.0';
    }

    return data;
  }

  private optionalText(value: string | null | undefined) {
    if (value === undefined || value === null) {
      return undefined;
    }

    const trimmed = value.trim();

    return trimmed ? trimmed : undefined;
  }

  private nullableText(value: string | null | undefined) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();

    return trimmed ? trimmed : null;
  }

  private normalizeOptionalPositiveInteger(
    value: number | string | null | undefined,
  ) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === '') {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);

    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException({
        code: 'INVALID_FUNNEL_ARSENAL_STEPS_COUNT',
        field: 'stepsCount',
        message: 'stepsCount must be a positive integer.',
      });
    }

    return parsed;
  }

  private normalizeOptionalNonNegativeInteger(
    value: number | string | null | undefined,
  ) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === '') {
      return null;
    }

    const parsed = typeof value === 'number' ? value : Number(value);

    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new BadRequestException({
        code: 'INVALID_FUNNEL_MARKETPLACE_COUNT',
        message: 'Marketplace counters must be non-negative integers.',
      });
    }

    return parsed;
  }

  private normalizeOptionalDate(value: string | Date | null | undefined) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value === '') {
      return null;
    }

    const parsed = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_FUNNEL_MARKETPLACE_DATE',
        message: 'Marketplace date fields must be valid dates.',
      });
    }

    return parsed;
  }

  private normalizeStringList(value: string[] | string | null | undefined) {
    if (value === undefined || value === null) {
      return [];
    }

    const rawItems = Array.isArray(value) ? value : value.split(',');

    return [
      ...new Set(
        rawItems.map((item) => item.trim()).filter((item) => item.length > 0),
      ),
    ];
  }

  private normalizeDifficulty(value: string | null | undefined) {
    const normalized = this.optionalText(value);

    if (!normalized) {
      return undefined;
    }

    if (!['basic', 'intermediate', 'advanced'].includes(normalized)) {
      throw new BadRequestException({
        code: 'INVALID_FUNNEL_ARSENAL_DIFFICULTY',
        field: 'difficulty',
        message: 'difficulty must be basic, intermediate or advanced.',
      });
    }

    return normalized;
  }

  private normalizeStatus(value: string | null | undefined) {
    const normalized = this.optionalText(value);

    if (!normalized) {
      return undefined;
    }

    if (!['draft', 'active', 'archived'].includes(normalized)) {
      throw new BadRequestException({
        code: 'INVALID_FUNNEL_ARSENAL_STATUS',
        field: 'status',
        message: 'status must be draft, active or archived.',
      });
    }

    return normalized as FunnelArsenalTemplateStatus;
  }

  private mapStaticTemplate(
    template: FunnelArsenalTemplate,
  ): ArsenalTemplateDefinition {
    return {
      ...template,
      assetSlug: slugifySegment(template.templateKey),
      vertical: this.resolveVertical(template.blueprintKey),
      status: 'active',
      industry: null,
      subindustry: null,
      businessModel: null,
      funnelType: null,
      funnelFormat: null,
      framework: null,
      objective: template.goal,
      stepsCount: null,
      language: 'es',
      country: null,
      market: null,
      level: template.difficulty,
      estimatedTimeMinutes: null,
      tags: [this.resolveVertical(template.blueprintKey), template.difficulty],
      coverUrl: null,
      thumbnailUrl: null,
      screenshots: [],
      videoPreviewUrl: null,
      headline: template.label,
      version: '1.0.0',
      authorName: 'LeadFlow',
      publishedAt: null,
      problemSolved: template.description,
      idealFor: template.recommendedFor,
      flowSummary: [
        { label: 'Landing', description: template.description },
        { label: 'Captura', description: template.cta },
      ],
      compatibleBlueprints: [template.blueprintKey],
      assets: {},
      media: {},
      history: [],
      cloneCount: 0,
      activeInstallations: 0,
      lastActivatedAt: null,
      favoriteCount: 0,
      funnelTemplateId: null,
      sourceFunnelId: null,
      sourceFunnelInstanceId: null,
      libraryAssetVersionId: null,
    };
  }

  private mapDbTemplate(
    record: DbFunnelArsenalTemplate,
    options?: {
      sourceFunnelInstanceLabel?: string | null;
      builderUrl?: string | null;
    },
  ): SystemFunnelArsenalTemplateView {
    return {
      id: record.id,
      hasMasterFunnel: Boolean(record.sourceFunnelInstanceId),
      templateKey: record.templateKey,
      assetSlug: record.assetSlug ?? record.templateKey,
      blueprintKey: record.blueprintKey,
      vertical: record.vertical,
      industry: record.industry,
      subindustry: record.subindustry,
      businessModel: record.businessModel,
      funnelType: record.funnelType,
      funnelFormat: record.funnelFormat,
      framework: record.framework,
      objective: record.objective,
      stepsCount: record.stepsCount,
      language: record.language,
      country: record.country,
      market: record.market,
      level: record.level,
      estimatedTimeMinutes: record.estimatedTimeMinutes,
      tags: record.tags,
      coverUrl: record.coverUrl,
      thumbnailUrl: record.thumbnailUrl,
      screenshots: record.screenshotsJson as JsonValue,
      videoPreviewUrl: record.videoPreviewUrl,
      label: record.label,
      description: record.description,
      headline: record.headline,
      goal: record.goal,
      recommendedFor: record.recommendedFor,
      cta: record.cta,
      pathSuggestion: record.pathSuggestion,
      difficulty: record.difficulty as FunnelArsenalTemplate['difficulty'],
      status: record.status,
      version: record.version,
      authorName: record.authorName,
      publishedAt: record.publishedAt,
      problemSolved: record.problemSolved,
      idealFor: record.idealFor,
      flowSummary: record.flowSummaryJson as JsonValue,
      compatibleBlueprints:
        Array.isArray(record.compatibleBlueprints) &&
        record.compatibleBlueprints.length > 0
          ? record.compatibleBlueprints
          : [record.blueprintKey],
      assets: (record.assetsJson ?? {}) as JsonValue,
      media: (record.mediaJson ?? {}) as JsonValue,
      history: (record.historyJson ?? []) as JsonValue,
      cloneCount: record.cloneCount ?? 0,
      activeInstallations: record.activeInstallations ?? 0,
      lastActivatedAt: record.lastActivatedAt,
      favoriteCount: record.favoriteCount ?? 0,
      blocksPresetKey: record.blocksPresetKey ?? undefined,
      funnelTemplateId: record.funnelTemplateId,
      sourceFunnelId: record.sourceFunnelId,
      sourceFunnelInstanceId: record.sourceFunnelInstanceId,
      libraryAssetVersionId: record.libraryAssetVersionId,
      sourceFunnelInstanceLabel:
        options?.sourceFunnelInstanceLabel ?? undefined,
      builderUrl: options?.builderUrl ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private async resolveExistingMasterFunnelResponse(
    record: DbFunnelArsenalTemplate,
    sourceFunnelInstanceId = record.sourceFunnelInstanceId,
    sourceFunnelId = record.sourceFunnelId,
  ): Promise<MarketplaceMasterFunnelResponse> {
    const source = await this.prisma.funnelInstance.findUnique({
      where: {
        id: sourceFunnelInstanceId!,
      },
      select: {
        id: true,
        workspaceId: true,
        teamId: true,
        funnelId: true,
      },
    });

    if (!source?.funnelId) {
      throw new NotFoundException({
        code: 'FUNNEL_MARKETPLACE_MASTER_NOT_FOUND',
        message: 'The Master Funnel for this marketplace asset was not found.',
      });
    }

    if (
      record.sourceFunnelInstanceId !== source.id ||
      record.sourceFunnelId !== source.funnelId ||
      sourceFunnelId !== source.funnelId
    ) {
      await this.prisma.funnelArsenalTemplate.update({
        where: { id: record.id },
        data: {
          sourceFunnelInstanceId: source.id,
          sourceFunnelId: source.funnelId,
        },
      });
    }

    return {
      sourceFunnelInstanceId: source.id,
      sourceFunnelId: source.funnelId,
      builderUrl: this.toBuilderUrl(source.teamId, source.funnelId),
      workspaceId: source.workspaceId,
      teamId: source.teamId,
    };
  }

  private async resolveSystemSourceFunnelInstanceInfo(
    sourceFunnelInstanceIds: Array<string | null>,
  ) {
    const ids = [
      ...new Set(
        sourceFunnelInstanceIds.filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0,
        ),
      ),
    ];

    if (ids.length === 0) {
      return new Map<string, SystemSourceFunnelInstanceInfo>();
    }

    const records = await this.prisma.funnelInstance.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        name: true,
        code: true,
        workspaceId: true,
        teamId: true,
        funnelId: true,
      },
    });

    return new Map<string, SystemSourceFunnelInstanceInfo>(
      records.map((record): [string, SystemSourceFunnelInstanceInfo] => [
        record.id,
        {
          label: `${record.name}${record.code ? ` (${record.code})` : ''}`,
          builderUrl: record.funnelId
            ? this.toBuilderUrl(record.teamId, record.funnelId)
            : null,
          funnelId: record.funnelId,
          teamId: record.teamId,
          workspaceId: record.workspaceId,
        },
      ]),
    );
  }

  private async assertSourceFunnelInstanceExists(
    sourceFunnelInstanceId: string | null | undefined,
  ) {
    const normalized = this.nullableText(sourceFunnelInstanceId);

    if (!normalized) {
      return;
    }

    const source = await this.prisma.funnelInstance.findUnique({
      where: {
        id: normalized,
      },
      select: {
        id: true,
      },
    });

    if (!source) {
      throw new BadRequestException({
        code: 'FUNNEL_ARSENAL_SOURCE_INSTANCE_NOT_FOUND',
        field: 'sourceFunnelInstanceId',
        message:
          'sourceFunnelInstanceId must point to an existing FunnelInstance.',
      });
    }
  }

  private async assertLibraryAssetVersionExists(
    libraryAssetVersionId: string | null | undefined,
  ) {
    const normalized = this.nullableText(libraryAssetVersionId);

    if (!normalized) {
      return;
    }

    const version = await this.prisma.libraryAssetVersion.findUnique({
      where: {
        id: normalized,
      },
      select: {
        id: true,
      },
    });

    if (!version) {
      throw new BadRequestException({
        code: 'LIBRARY_ASSET_VERSION_NOT_FOUND',
        field: 'libraryAssetVersionId',
        message:
          'libraryAssetVersionId must point to an existing LibraryAssetVersion.',
      });
    }
  }

  private async resolveLibraryVersionForTemplate(
    template: ArsenalTemplateDefinition,
    options: {
      requirePublished: boolean;
    },
  ): Promise<ArsenalTemplateDefinition> {
    if (!template.libraryAssetVersionId) {
      return template;
    }

    const version = await this.prisma.libraryAssetVersion.findUnique({
      where: {
        id: template.libraryAssetVersionId,
      },
      include: {
        asset: true,
        funnelVersion: true,
        media: {
          orderBy: [{ mediaType: 'asc' }, { sortOrder: 'asc' }],
        },
        compatibility: true,
      },
    });

    if (!version) {
      if (!options.requirePublished) {
        return template;
      }

      throw new BadRequestException({
        code: 'LIBRARY_ASSET_VERSION_NOT_FOUND',
        field: 'libraryAssetVersionId',
        message:
          'This marketplace asset points to a missing LibraryAssetVersion.',
      });
    }

    if (version.status !== LibraryAssetVersionStatus.published) {
      if (!options.requirePublished) {
        return template;
      }

      throw new BadRequestException({
        code: 'LIBRARY_ASSET_VERSION_NOT_PUBLISHED',
        field: 'libraryAssetVersionId',
        message:
          'Only published LibraryAssetVersion records can be previewed or activated.',
      });
    }

    const libraryDifficulty = version.funnelVersion?.difficulty;
    const difficulty = (
      libraryDifficulty &&
      ['basic', 'intermediate', 'advanced'].includes(libraryDifficulty)
        ? libraryDifficulty
        : template.difficulty
    ) as FunnelArsenalTemplate['difficulty'];

    return {
      ...template,
      version: version.version,
      publishedAt: version.publishedAt ?? template.publishedAt,
      sourceFunnelId:
        version.funnelVersion?.sourceFunnelId ?? template.sourceFunnelId,
      sourceFunnelInstanceId:
        version.funnelVersion?.sourceFunnelInstanceId ??
        template.sourceFunnelInstanceId,
      stepsCount: version.funnelVersion?.stepsCount ?? template.stepsCount,
      framework: version.funnelVersion?.framework ?? template.framework,
      difficulty,
      level: libraryDifficulty ?? template.level,
      estimatedTimeMinutes:
        version.funnelVersion?.estimatedMinutes ??
        template.estimatedTimeMinutes,
      flowSummary:
        (version.funnelVersion?.flowSummary as JsonValue | undefined) ??
        template.flowSummary,
      assets: {
        ...(typeof template.assets === 'object' &&
        template.assets !== null &&
        !Array.isArray(template.assets)
          ? (template.assets as Record<string, JsonValue>)
          : {}),
        libraryAssetId: version.assetId,
        libraryAssetSlug: version.asset.slug,
        libraryAssetTitle: version.asset.title,
      },
      media:
        version.media.length > 0
          ? (version.media.map((media) => ({
              type: media.mediaType,
              url: media.url,
              altText: media.altText,
              sortOrder: media.sortOrder,
            })) as JsonValue)
          : template.media,
    };
  }

  private async findTemplateRecordBySlug(assetSlug: string) {
    return this.prisma.funnelArsenalTemplate.findFirst({
      where: {
        OR: [
          { assetSlug },
          { templateKey: assetSlug },
          { templateKey: decodeURIComponent(assetSlug) },
        ],
      },
    });
  }

  private async recordTemplateActivation(templateKey: string) {
    try {
      await this.prisma.funnelArsenalTemplate.update({
        where: { templateKey },
        data: {
          cloneCount: { increment: 1 },
          activeInstallations: { increment: 1 },
          lastActivatedAt: new Date(),
        },
      });
    } catch {
      return undefined;
    }
  }

  private async buildPreviewRuntime(
    template: ArsenalTemplateDefinition,
    stepSlug?: string,
  ) {
    if (!template.sourceFunnelInstanceId) {
      throw new UnprocessableEntityException({
        code: 'MARKETPLACE_MASTER_REQUIRED',
        message: 'Este funnel aún no tiene un Master Funnel asociado.',
      });
    }

    const source = await this.prisma.funnelInstance.findUnique({
      where: {
        id: template.sourceFunnelInstanceId,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        template: true,
        steps: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    if (!source) {
      throw new NotFoundException({
        code: 'FUNNEL_MARKETPLACE_MASTER_NOT_FOUND',
        message: 'The Master Funnel for this marketplace asset was not found.',
      });
    }

    const pathPrefix = `/preview/funnels/${template.assetSlug}`;
    const steps = source.steps.map((step) => ({
      id: step.id,
      slug: step.slug,
      path: step.isEntryStep ? pathPrefix : `${pathPrefix}/${step.slug}`,
      stepType: step.stepType,
      position: step.position,
      isEntryStep: step.isEntryStep,
      isConversionStep: step.isConversionStep,
      blocksJson: step.blocksJson,
      mediaMap: step.mediaMap,
      settingsJson: step.settingsJson,
    }));
    const entryStep = steps.find((step) => step.isEntryStep) ?? steps[0];

    if (!entryStep) {
      throw new NotFoundException({
        code: 'FUNNEL_MARKETPLACE_MASTER_EMPTY',
        message: 'The Master Funnel does not have previewable steps.',
      });
    }

    const normalizedStepSlug = stepSlug ? slugifySegment(stepSlug) : '';
    const currentStep =
      normalizedStepSlug.length > 0
        ? (steps.find((step) => step.slug === normalizedStepSlug) ?? entryStep)
        : entryStep;
    const currentIndex = steps.findIndex((step) => step.id === currentStep.id);
    const nextStep = steps[currentIndex + 1]
      ? this.toAdjacentStep(steps[currentIndex + 1])
      : null;
    const previousStep = steps[currentIndex - 1]
      ? this.toAdjacentStep(steps[currentIndex - 1])
      : null;

    return {
      request: {
        host: 'marketplace-preview.local',
        path: currentStep.path,
        publicationPathPrefix: pathPrefix,
        relativeStepPath: currentStep.isEntryStep ? '/' : currentStep.slug,
      },
      domain: {
        id: 'marketplace-preview-domain',
        host: 'marketplace-preview.local',
        normalizedHost: 'marketplace-preview.local',
        domainType: 'system_subdomain',
        isPrimary: false,
        canonicalHost: null,
        redirectToPrimary: false,
      },
      team: {
        id: source.team.id,
        name: source.team.name,
        description: source.team.description,
      },
      entryContext: {
        entryMode: 'organic_asesor',
        trafficLayer: 'ORGANIC',
        forcedSponsorId: null,
        adWheelId: null,
        browserPixelsEnabled: false,
        attributionType: 'organic',
        attributionSlug: null,
        runtimePathPrefix: pathPrefix,
        referralQueryParam: null,
      },
      publication: {
        id: `marketplace-preview-${template.assetSlug}`,
        pathPrefix,
        isPrimary: false,
        trackingProfileId: null,
        handoffStrategyId: null,
        metaPixelId: null,
        tiktokPixelId: null,
        seoTitle: template.headline ?? template.label,
        seoDescription: template.description,
        ogImageUrl: template.coverUrl ?? template.thumbnailUrl ?? null,
        faviconUrl: null,
        nextStepPath: nextStep?.path ?? null,
        manifestVersion: 1,
        runtimeHealthStatus: 'healthy',
      },
      theme: null,
      funnel: {
        id: source.id,
        name: source.name,
        code: source.code,
        status: source.status,
        structuralType: source.structuralType,
        conversionContract: source.conversionContract,
        settingsJson: source.settingsJson,
        mediaMap: source.mediaMap,
        template: {
          id: source.template.id,
          code: source.template.code,
          name: source.template.name,
          version: source.template.version,
          funnelType: source.template.funnelType,
          blocksJson: source.template.blocksJson,
          mediaMap: source.template.mediaMap,
          settingsJson: source.template.settingsJson,
          allowedOverridesJson: source.template.allowedOverridesJson,
        },
      },
      trackingProfile: null,
      handoffStrategy: null,
      handoff: {
        mode: null,
        channel: null,
        buttonLabel: null,
        autoRedirect: false,
        autoRedirectDelayMs: null,
        messageTemplate: null,
        sponsor: null,
        whatsappPhone: null,
        whatsappMessage: null,
        whatsappUrl: null,
      },
      leadId: null,
      assignment: null,
      advisor: null,
      assignedSponsor: null,
      currentStep,
      nextStep,
      previousStep,
      steps,
    };
  }

  private toAdjacentStep(
    step:
      | {
          id: string;
          slug: string;
          path: string;
          stepType: string;
        }
      | undefined,
  ) {
    return step
      ? {
          id: step.id,
          slug: step.slug,
          path: step.path,
          stepType: step.stepType,
        }
      : null;
  }

  private resolveVertical(blueprintKey: string) {
    return getBusinessBlueprintByKey(blueprintKey)?.vertical ?? 'other';
  }

  private async getEnabledPublicationsByInstanceCode(
    teamId: string,
    templates: readonly ArsenalTemplateDefinition[],
  ) {
    const codes = templates.map((template) => this.toInstanceCode(template));
    if (codes.length === 0) {
      return new Map<string, EnabledPublication>();
    }

    const publications = await this.prisma.funnelPublication.findMany({
      where: {
        teamId,
        status: 'active',
        isActive: true,
        NOT: {
          pathPrefix: {
            startsWith: '/ref/',
          },
        },
        funnelInstance: {
          code: {
            in: codes,
          },
        },
      },
      select: {
        id: true,
        pathPrefix: true,
        funnelInstanceId: true,
        domain: {
          select: {
            host: true,
          },
        },
        funnelInstance: {
          select: {
            code: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return new Map(
      publications.map((publication) => [
        publication.funnelInstance.code,
        {
          id: publication.id,
          pathPrefix: publication.pathPrefix,
          funnelInstanceId: publication.funnelInstanceId,
          domain: publication.domain,
        },
      ]),
    );
  }

  private async findEnabledPublicationByInstanceCode(
    teamId: string,
    instanceCode: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<EnabledPublication | null> {
    return client.funnelPublication.findFirst({
      where: {
        teamId,
        status: 'active',
        isActive: true,
        NOT: {
          pathPrefix: {
            startsWith: '/ref/',
          },
        },
        funnelInstance: {
          code: instanceCode,
        },
      },
      select: {
        id: true,
        pathPrefix: true,
        funnelInstanceId: true,
        domain: {
          select: {
            host: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  private async createMinimalFunnelInstance(
    tx: Prisma.TransactionClient,
    input: {
      workspaceId: string;
      teamId: string;
      instanceCode: string;
      template: ArsenalTemplateDefinition;
      businessName?: string | null;
      seo: { title: string; description: string };
    },
  ) {
    const funnelTemplate = await this.findOrCreateTemplate(tx, input.template);

    const funnel = await tx.funnel.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.template.label,
        description: input.template.description,
        code: input.instanceCode,
        thumbnailUrl: null,
        config: toInputJson({
          source: 'funnel_arsenal',
          templateKey: input.template.templateKey,
          blueprintKey: input.template.blueprintKey,
          seo: input.seo,
        }),
        status: 'active',
        isTemplate: false,
        stages: ['captured', 'qualified', 'assigned'],
        entrySources: ['manual', 'form', 'landing_page', 'api'],
        defaultTeamId: input.teamId,
        defaultRotationPoolId: null,
      },
    });

    const funnelInstance = await tx.funnelInstance.create({
      data: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        templateId: funnelTemplate.id,
        funnelId: funnel.id,
        name: input.template.label,
        code: input.instanceCode,
        thumbnailUrl: null,
        status: 'active',
        structuralType: 'two_step_conversion',
        conversionContract: toInputJson({
          source: 'funnel_arsenal',
          templateKey: input.template.templateKey,
        }),
        rotationPoolId: null,
        trackingProfileId: null,
        handoffStrategyId: null,
        settingsJson: toInputJson(
          this.buildFunnelSettings(input.template, input.seo, 'single-column'),
        ),
        mediaMap: toInputJson({}),
      },
    });

    await tx.funnelStep.create({
      data: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        funnelInstanceId: funnelInstance.id,
        stepType: 'landing',
        slug: 'captura',
        position: 1,
        isEntryStep: true,
        isConversionStep: false,
        blocksJson: toInputJson(
          this.buildBlocks(input.template, input.businessName),
        ),
        mediaMap: toInputJson({}),
        settingsJson: toInputJson(
          this.buildStepSettings(input.template, input.seo, 'single_column'),
        ),
      },
    });

    await tx.funnelStep.create({
      data: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        funnelInstanceId: funnelInstance.id,
        stepType: 'thank_you',
        slug: 'gracias',
        position: 2,
        isEntryStep: false,
        isConversionStep: true,
        blocksJson: toInputJson([
          {
            type: 'thank_you',
            title: 'Solicitud recibida',
            description:
              'Gracias. Tu información quedó registrada y el equipo dará seguimiento.',
          },
        ]),
        mediaMap: toInputJson({}),
        settingsJson: toInputJson(
          this.buildStepSettings(input.template, input.seo, 'single_column'),
        ),
      },
    });

    return funnelInstance;
  }

  private async createMasterFunnelInstance(
    tx: Prisma.TransactionClient,
    input: {
      workspaceId: string;
      teamId: string;
      template: ArsenalTemplateDefinition;
      name: string;
      baseTemplateCode?: string;
    },
  ) {
    const funnelTemplate = await this.findMasterBaseTemplate(tx, {
      template: input.template,
      baseTemplateCode: input.baseTemplateCode,
    });
    const instanceCode = this.toMasterInstanceCode(input.template);
    const includePresentation = this.shouldCreatePresentationStep(
      input.template,
    );
    const seo = {
      title: input.name,
      description: input.template.description,
    };
    const masterMetadata = this.buildMasterMetadata(input.template, {
      baseTemplateCode: input.baseTemplateCode ?? null,
      pathSuggestion: input.template.pathSuggestion,
    });
    const funnelSettings = this.buildFunnelSettings(
      input.template,
      seo,
      'single-column',
    ) as Record<string, JsonValue>;
    const singleColumnStepSettings = this.buildStepSettings(
      input.template,
      seo,
      'single_column',
    ) as Record<string, JsonValue>;
    const presentationStepSettings = this.buildStepSettings(
      input.template,
      seo,
      'presentation',
    ) as Record<string, JsonValue>;

    const funnel = await tx.funnel.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.name,
        description: input.template.description,
        code: instanceCode,
        thumbnailUrl: input.template.thumbnailUrl ?? null,
        config: toInputJson({
          ...masterMetadata,
          seo,
        }),
        status: 'draft',
        isTemplate: false,
        stages: ['captured', 'qualified', 'assigned'],
        entrySources: ['manual', 'form', 'landing_page', 'api'],
        defaultTeamId: input.teamId,
        defaultRotationPoolId: null,
      },
    });

    const funnelInstance = await tx.funnelInstance.create({
      data: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        templateId: funnelTemplate.id,
        funnelId: funnel.id,
        name: input.name,
        code: instanceCode,
        thumbnailUrl:
          input.template.thumbnailUrl ?? input.template.coverUrl ?? null,
        status: 'draft',
        structuralType: includePresentation
          ? 'multi_step_conversion'
          : 'two_step_conversion',
        conversionContract: toInputJson({
          ...masterMetadata,
          entryStepSlug: 'captura',
          conversionStepSlug: 'confirmacion',
        }),
        rotationPoolId: null,
        trackingProfileId: null,
        handoffStrategyId: null,
        settingsJson: toInputJson({
          ...funnelSettings,
          ...masterMetadata,
          name: input.name,
        }),
        mediaMap: toInputJson({
          coverUrl: input.template.coverUrl ?? null,
          thumbnailUrl: input.template.thumbnailUrl ?? null,
          media: input.template.media,
          assets: input.template.assets,
        }),
      },
    });

    await tx.funnelStep.create({
      data: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        funnelInstanceId: funnelInstance.id,
        stepType: 'landing',
        slug: 'captura',
        position: 1,
        isEntryStep: true,
        isConversionStep: false,
        blocksJson: toInputJson(this.buildBlocks(input.template)),
        mediaMap: toInputJson({}),
        settingsJson: toInputJson({
          ...singleColumnStepSettings,
          ...masterMetadata,
          pathSuggestion: input.template.pathSuggestion,
        }),
      },
    });

    if (includePresentation) {
      await tx.funnelStep.create({
        data: {
          workspaceId: input.workspaceId,
          teamId: input.teamId,
          funnelInstanceId: funnelInstance.id,
          stepType: 'presentation',
          slug: 'presentacion',
          position: 2,
          isEntryStep: false,
          isConversionStep: false,
          blocksJson: toInputJson(this.buildPresentationBlocks(input.template)),
          mediaMap: toInputJson({}),
          settingsJson: toInputJson({
            ...presentationStepSettings,
            ...masterMetadata,
          }),
        },
      });
    }

    await tx.funnelStep.create({
      data: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        funnelInstanceId: funnelInstance.id,
        stepType: 'thank_you',
        slug: 'confirmacion',
        position: includePresentation ? 3 : 2,
        isEntryStep: false,
        isConversionStep: true,
        blocksJson: toInputJson([
          {
            type: 'thank_you',
            title: 'Solicitud recibida',
            description:
              'Gracias. Este Master Funnel queda listo para editar en el Builder antes de activarlo para clientes.',
            primaryCtaLabel: 'Volver',
            source: 'funnel_marketplace_master',
          },
        ]),
        mediaMap: toInputJson({}),
        settingsJson: toInputJson({
          ...singleColumnStepSettings,
          ...masterMetadata,
        }),
      },
    });

    return {
      id: funnelInstance.id,
      funnelId: funnel.id,
    };
  }

  private async findMasterBaseTemplate(
    tx: Prisma.TransactionClient,
    input: {
      template: ArsenalTemplateDefinition;
      baseTemplateCode?: string;
    },
  ) {
    if (input.baseTemplateCode) {
      const baseTemplate = await tx.funnelTemplate.findUnique({
        where: {
          code: input.baseTemplateCode,
        },
      });

      if (!baseTemplate) {
        throw new BadRequestException({
          code: 'FUNNEL_MARKETPLACE_BASE_TEMPLATE_NOT_FOUND',
          field: 'baseTemplateCode',
          message: 'baseTemplateCode must point to an existing FunnelTemplate.',
        });
      }

      return baseTemplate;
    }

    return this.findOrCreateTemplate(tx, input.template);
  }

  private buildMasterMetadata(
    template: ArsenalTemplateDefinition,
    options: {
      baseTemplateCode: string | null;
      pathSuggestion: string;
    },
  ): Record<string, JsonValue> {
    return {
      source: 'funnel_marketplace_master',
      isMasterFunnel: true,
      templateKey: template.templateKey,
      assetSlug: template.assetSlug,
      blueprintKey: template.blueprintKey,
      vertical: template.vertical,
      funnelType: template.funnelType ?? null,
      funnelFormat: template.funnelFormat ?? null,
      framework: template.framework ?? null,
      objective: template.objective ?? template.goal,
      goal: template.goal,
      cta: template.cta,
      pathSuggestion: options.pathSuggestion,
      baseTemplateCode: options.baseTemplateCode,
    };
  }

  private buildPresentationBlocks(
    template: ArsenalTemplateDefinition,
  ): JsonValue {
    return [
      {
        type: 'hero',
        eyebrow: template.framework ?? 'Presentación',
        title: template.headline ?? template.label,
        description: template.description,
        primaryCtaLabel: template.cta,
        primaryCtaHref: '#public-capture-form',
        source: 'funnel_marketplace_master',
      },
      {
        type: 'content',
        title: template.goal,
        description: template.recommendedFor,
      },
    ];
  }

  private shouldCreatePresentationStep(template: ArsenalTemplateDefinition) {
    const markers = [
      template.funnelType,
      template.funnelFormat,
      template.framework,
      template.objective,
      template.templateKey,
    ]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase())
      .join(' ');

    return [
      'presentation',
      'presentacion',
      'vsl',
      'video',
      'webinar',
      'demo',
      'opportunity',
      'oportunidad',
    ].some((marker) => markers.includes(marker));
  }

  private async findOrCreateTemplate(
    tx: Prisma.TransactionClient,
    template: ArsenalTemplateDefinition,
  ) {
    const code = `funnel-arsenal.${template.templateKey}.v1`;
    const existing = await tx.funnelTemplate.findUnique({
      where: {
        code,
      },
    });

    if (existing) {
      return existing;
    }

    const seo = this.buildSeo(template, null);

    return tx.funnelTemplate.create({
      data: {
        workspaceId: null,
        name: template.label,
        description: template.description,
        code,
        status: 'active',
        version: 1,
        funnelType: 'funnel_arsenal',
        blocksJson: toInputJson(this.buildBlocks(template)),
        mediaMap: toInputJson({}),
        settingsJson: toInputJson(
          this.buildFunnelSettings(template, seo, 'single-column'),
        ),
        allowedOverridesJson: toInputJson({}),
        defaultHandoffStrategyId: null,
      },
    });
  }

  private toTemplateView(
    template: ArsenalTemplateDefinition,
    publication?: EnabledPublication | null,
    options?: {
      source?: 'master_clone' | 'fallback';
    },
  ): ArsenalTemplateView {
    return {
      ...template,
      enabled: Boolean(publication),
      hasMasterFunnel: Boolean(template.sourceFunnelInstanceId),
      ...(options?.source
        ? {
            source: options.source,
            ...(options.source === 'fallback'
              ? {
                  warning:
                    'Este template aún no tiene funnel maestro asociado.',
                }
              : {}),
          }
        : {}),
      ...(publication
        ? {
            publicationId: publication.id,
            funnelInstanceId: publication.funnelInstanceId,
            pathPrefix: publication.pathPrefix,
            publicUrl: this.toPublicUrl(
              publication.domain.host,
              publication.pathPrefix,
            ),
          }
        : {}),
    };
  }

  private toPublicUrl(host: string, pathPrefix: string) {
    return `https://${host}${pathPrefix === '/' ? '/' : pathPrefix}`;
  }

  private toBuilderUrl(teamId: string, funnelId: string) {
    return `/admin/tenants/${encodeURIComponent(teamId)}/funnels/${encodeURIComponent(
      funnelId,
    )}/builder`;
  }

  private toInstanceCode(template: ArsenalTemplateDefinition) {
    return `arsenal-${template.templateKey}`;
  }

  private toMasterInstanceCode(template: ArsenalTemplateDefinition) {
    return `master-${slugifySegment(template.assetSlug ?? template.templateKey)}`;
  }

  private buildSeo(
    template: ArsenalTemplateDefinition,
    businessName: string | null,
  ) {
    const title = businessName
      ? `${template.label} | ${businessName}`
      : template.label;

    return {
      title,
      description: template.description,
    };
  }

  private buildFunnelSettings(
    template: ArsenalTemplateDefinition,
    seo: { title: string; description: string },
    structureId: string,
  ): JsonValue {
    return {
      source: 'funnel_arsenal',
      templateKey: template.templateKey,
      blueprintKey: template.blueprintKey,
      structureId,
      theme: 'default',
      seo,
    };
  }

  private buildStepSettings(
    template: ArsenalTemplateDefinition,
    seo: { title: string; description: string },
    layout: string,
  ): JsonValue {
    return {
      source: 'funnel_arsenal',
      templateKey: template.templateKey,
      layout,
      seo,
      presentation: {
        layout,
      },
    };
  }

  private buildBlocks(
    template: ArsenalTemplateDefinition,
    businessName?: string | null,
  ): JsonValue {
    const headline = businessName
      ? `${businessName}: ${template.label}`
      : template.label;

    return [
      {
        type: 'hero',
        eyebrow: 'LeadFlow',
        title: headline,
        description: template.goal,
        accent: template.recommendedFor,
        primaryCtaLabel: template.cta,
        primaryCtaHref: '#public-capture-form',
        action: 'scroll_to_capture',
        proofItems: [
          template.description,
          'Completa tus datos y recibe seguimiento personalizado.',
          'Preparado para tu tipo de negocio.',
        ],
      },
      {
        type: 'lead_capture_form',
        title: template.cta,
        description: 'Déjanos tus datos para continuar.',
        submitLabel: template.cta,
        successTitle: 'Solicitud recibida',
        successMessage: 'Gracias. Te contactaremos con el siguiente paso.',
        fields: [
          {
            name: 'fullName',
            label: 'Nombre completo',
            type: 'text',
            required: true,
          },
          {
            name: 'phone',
            label: 'WhatsApp',
            type: 'tel',
            required: true,
          },
          {
            name: 'email',
            label: 'Correo',
            type: 'email',
            required: false,
          },
        ],
      },
    ];
  }
}
