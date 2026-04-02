import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  normalizeDomainHost,
  normalizePath,
} from '../shared/publication-resolution.utils';

@Injectable()
export class PublicRuntimeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(hostname: string, path?: string) {
    const normalizedHostname = normalizeDomainHost(hostname);
    const normalizedPath = normalizePath(path);

    if (!normalizedHostname) {
      throw new BadRequestException({
        code: 'HOSTNAME_REQUIRED',
        message: 'A hostname is required to resolve a public funnel runtime.',
      });
    }

    const publication = await this.prisma.funnelPublication.findFirst({
      where: {
        pathPrefix: normalizedPath,
        status: 'active',
        isActive: true,
        domain: {
          normalizedHost: normalizedHostname,
          status: 'active',
        },
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
        message: `No active funnel publication matched ${normalizedHostname}${normalizedPath}.`,
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
        hostname: normalizedHostname,
        path: normalizedPath,
      },
      publication: {
        id: publication.id,
        path: publication.pathPrefix,
        isActive: publication.isActive,
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
}
