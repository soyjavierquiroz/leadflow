import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { SubmitRuntimeLeadDto } from './dto/submit-runtime-lead.dto';
import { LeadCaptureAssignmentService } from './lead-capture-assignment.service';
import { PublicFunnelRuntimeService } from './public-funnel-runtime.service';

type JsonRecord = Record<string, unknown>;

const DEFAULT_STRUCTURE_ID = 'split-media-focus';

const asRecord = (value: unknown): JsonRecord | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;

@Injectable()
export class PublicRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicFunnelRuntimeService: PublicFunnelRuntimeService,
    private readonly leadCaptureAssignmentService: LeadCaptureAssignmentService,
  ) {}

  async resolve(hostname: string, path?: string) {
    const runtime = await this.publicFunnelRuntimeService.resolveByHostAndPath(
      hostname,
      path ?? '/',
    );
    const publication = await this.prisma.funnelPublication.findUnique({
      where: {
        id: runtime.publication.id,
      },
      include: {
        domain: {
          select: {
            id: true,
            host: true,
            normalizedHost: true,
            linkedFunnel: {
              select: {
                id: true,
                name: true,
                description: true,
                config: true,
              },
            },
          },
        },
        funnelInstance: {
          select: {
            id: true,
            name: true,
            code: true,
            legacyFunnel: {
              select: {
                id: true,
                name: true,
                description: true,
                config: true,
              },
            },
          },
        },
      },
    });

    if (!publication) {
      throw new NotFoundException({
        code: 'PUBLIC_RUNTIME_NOT_FOUND',
        message: `No active funnel publication matched ${runtime.domain.normalizedHost}${runtime.request.path}.`,
      });
    }

    const funnel =
      publication.funnelInstance.legacyFunnel ?? publication.domain.linkedFunnel;

    if (!funnel) {
      throw new NotFoundException({
        code: 'PUBLIC_RUNTIME_FUNNEL_NOT_FOUND',
        message:
          'The publication was found, but no linked funnel configuration is available.',
      });
    }

    return {
      request: {
        hostname: runtime.domain.normalizedHost,
        path: runtime.request.path,
      },
      publication: {
        id: runtime.publication.id,
        path: runtime.publication.pathPrefix,
        isActive: true,
      },
      domain: {
        id: publication.domain.id,
        hostname: publication.domain.host,
        normalizedHostname: publication.domain.normalizedHost,
      },
      funnelInstance: {
        id: publication.funnelInstance.id,
        name: publication.funnelInstance.name,
        code: publication.funnelInstance.code,
      },
      funnel: {
        id: funnel.id,
        name: funnel.name,
        description: funnel.description,
        config: this.buildLegacyRuntimeConfig(runtime, funnel.config),
      },
    };
  }

  async submitLead(dto: SubmitRuntimeLeadDto) {
    if (!dto.hostname?.trim()) {
      throw new BadRequestException({
        code: 'HOSTNAME_REQUIRED',
        message: 'A hostname is required to submit a public runtime lead.',
      });
    }

    const runtime = await this.publicFunnelRuntimeService.resolveByHostAndPath(
      dto.hostname,
      dto.path ?? '/',
    );
    const fullName =
      dto.fullName?.trim() ||
      `${dto.firstName?.trim() ?? ''} ${dto.lastName?.trim() ?? ''}`.trim() ||
      dto.firstName?.trim() ||
      null;

    return this.leadCaptureAssignmentService.submitLeadCapture({
      submissionEventId: dto.submissionEventId ?? `runtime-submit-${randomUUID()}`,
      publicationId: runtime.publication.id,
      currentStepId: runtime.currentStep.id,
      anonymousId: dto.anonymousId?.trim() || `runtime-anon-${randomUUID()}`,
      sourceChannel: dto.sourceChannel ?? 'form',
      sourceUrl:
        dto.sourceUrl?.trim() ??
        `https://${runtime.domain.host}${runtime.request.path}`,
      utmSource: dto.utmSource ?? null,
      utmCampaign: dto.utmCampaign ?? null,
      utmMedium: dto.utmMedium ?? null,
      utmContent: dto.utmContent ?? null,
      utmTerm: dto.utmTerm ?? null,
      fbclid: dto.fbclid ?? null,
      gclid: dto.gclid ?? null,
      ttclid: dto.ttclid ?? null,
      fullName,
      email: dto.email?.trim() || null,
      phone: dto.phone?.trim() || null,
      companyName: dto.companyName?.trim() || null,
      fieldValues: dto.fieldValues ?? {},
      tags: dto.tags ?? ['runtime-public-submit'],
    });
  }

  private buildLegacyRuntimeConfig(runtime: Awaited<ReturnType<PublicFunnelRuntimeService['resolveByHostAndPath']>>, existingConfig: unknown) {
    const safeConfig = asRecord(existingConfig) ?? {};
    const safeHybridEditor = asRecord(safeConfig.hybridEditor) ?? {};
    const safeContent = asRecord(safeConfig.content) ?? {};
    const safeSeo = asRecord(safeConfig.seo) ?? {};
    const stepSettings = asRecord(runtime.currentStep.settingsJson) ?? {};
    const funnelSettings = asRecord(runtime.funnel.settingsJson) ?? {};
    const stepSeo = asRecord(stepSettings.seo) ?? {};
    const funnelSeo = asRecord(funnelSettings.seo) ?? {};
    const structureId = this.resolveStructureId(stepSettings, funnelSettings);
    const templateId = runtime.funnel.template.id;
    const templateCode = runtime.funnel.template.code;

    return {
      ...safeConfig,
      templateId,
      templateCode,
      structureId,
      blocksJson: runtime.currentStep.blocksJson,
      hybridEditor: {
        ...safeHybridEditor,
        mode: 'data-driven-assembly',
        templateId,
        templateCode,
        structureId,
        blocksJson: runtime.currentStep.blocksJson,
      },
      content: {
        ...safeContent,
        templateId,
        templateCode,
        structureId,
        blocksJson: runtime.currentStep.blocksJson,
      },
      seo: {
        ...safeSeo,
        title:
          (typeof stepSeo.title === 'string' && stepSeo.title.trim()) ||
          (typeof funnelSeo.title === 'string' && funnelSeo.title.trim()) ||
          runtime.funnel.name,
        metaDescription:
          (typeof stepSeo.metaDescription === 'string' &&
            stepSeo.metaDescription.trim()) ||
          (typeof funnelSeo.metaDescription === 'string' &&
            funnelSeo.metaDescription.trim()) ||
          null,
      },
    };
  }

  private resolveStructureId(...sources: JsonRecord[]) {
    for (const source of sources) {
      const directStructureId = source.structureId;
      if (
        typeof directStructureId === 'string' &&
        directStructureId.trim().length > 0
      ) {
        return directStructureId.trim();
      }

      const hybridEditor = asRecord(source.hybridEditor);
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
}
