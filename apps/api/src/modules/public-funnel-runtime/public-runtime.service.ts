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
        config: funnel.config,
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
}
