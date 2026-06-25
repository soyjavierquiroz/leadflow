import {
  BadRequestException,
  ConflictException,
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
import { normalizePublicationPathPrefix } from '../shared/publication-resolution.utils';
import type { JsonValue } from '../shared/domain.types';
import type { CreateSystemFunnelArsenalTemplateDto } from './dto/create-system-funnel-arsenal-template.dto';
import type { UpdateSystemFunnelArsenalTemplateDto } from './dto/update-system-funnel-arsenal-template.dto';

const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

type EnabledPublication = {
  id: string;
  pathPrefix: string;
  domain: {
    host: string;
  };
};

type ArsenalTemplateDefinition = FunnelArsenalTemplate & {
  vertical: string;
  status: 'draft' | 'active' | 'archived';
  funnelTemplateId?: string | null;
  sourceFunnelId?: string | null;
  sourceFunnelInstanceId?: string | null;
};

type ArsenalTemplateView = ArsenalTemplateDefinition & {
  enabled: boolean;
  publicationId?: string;
  publicUrl?: string;
};

type FunnelArsenalResponse = {
  blueprintKey: string | null;
  requiresCommercialProfile: boolean;
  templates: ArsenalTemplateView[];
};

type SystemFunnelArsenalTemplateView = ArsenalTemplateDefinition & {
  id?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type DbFunnelArsenalTemplate = Prisma.FunnelArsenalTemplateGetPayload<object>;

@Injectable()
export class FunnelArsenalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commercialProfileService: CommercialProfileService,
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
      return this.toTemplateView(template, existing);
    }

    const domain = await this.resolveActiveDomain(
      user.workspaceId!,
      user.teamId!,
    );
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

      const pathPrefix = await this.resolveAvailablePathPrefix(
        tx,
        domain.id,
        template.pathSuggestion,
      );
      const seo = this.buildSeo(template, profile?.businessName ?? null);
      const funnelInstance = template.sourceFunnelInstanceId
        ? await this.cloneSourceFunnelInstance(tx, {
            sourceFunnelInstanceId: template.sourceFunnelInstanceId,
            workspaceId: user.workspaceId!,
            teamId: user.teamId!,
            instanceCode,
            template,
            seo,
          })
        : await this.createMinimalFunnelInstance(tx, {
            workspaceId: user.workspaceId!,
            teamId: user.teamId!,
            instanceCode,
            template,
            businessName: profile?.businessName,
            seo,
          });

      return tx.funnelPublication.create({
        data: {
          workspaceId: user.workspaceId!,
          teamId: user.teamId!,
          domainId: domain.id,
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
          pathPrefix,
          status: 'active',
          isActive: true,
          isPrimary: false,
        },
        select: {
          id: true,
          pathPrefix: true,
          domain: {
            select: {
              host: true,
            },
          },
        },
      });
    });

    return this.toTemplateView(template, created);
  }

  async listSystemTemplates(): Promise<SystemFunnelArsenalTemplateView[]> {
    const records = await this.prisma.funnelArsenalTemplate.findMany({
      orderBy: [{ blueprintKey: 'asc' }, { label: 'asc' }],
    });

    return records.map((record) => this.mapDbTemplate(record));
  }

  async createSystemTemplate(dto: CreateSystemFunnelArsenalTemplateDto) {
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
          vertical: blueprint?.vertical ?? this.resolveVertical(template.blueprintKey),
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
          vertical: blueprint?.vertical ?? this.resolveVertical(template.blueprintKey),
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
    const label = required(dto.label, 'label');
    const description = required(dto.description, 'description');
    const goal = required(dto.goal, 'goal');
    const recommendedFor = required(dto.recommendedFor, 'recommendedFor');
    const cta = required(dto.cta, 'cta');
    const pathSuggestion = required(dto.pathSuggestion, 'pathSuggestion');

    if (templateKey) data.templateKey = templateKey;
    if (blueprintKey) data.blueprintKey = blueprintKey;
    if (vertical) data.vertical = vertical;
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
      funnelTemplateId: null,
      sourceFunnelId: null,
      sourceFunnelInstanceId: null,
    };
  }

  private mapDbTemplate(
    record: DbFunnelArsenalTemplate,
  ): SystemFunnelArsenalTemplateView {
    return {
      id: record.id,
      templateKey: record.templateKey,
      blueprintKey: record.blueprintKey,
      vertical: record.vertical,
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
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
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

  private async resolveActiveDomain(workspaceId: string, teamId: string) {
    const domain = await this.prisma.domain.findFirst({
      where: {
        workspaceId,
        teamId,
        status: 'active',
      },
      select: {
        id: true,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    if (!domain) {
      throw new ConflictException({
        code: 'FUNNEL_ARSENAL_ACTIVE_DOMAIN_REQUIRED',
        message:
          'An active domain is required before enabling a funnel from the arsenal.',
      });
    }

    return domain;
  }

  private async resolveAvailablePathPrefix(
    tx: Prisma.TransactionClient,
    domainId: string,
    pathSuggestion: string,
  ) {
    const basePath = normalizePublicationPathPrefix(pathSuggestion);
    const suffixBase = basePath === '/' ? '/info' : basePath;

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const pathPrefix =
        attempt === 0 ? basePath : `${suffixBase}-${attempt + 1}`;
      const conflict = await tx.funnelPublication.findFirst({
        where: {
          domainId,
          pathPrefix,
        },
        select: {
          id: true,
        },
      });

      if (!conflict) {
        return pathPrefix;
      }
    }

    throw new ConflictException({
      code: 'FUNNEL_ARSENAL_PATH_CONFLICT',
      message: 'We could not generate an available publication path.',
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

  private async cloneSourceFunnelInstance(
    tx: Prisma.TransactionClient,
    input: {
      sourceFunnelInstanceId: string;
      workspaceId: string;
      teamId: string;
      instanceCode: string;
      template: ArsenalTemplateDefinition;
      seo: { title: string; description: string };
    },
  ) {
    const source = await tx.funnelInstance.findUnique({
      where: {
        id: input.sourceFunnelInstanceId,
      },
      include: {
        funnel: true,
        steps: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    });

    if (!source) {
      throw new NotFoundException({
        code: 'FUNNEL_ARSENAL_SOURCE_INSTANCE_NOT_FOUND',
        message: 'The source funnel instance for this arsenal template was not found.',
      });
    }

    const funnel = await tx.funnel.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.template.label,
        description: input.template.description,
        code: input.instanceCode,
        thumbnailUrl: source.thumbnailUrl,
        config: toInputJson({
          ...((source.funnel?.config ?? {}) as Record<string, unknown>),
          source: 'funnel_arsenal',
          templateKey: input.template.templateKey,
          blueprintKey: input.template.blueprintKey,
          clonedFromFunnelId: source.funnelId,
          clonedFromFunnelInstanceId: source.id,
          seo: input.seo,
        }),
        status: 'active',
        isTemplate: false,
        stages: source.funnel?.stages ?? ['captured', 'qualified', 'assigned'],
        entrySources: source.funnel?.entrySources ?? [
          'manual',
          'form',
          'landing_page',
          'api',
        ],
        defaultTeamId: input.teamId,
        defaultRotationPoolId: null,
      },
    });

    const funnelInstance = await tx.funnelInstance.create({
      data: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        templateId: source.templateId,
        funnelId: funnel.id,
        name: input.template.label,
        code: input.instanceCode,
        thumbnailUrl: source.thumbnailUrl,
        status: 'active',
        structuralType: source.structuralType,
        conversionContract: toInputJson({
          ...((source.conversionContract ?? {}) as Record<string, unknown>),
          source: 'funnel_arsenal',
          templateKey: input.template.templateKey,
          clonedFromFunnelInstanceId: source.id,
        }),
        rotationPoolId: null,
        trackingProfileId: null,
        handoffStrategyId: null,
        settingsJson: toInputJson(source.settingsJson as JsonValue),
        mediaMap: toInputJson(source.mediaMap as JsonValue),
      },
    });

    for (const step of source.steps) {
      await tx.funnelStep.create({
        data: {
          workspaceId: input.workspaceId,
          teamId: input.teamId,
          funnelInstanceId: funnelInstance.id,
          stepType: step.stepType,
          slug: step.slug,
          position: step.position,
          isEntryStep: step.isEntryStep,
          isConversionStep: step.isConversionStep,
          blocksJson: toInputJson(step.blocksJson as JsonValue),
          mediaMap: toInputJson(step.mediaMap as JsonValue),
          settingsJson: toInputJson(step.settingsJson as JsonValue),
        },
      });
    }

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
  ): ArsenalTemplateView {
    return {
      ...template,
      enabled: Boolean(publication),
      ...(publication
        ? {
            publicationId: publication.id,
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
