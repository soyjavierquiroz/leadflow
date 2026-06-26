import { Injectable } from '@nestjs/common';
import { LibraryAssetVersionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LeadflowLibraryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSystemSnapshot() {
    const collections = await this.prisma.libraryCollection.findMany({
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      include: {
        assets: {
          orderBy: [{ title: 'asc' }],
          include: {
            tags: {
              include: {
                tag: true,
              },
              orderBy: {
                tag: {
                  label: 'asc',
                },
              },
            },
            versions: {
              orderBy: [{ createdAt: 'desc' }],
              include: {
                funnelVersion: true,
                media: {
                  orderBy: [{ mediaType: 'asc' }, { sortOrder: 'asc' }],
                },
                compatibility: {
                  orderBy: [{ createdAt: 'asc' }],
                },
                _count: {
                  select: {
                    legacyFunnelArsenalTemplates: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      collections: collections.map((collection) => ({
        id: collection.id,
        slug: collection.slug,
        title: collection.title,
        description: collection.description,
        assetType: collection.assetType,
        status: collection.status,
        sortOrder: collection.sortOrder,
        assets: collection.assets.map((asset) => {
          const publishedVersion =
            asset.versions.find(
              (version) => version.status === LibraryAssetVersionStatus.published,
            ) ?? null;

          return {
            id: asset.id,
            slug: asset.slug,
            title: asset.title,
            description: asset.description,
            assetType: asset.assetType,
            ownerType: asset.ownerType,
            visibility: asset.visibility,
            status: asset.status,
            createdBy: asset.createdBy,
            updatedBy: asset.updatedBy,
            tags: asset.tags.map((assetTag) => ({
              id: assetTag.tag.id,
              slug: assetTag.tag.slug,
              label: assetTag.tag.label,
            })),
            publishedVersionId: publishedVersion?.id ?? null,
            versions: asset.versions.map((version) => ({
              id: version.id,
              version: version.version,
              status: version.status,
              publishedAt: version.publishedAt,
              publishedBy: version.publishedBy,
              changeLog: version.changeLog,
              sourceReferenceId: version.sourceReferenceId,
              previewConfig: version.previewConfig,
              legacyFunnelArsenalTemplateCount:
                version._count.legacyFunnelArsenalTemplates,
              funnelVersion: version.funnelVersion
                ? {
                    id: version.funnelVersion.id,
                    sourceFunnelInstanceId:
                      version.funnelVersion.sourceFunnelInstanceId,
                    sourceFunnelId: version.funnelVersion.sourceFunnelId,
                    stepsCount: version.funnelVersion.stepsCount,
                    framework: version.funnelVersion.framework,
                    difficulty: version.funnelVersion.difficulty,
                    estimatedMinutes: version.funnelVersion.estimatedMinutes,
                    flowSummary: version.funnelVersion.flowSummary,
                  }
                : null,
              media: version.media.map((media) => ({
                id: media.id,
                mediaType: media.mediaType,
                url: media.url,
                altText: media.altText,
                sortOrder: media.sortOrder,
                metadataJson: media.metadataJson,
              })),
              compatibility: version.compatibility.map((compatibility) => ({
                id: compatibility.id,
                vertical: compatibility.vertical,
                industry: compatibility.industry,
                businessModel: compatibility.businessModel,
                blueprint: compatibility.blueprint,
                country: compatibility.country,
                language: compatibility.language,
                accountType: compatibility.accountType,
                market: compatibility.market,
              })),
            })),
          };
        }),
      })),
    };
  }
}
