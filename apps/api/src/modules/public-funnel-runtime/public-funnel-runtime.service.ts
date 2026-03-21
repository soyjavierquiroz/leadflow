import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  PublicRuntimePayload,
  PublicRuntimeStep,
} from './public-funnel-runtime.types';
import {
  buildPublicationStepPath,
  matchesPublicationPath,
  normalizeHost,
  normalizePath,
  resolveRelativeStepPath,
} from './public-funnel-runtime.utils';
import { resolvePublicHandoffConfig } from './reveal-handoff.utils';

const publicRuntimeInclude = {
  domain: true,
  trackingProfile: {
    include: {
      conversionEventMappings: true,
    },
  },
  handoffStrategy: true,
  funnelInstance: {
    include: {
      template: true,
      trackingProfile: {
        include: {
          conversionEventMappings: true,
        },
      },
      handoffStrategy: true,
      steps: {
        orderBy: {
          position: 'asc',
        },
      },
    },
  },
} satisfies Prisma.FunnelPublicationInclude;

type RuntimePublicationRecord = Prisma.FunnelPublicationGetPayload<{
  include: typeof publicRuntimeInclude;
}>;

@Injectable()
export class PublicFunnelRuntimeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveByHostAndPath(
    host: string,
    path: string,
  ): Promise<PublicRuntimePayload> {
    const normalizedHost = normalizeHost(host);
    const normalizedPath = normalizePath(path);

    const publications = await this.prisma.funnelPublication.findMany({
      where: {
        status: 'active',
        domain: {
          host: normalizedHost,
          status: 'active',
        },
        funnelInstance: {
          status: 'active',
        },
      },
      include: publicRuntimeInclude,
    });

    const matchingPublication = publications
      .filter((publication) =>
        matchesPublicationPath(normalizedPath, publication.pathPrefix),
      )
      .sort(
        (left, right) => right.pathPrefix.length - left.pathPrefix.length,
      )[0];

    if (!matchingPublication) {
      throw new NotFoundException({
        code: 'PUBLICATION_NOT_FOUND',
        message: `No active publication was found for ${normalizedHost}${normalizedPath}.`,
      });
    }

    return this.buildRuntimePayload(
      matchingPublication,
      normalizedHost,
      normalizedPath,
    );
  }

  async getPublicationRuntime(
    publicationId: string,
  ): Promise<PublicRuntimePayload> {
    const publication = await this.prisma.funnelPublication.findUnique({
      where: { id: publicationId },
      include: publicRuntimeInclude,
    });

    if (
      !publication ||
      publication.status !== 'active' ||
      publication.domain.status !== 'active'
    ) {
      throw new NotFoundException({
        code: 'PUBLICATION_NOT_FOUND',
        message: `Publication ${publicationId} is not active.`,
      });
    }

    return this.buildRuntimePayload(
      publication,
      publication.domain.host,
      publication.pathPrefix,
    );
  }

  async getStepRuntime(
    publicationId: string,
    stepSlug: string,
  ): Promise<PublicRuntimePayload> {
    const runtime = await this.getPublicationRuntime(publicationId);
    const requestedPath = buildPublicationStepPath(
      runtime.publication.pathPrefix,
      stepSlug,
      false,
    );

    return this.resolveByHostAndPath(runtime.domain.host, requestedPath);
  }

  private buildRuntimePayload(
    publication: RuntimePublicationRecord,
    requestedHost: string,
    requestedPath: string,
  ): PublicRuntimePayload {
    const relativeStepPath = resolveRelativeStepPath(
      requestedPath,
      publication.pathPrefix,
    );

    const steps = publication.funnelInstance.steps.map((step) => ({
      id: step.id,
      slug: step.slug,
      path: buildPublicationStepPath(
        publication.pathPrefix,
        step.slug,
        step.isEntryStep,
      ),
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
        code: 'STEP_NOT_FOUND',
        message: `Publication ${publication.id} does not have any steps.`,
      });
    }

    const normalizedRelativeSlug = relativeStepPath.replace(/^\/+|\/+$/g, '');
    const currentStep =
      relativeStepPath === '/'
        ? entryStep
        : steps.find((step) => step.slug === normalizedRelativeSlug);

    if (!currentStep) {
      throw new NotFoundException({
        code: 'STEP_NOT_FOUND',
        message: `No published step matched ${requestedHost}${requestedPath}.`,
      });
    }

    const currentIndex = steps.findIndex((step) => step.id === currentStep.id);
    const nextStep = this.toAdjacentStep(steps[currentIndex + 1]);
    const previousStep = this.toAdjacentStep(steps[currentIndex - 1]);

    const effectiveTrackingProfile =
      publication.trackingProfile ?? publication.funnelInstance.trackingProfile;
    const effectiveHandoffStrategy =
      publication.handoffStrategy ?? publication.funnelInstance.handoffStrategy;
    const handoff = resolvePublicHandoffConfig(effectiveHandoffStrategy);

    return {
      request: {
        host: requestedHost,
        path: requestedPath,
        publicationPathPrefix: publication.pathPrefix,
        relativeStepPath,
      },
      domain: {
        id: publication.domain.id,
        host: publication.domain.host,
        kind: publication.domain.kind,
        isPrimary: publication.domain.isPrimary,
      },
      publication: {
        id: publication.id,
        pathPrefix: publication.pathPrefix,
        isPrimary: publication.isPrimary,
        trackingProfileId: publication.trackingProfileId,
        handoffStrategyId: publication.handoffStrategyId,
      },
      funnel: {
        id: publication.funnelInstance.id,
        name: publication.funnelInstance.name,
        code: publication.funnelInstance.code,
        status: publication.funnelInstance.status,
        settingsJson: publication.funnelInstance.settingsJson,
        mediaMap: publication.funnelInstance.mediaMap,
        template: {
          id: publication.funnelInstance.template.id,
          code: publication.funnelInstance.template.code,
          name: publication.funnelInstance.template.name,
          version: publication.funnelInstance.template.version,
          funnelType: publication.funnelInstance.template.funnelType,
          blocksJson: publication.funnelInstance.template.blocksJson,
          mediaMap: publication.funnelInstance.template.mediaMap,
          settingsJson: publication.funnelInstance.template.settingsJson,
          allowedOverridesJson:
            publication.funnelInstance.template.allowedOverridesJson,
        },
      },
      trackingProfile: effectiveTrackingProfile
        ? {
            id: effectiveTrackingProfile.id,
            name: effectiveTrackingProfile.name,
            provider: effectiveTrackingProfile.provider,
            deduplicationMode: effectiveTrackingProfile.deduplicationMode,
            configJson: effectiveTrackingProfile.configJson,
            conversionEventMappings:
              effectiveTrackingProfile.conversionEventMappings.map(
                (mapping) => ({
                  id: mapping.id,
                  internalEventName: mapping.internalEventName,
                  providerEventName: mapping.providerEventName,
                  isBrowserSide: mapping.isBrowserSide,
                  isServerSide: mapping.isServerSide,
                  isCriticalConversion: mapping.isCriticalConversion,
                }),
              ),
          }
        : null,
      handoffStrategy: effectiveHandoffStrategy
        ? {
            id: effectiveHandoffStrategy.id,
            name: effectiveHandoffStrategy.name,
            type: effectiveHandoffStrategy.type,
            settingsJson: effectiveHandoffStrategy.settingsJson,
          }
        : null,
      handoff,
      currentStep,
      nextStep,
      previousStep,
      steps,
    };
  }

  private toAdjacentStep(
    step: PublicRuntimeStep | undefined,
  ): Pick<PublicRuntimeStep, 'id' | 'slug' | 'path' | 'stepType'> | null {
    if (!step) {
      return null;
    }

    return {
      id: step.id,
      slug: step.slug,
      path: step.path,
      stepType: step.stepType,
    };
  }
}
