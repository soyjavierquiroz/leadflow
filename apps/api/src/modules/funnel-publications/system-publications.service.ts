import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePublicationPathPrefix } from '../shared/publication-resolution.utils';
import type { CreateSystemPublicationDto } from './dto/create-system-publication.dto';
import type { UpdateSystemPublicationDto } from './dto/update-system-publication.dto';

const systemPublicationInclude = {
  team: {
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
  domain: {
    select: {
      id: true,
      host: true,
      normalizedHost: true,
      status: true,
    },
  },
  funnelInstance: {
    include: {
      template: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  },
} satisfies Prisma.FunnelPublicationInclude;

type SystemPublicationRecord = Prisma.FunnelPublicationGetPayload<{
  include: typeof systemPublicationInclude;
}>;

const toIso = (value: Date) => value.toISOString();

@Injectable()
export class SystemPublicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const records = await this.prisma.funnelPublication.findMany({
      include: systemPublicationInclude,
      orderBy: [{ teamId: 'asc' }, { domainId: 'asc' }, { pathPrefix: 'asc' }],
    });

    return records.map((record) => this.toView(record));
  }

  async create(dto: CreateSystemPublicationDto) {
    const normalizedPath = this.normalizePath(dto.path);
    const isActive = dto.isActive ?? true;
    const scope = await this.resolveScope({
      domainId: dto.domainId,
      funnelId: dto.funnelId,
      isActive,
    });

    await this.assertPathConflict(scope.domain.id, normalizedPath);

    const record = await this.prisma.$transaction(async (tx) => {
      if (normalizedPath === '/') {
        await tx.funnelPublication.updateMany({
          where: {
            domainId: scope.domain.id,
            isPrimary: true,
          },
          data: {
            isPrimary: false,
          },
        });
      }

      return tx.funnelPublication.create({
        data: {
          workspaceId: scope.domain.workspaceId,
          teamId: scope.domain.teamId,
          domainId: scope.domain.id,
          funnelInstanceId: scope.funnel.id,
          pathPrefix: normalizedPath,
          status: isActive ? 'active' : 'draft',
          isActive,
          isPrimary: normalizedPath === '/',
        },
        include: systemPublicationInclude,
      });
    });

    return this.toView(record);
  }

  async update(publicationId: string, dto: UpdateSystemPublicationDto) {
    const normalizedId = this.requireId(publicationId, 'id');
    const existing = await this.prisma.funnelPublication.findUnique({
      where: { id: normalizedId },
      include: systemPublicationInclude,
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'PUBLICATION_NOT_FOUND',
        message: 'The requested publication was not found.',
      });
    }

    const normalizedPath =
      dto.path !== undefined
        ? this.normalizePath(dto.path)
        : existing.pathPrefix;
    const nextDomainId = dto.domainId ?? existing.domainId;
    const nextFunnelId = dto.funnelId ?? existing.funnelInstanceId;
    const isActive = dto.isActive ?? existing.isActive;
    const scope = await this.resolveScope({
      domainId: nextDomainId,
      funnelId: nextFunnelId,
      isActive,
    });

    if (
      scope.domain.teamId !== existing.teamId ||
      scope.funnel.teamId !== existing.teamId ||
      scope.domain.workspaceId !== existing.workspaceId ||
      scope.funnel.workspaceId !== existing.workspaceId
    ) {
      throw new BadRequestException({
        code: 'PUBLICATION_TEAM_TRANSFER_NOT_SUPPORTED',
        message:
          'Changing the publication team or workspace is not supported. Delete and recreate the binding instead.',
      });
    }

    await this.assertPathConflict(scope.domain.id, normalizedPath, existing.id);

    const record = await this.prisma.$transaction(async (tx) => {
      const shouldBePrimary = normalizedPath === '/';

      if (shouldBePrimary) {
        await tx.funnelPublication.updateMany({
          where: {
            domainId: scope.domain.id,
            isPrimary: true,
            NOT: { id: existing.id },
          },
          data: {
            isPrimary: false,
          },
        });
      }

      return tx.funnelPublication.update({
        where: { id: existing.id },
        data: {
          domainId: scope.domain.id,
          funnelInstanceId: scope.funnel.id,
          pathPrefix: normalizedPath,
          status: isActive ? 'active' : 'draft',
          isActive,
          isPrimary: shouldBePrimary,
        },
        include: systemPublicationInclude,
      });
    });

    return this.toView(record);
  }

  async remove(publicationId: string) {
    const normalizedId = this.requireId(publicationId, 'id');
    const existing = await this.prisma.funnelPublication.findUnique({
      where: { id: normalizedId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'PUBLICATION_NOT_FOUND',
        message: 'The requested publication was not found.',
      });
    }

    await this.prisma.funnelPublication.delete({
      where: { id: normalizedId },
    });

    return {
      id: normalizedId,
      deleted: true as const,
    };
  }

  private async resolveScope(input: {
    domainId: string;
    funnelId: string;
    isActive: boolean;
  }) {
    const domainId = this.requireId(input.domainId, 'domainId');
    const funnelId = this.requireId(input.funnelId, 'funnelId');
    const [domain, funnel] = await Promise.all([
      this.prisma.domain.findUnique({
        where: { id: domainId },
        select: {
          id: true,
          workspaceId: true,
          teamId: true,
          host: true,
          status: true,
        },
      }),
      this.prisma.funnelInstance.findUnique({
        where: { id: funnelId },
        select: {
          id: true,
          workspaceId: true,
          teamId: true,
          name: true,
          status: true,
        },
      }),
    ]);

    if (!domain) {
      throw new NotFoundException({
        code: 'DOMAIN_NOT_FOUND',
        message: 'The selected domain was not found.',
      });
    }

    if (!funnel) {
      throw new NotFoundException({
        code: 'FUNNEL_NOT_FOUND',
        message: 'The selected funnel was not found.',
      });
    }

    if (
      domain.workspaceId !== funnel.workspaceId ||
      domain.teamId !== funnel.teamId
    ) {
      throw new BadRequestException({
        code: 'PUBLICATION_SCOPE_MISMATCH',
        message:
          'The selected domain and funnel must belong to the same tenant.',
      });
    }

    if (input.isActive) {
      if (domain.status !== 'active') {
        throw new ConflictException({
          code: 'DOMAIN_MUST_BE_ACTIVE',
          message: 'The binding can only be activated on an active domain.',
        });
      }

      if (funnel.status !== 'active') {
        throw new ConflictException({
          code: 'FUNNEL_MUST_BE_ACTIVE',
          message: 'The binding can only be activated on an active funnel.',
        });
      }
    }

    return {
      domain,
      funnel,
    };
  }

  private async assertPathConflict(
    domainId: string,
    pathPrefix: string,
    excludePublicationId?: string,
  ) {
    const conflict = await this.prisma.funnelPublication.findFirst({
      where: {
        domainId,
        pathPrefix,
        ...(excludePublicationId
          ? {
              NOT: { id: excludePublicationId },
            }
          : {}),
      },
      include: {
        domain: {
          select: { host: true },
        },
      },
    });

    if (conflict) {
      throw new ConflictException({
        code: 'PUBLICATION_PATH_CONFLICT',
        message: `The path ${pathPrefix} is already in use on host ${conflict.domain.host}.`,
      });
    }
  }

  private normalizePath(value?: string | null) {
    if (value === undefined || value === null) {
      return '/';
    }

    const trimmed = value.trim();

    return normalizePublicationPathPrefix(trimmed || '/');
  }

  private requireId(value: string, field: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException({
        code: 'FIELD_REQUIRED',
        message: `${field} is required.`,
        field,
      });
    }

    return normalized;
  }

  private toView(record: SystemPublicationRecord) {
    const workspace = record.team.workspace;
    const isRoutable =
      record.status === 'active' &&
      record.isActive &&
      record.domain.status === 'active' &&
      record.funnelInstance.status === 'active';

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      teamId: record.teamId,
      domainId: record.domainId,
      funnelId: record.funnelInstanceId,
      funnelInstanceId: record.funnelInstanceId,
      path: record.pathPrefix,
      pathPrefix: record.pathPrefix,
      status: record.status,
      isActive: record.isActive,
      isPrimary: record.isPrimary,
      isRoutable,
      createdAt: toIso(record.createdAt),
      updatedAt: toIso(record.updatedAt),
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      },
      team: {
        id: record.team.id,
        name: record.team.name,
        code: record.team.code,
        status: record.team.status,
        isActive: record.team.isActive,
      },
      domain: {
        id: record.domain.id,
        host: record.domain.host,
        normalizedHost: record.domain.normalizedHost,
        status: record.domain.status,
      },
      funnel: {
        id: record.funnelInstance.id,
        legacyFunnelId: record.funnelInstance.legacyFunnelId,
        name: record.funnelInstance.name,
        code: record.funnelInstance.code,
        status: record.funnelInstance.status,
        template: {
          id: record.funnelInstance.template.id,
          name: record.funnelInstance.template.name,
          code: record.funnelInstance.template.code,
        },
      },
    };
  }
}
