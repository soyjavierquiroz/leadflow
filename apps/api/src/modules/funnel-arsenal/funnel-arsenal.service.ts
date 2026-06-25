import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  getFunnelArsenalTemplateByKey,
  getFunnelArsenalTemplatesForBlueprint,
  type FunnelArsenalTemplate,
} from '@leadflow/account-model';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CommercialProfileService } from '../commercial-profile/commercial-profile.service';
import { normalizePublicationPathPrefix } from '../shared/publication-resolution.utils';
import type { JsonValue } from '../shared/domain.types';

const toInputJson = (value: JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const otherBlueprintKey = 'blueprint.other.v1';

type EnabledPublication = {
  id: string;
  pathPrefix: string;
  domain: {
    host: string;
  };
};

type ArsenalTemplateView = FunnelArsenalTemplate & {
  enabled: boolean;
  publicationId?: string;
  publicUrl?: string;
};

type FunnelArsenalResponse = {
  blueprintKey: string;
  templates: ArsenalTemplateView[];
};

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

    const blueprintKey = await this.resolveBlueprintKey(user.teamId!);
    const templates = getFunnelArsenalTemplatesForBlueprint(blueprintKey);
    const enabledByCode = await this.getEnabledPublicationsByInstanceCode(
      user.teamId!,
      templates,
    );

    return {
      blueprintKey,
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

    const blueprintKey = await this.resolveBlueprintKey(user.teamId!);
    const template = getFunnelArsenalTemplateByKey(templateKey);

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
    const profile =
      await this.commercialProfileService.getCommercialProfileForTeam(
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
      const funnelTemplate = await this.findOrCreateTemplate(tx, template);
      const seo = this.buildSeo(template, profile?.businessName ?? null);

      const funnel = await tx.funnel.create({
        data: {
          workspaceId: user.workspaceId!,
          name: template.label,
          description: template.description,
          code: instanceCode,
          thumbnailUrl: null,
          config: toInputJson({
            source: 'funnel_arsenal',
            templateKey: template.templateKey,
            blueprintKey: template.blueprintKey,
            seo,
          }),
          status: 'active',
          isTemplate: false,
          stages: ['captured', 'qualified', 'assigned'],
          entrySources: ['manual', 'form', 'landing_page', 'api'],
          defaultTeamId: user.teamId!,
          defaultRotationPoolId: null,
        },
      });

      const funnelInstance = await tx.funnelInstance.create({
        data: {
          workspaceId: user.workspaceId!,
          teamId: user.teamId!,
          templateId: funnelTemplate.id,
          funnelId: funnel.id,
          name: template.label,
          code: instanceCode,
          thumbnailUrl: null,
          status: 'active',
          structuralType: 'two_step_conversion',
          conversionContract: toInputJson({
            source: 'funnel_arsenal',
            templateKey: template.templateKey,
          }),
          rotationPoolId: null,
          trackingProfileId: null,
          handoffStrategyId: null,
          settingsJson: toInputJson(
            this.buildFunnelSettings(template, seo, 'single-column'),
          ),
          mediaMap: toInputJson({}),
        },
      });

      await tx.funnelStep.create({
        data: {
          workspaceId: user.workspaceId!,
          teamId: user.teamId!,
          funnelInstanceId: funnelInstance.id,
          stepType: 'landing',
          slug: 'captura',
          position: 1,
          isEntryStep: true,
          isConversionStep: false,
          blocksJson: toInputJson(
            this.buildBlocks(template, profile?.businessName),
          ),
          mediaMap: toInputJson({}),
          settingsJson: toInputJson(
            this.buildStepSettings(template, seo, 'single_column'),
          ),
        },
      });

      await tx.funnelStep.create({
        data: {
          workspaceId: user.workspaceId!,
          teamId: user.teamId!,
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
            this.buildStepSettings(template, seo, 'single_column'),
          ),
        },
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

  private async resolveBlueprintKey(teamId: string) {
    const profile =
      await this.commercialProfileService.getCommercialProfileForTeam(teamId);

    return profile?.blueprintKey ?? otherBlueprintKey;
  }

  private async getEnabledPublicationsByInstanceCode(
    teamId: string,
    templates: readonly FunnelArsenalTemplate[],
  ) {
    const codes = templates.map((template) => this.toInstanceCode(template));
    if (codes.length === 0) {
      return new Map<string, EnabledPublication>();
    }

    const publications = await this.prisma.funnelPublication.findMany({
      where: {
        teamId,
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

  private async findOrCreateTemplate(
    tx: Prisma.TransactionClient,
    template: FunnelArsenalTemplate,
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
    template: FunnelArsenalTemplate,
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

  private toInstanceCode(template: FunnelArsenalTemplate) {
    return `arsenal-${template.templateKey}`;
  }

  private buildSeo(
    template: FunnelArsenalTemplate,
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
    template: FunnelArsenalTemplate,
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
    template: FunnelArsenalTemplate,
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
    template: FunnelArsenalTemplate,
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
