import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FunnelArsenalTemplateStatus, Prisma } from '@prisma/client';
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
import type { CreateSystemFunnelArsenalTemplateDto } from './dto/create-system-funnel-arsenal-template.dto';
import type { UpdateSystemFunnelArsenalTemplateDto } from './dto/update-system-funnel-arsenal-template.dto';
import { FunnelMasterClonerService } from './funnel-master-cloner.service';

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
  vertical: string;
  status: 'draft' | 'active' | 'archived';
  industry?: string | null;
  businessModel?: string | null;
  funnelType?: string | null;
  funnelFormat?: string | null;
  objective?: string | null;
  stepsCount?: number | null;
  language?: string | null;
  country?: string | null;
  market?: string | null;
  funnelTemplateId?: string | null;
  sourceFunnelId?: string | null;
  sourceFunnelInstanceId?: string | null;
};

type ArsenalTemplateView = ArsenalTemplateDefinition & {
  enabled: boolean;
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
  sourceFunnelInstanceLabel?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type DbFunnelArsenalTemplate = Prisma.FunnelArsenalTemplateGetPayload<object>;

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

    return this.toTemplateView(template, created, {
      source: template.sourceFunnelInstanceId ? 'master_clone' : 'fallback',
    });
  }

  async listSystemTemplates(): Promise<SystemFunnelArsenalTemplateView[]> {
    const records = await this.prisma.funnelArsenalTemplate.findMany({
      orderBy: [{ blueprintKey: 'asc' }, { label: 'asc' }],
    });
    const sourceLabels = await this.resolveSystemSourceFunnelInstanceLabels(
      records.map((record) => record.sourceFunnelInstanceId),
    );

    return records.map((record) =>
      this.mapDbTemplate(record, {
        sourceFunnelInstanceLabel:
          sourceLabels.get(record.sourceFunnelInstanceId ?? '') ?? null,
      }),
    );
  }

  async createSystemTemplate(dto: CreateSystemFunnelArsenalTemplateDto) {
    await this.assertSourceFunnelInstanceExists(dto.sourceFunnelInstanceId);
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
          country: null,
          market: null,
          label: template.label,
          description: template.description,
          goal: template.goal,
          recommendedFor: template.recommendedFor,
          cta: template.cta,
          pathSuggestion: template.pathSuggestion,
          difficulty: template.difficulty,
          status: FunnelArsenalTemplateStatus.active,
          blocksPresetKey: template.blocksPresetKey ?? null,
          funnelTemplateId: null,
          sourceFunnelId: null,
          sourceFunnelInstanceId: null,
        },
        update: {
          blueprintKey: template.blueprintKey,
          vertical:
            blueprint?.vertical ?? this.resolveVertical(template.blueprintKey),
          objective: template.goal,
          language: 'es',
          label: template.label,
          description: template.description,
          goal: template.goal,
          recommendedFor: template.recommendedFor,
          cta: template.cta,
          pathSuggestion: template.pathSuggestion,
          difficulty: template.difficulty,
          status: FunnelArsenalTemplateStatus.active,
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
      return dbTemplates.map((template) => this.mapDbTemplate(template));
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
      return this.mapDbTemplate(dbTemplate);
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
    const blueprintKey = required(dto.blueprintKey, 'blueprintKey');
    const vertical = required(dto.vertical, 'vertical');
    const industry = this.nullableText(dto.industry);
    const businessModel = this.nullableText(dto.businessModel);
    const funnelType = this.nullableText(dto.funnelType);
    const funnelFormat = this.nullableText(dto.funnelFormat);
    const objective = this.nullableText(dto.objective);
    const language = this.nullableText(dto.language);
    const country = this.nullableText(dto.country);
    const market = this.nullableText(dto.market);
    const stepsCount = this.normalizeOptionalPositiveInteger(dto.stepsCount);
    const label = required(dto.label, 'label');
    const description = required(dto.description, 'description');
    const goal = required(dto.goal, 'goal');
    const recommendedFor = required(dto.recommendedFor, 'recommendedFor');
    const cta = required(dto.cta, 'cta');
    const pathSuggestion = required(dto.pathSuggestion, 'pathSuggestion');

    if (templateKey) data.templateKey = templateKey;
    if (blueprintKey) data.blueprintKey = blueprintKey;
    if (vertical) data.vertical = vertical;
    if (industry !== undefined) data.industry = industry;
    if (businessModel !== undefined) data.businessModel = businessModel;
    if (funnelType !== undefined) data.funnelType = funnelType;
    if (funnelFormat !== undefined) data.funnelFormat = funnelFormat;
    if (objective !== undefined) data.objective = objective;
    if (stepsCount !== undefined) data.stepsCount = stepsCount;
    if (language !== undefined) data.language = language ?? 'es';
    if (country !== undefined) data.country = country;
    if (market !== undefined) data.market = market;
    if (label) data.label = label;
    if (description) data.description = description;
    if (goal) data.goal = goal;
    if (recommendedFor) data.recommendedFor = recommendedFor;
    if (cta) data.cta = cta;
    if (pathSuggestion) data.pathSuggestion = pathSuggestion;
    if (difficulty) data.difficulty = difficulty;
    if (status) data.status = status;

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

    if (options.requireAllFields && !difficulty) {
      data.difficulty = 'basic';
    }

    if (options.requireAllFields && !status) {
      data.status = FunnelArsenalTemplateStatus.draft;
    }

    if (options.requireAllFields && language === undefined) {
      data.language = 'es';
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
      vertical: this.resolveVertical(template.blueprintKey),
      status: 'active',
      industry: null,
      businessModel: null,
      funnelType: null,
      funnelFormat: null,
      objective: template.goal,
      stepsCount: null,
      language: 'es',
      country: null,
      market: null,
      funnelTemplateId: null,
      sourceFunnelId: null,
      sourceFunnelInstanceId: null,
    };
  }

  private mapDbTemplate(
    record: DbFunnelArsenalTemplate,
    options?: {
      sourceFunnelInstanceLabel?: string | null;
    },
  ): SystemFunnelArsenalTemplateView {
    return {
      id: record.id,
      templateKey: record.templateKey,
      blueprintKey: record.blueprintKey,
      vertical: record.vertical,
      industry: record.industry,
      businessModel: record.businessModel,
      funnelType: record.funnelType,
      funnelFormat: record.funnelFormat,
      objective: record.objective,
      stepsCount: record.stepsCount,
      language: record.language,
      country: record.country,
      market: record.market,
      label: record.label,
      description: record.description,
      goal: record.goal,
      recommendedFor: record.recommendedFor,
      cta: record.cta,
      pathSuggestion: record.pathSuggestion,
      difficulty: record.difficulty as FunnelArsenalTemplate['difficulty'],
      status: record.status,
      blocksPresetKey: record.blocksPresetKey ?? undefined,
      funnelTemplateId: record.funnelTemplateId,
      sourceFunnelId: record.sourceFunnelId,
      sourceFunnelInstanceId: record.sourceFunnelInstanceId,
      sourceFunnelInstanceLabel:
        options?.sourceFunnelInstanceLabel ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private async resolveSystemSourceFunnelInstanceLabels(
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
      return new Map<string, string>();
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
      },
    });

    return new Map(
      records.map((record) => [
        record.id,
        `${record.name}${record.code ? ` (${record.code})` : ''}`,
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

  private toInstanceCode(template: ArsenalTemplateDefinition) {
    return `arsenal-${template.templateKey}`;
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
