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

type TeamScope = {
  workspaceId: string;
  teamId: string;
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
  seo: {
    title: string;
    metaDescription: string;
  };
};

@Injectable()
export class HybridFunnelPublicationsService {
  constructor(private readonly prisma: PrismaService) {}

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
      seo: this.extractSeo(
        step.settingsJson as JsonValue,
        publication.funnelInstance.name,
      ),
    };
  }

  async createForTeam(
    scope: TeamScope,
    dto: CreateTeamHybridFunnelPublicationDto,
  ): Promise<HybridPublicationDetail> {
    const normalized = this.normalizeEditorInput(dto);

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
              title: normalized.seoTitle,
              metaDescription: normalized.metaDescription,
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

      return {
        publication,
        funnelInstance,
        step,
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

    const currentStep =
      existing.funnelInstance.steps.find((item) => item.isEntryStep) ??
      existing.funnelInstance.steps[0];

    if (!currentStep) {
      throw new NotFoundException({
        code: 'HYBRID_PUBLICATION_STEP_NOT_FOUND',
        message: 'The selected funnel instance does not have a landing step.',
      });
    }

    const normalized = this.normalizeEditorInput({
      name: dto.name ?? existing.funnelInstance.name,
      domainId: dto.domainId ?? existing.domainId,
      pathPrefix: dto.pathPrefix ?? existing.pathPrefix,
      templateId: dto.templateId ?? existing.funnelInstance.templateId,
      seoTitle:
        dto.seoTitle ??
        this.extractSeo(
          currentStep.settingsJson as JsonValue,
          existing.funnelInstance.name,
        ).title,
      metaDescription:
        dto.metaDescription ??
        this.extractSeo(
          currentStep.settingsJson as JsonValue,
          existing.funnelInstance.name,
        ).metaDescription,
      blocksJson: (dto.blocksJson ?? currentStep.blocksJson) as JsonValue,
      mediaMap: (dto.mediaMap ?? currentStep.mediaMap) as JsonValue,
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

      const step = await tx.funnelStep.update({
        where: { id: currentStep.id },
        data: {
          blocksJson: toInputJson(normalized.blocksJson),
          mediaMap: toInputJson(normalized.mediaMap),
          settingsJson: toInputJson(
            this.buildStepSettings(template.code, normalized.blocksJson, {
              title: normalized.seoTitle,
              metaDescription: normalized.metaDescription,
            }),
          ),
        },
      });

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

      return {
        publication,
        funnelInstance,
        step,
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
      seo: {
        title: normalized.seoTitle,
        metaDescription: normalized.metaDescription,
      },
    };
  }

  private normalizeEditorInput(input: {
    name: string;
    domainId: string;
    pathPrefix: string;
    templateId: string;
    seoTitle?: string;
    metaDescription?: string;
    blocksJson: JsonValue;
    mediaMap: JsonValue;
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
      seoTitle: (input.seoTitle ?? name).trim() || name,
      metaDescription: (input.metaDescription ?? '').trim(),
      blocksJson,
      mediaMap,
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

  private buildInstanceSettings(
    templateSettings: JsonValue,
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
      hybridEditor: {
        mode: 'data-driven-assembly',
        blocksJson,
      },
      seo,
    };
  }

  private buildStepSettings(
    templateCode: string,
    blocksJson: JsonValue,
    seo: {
      title: string;
      metaDescription: string;
    },
  ): JsonValue {
    return {
      editorSource: 'team-publications-new-vsl',
      templateCode,
      hybridRenderer: 'jakawi-bridge',
      blocksJson,
      seo,
    };
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
}
