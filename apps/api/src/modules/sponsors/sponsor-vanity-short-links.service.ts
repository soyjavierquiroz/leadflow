import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getApiRuntimeConfig } from '../../config/runtime';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ShortLinkKeywordConflictError,
  ShortLinkProvider,
  ShortLinkProviderRequestError,
  ShortLinkProviderUnavailableError,
} from '../public-funnel-runtime/short-link.provider';

const RESERVED_SHORTLINK_SLUGS = new Set([
  'api',
  'admin',
  'login',
  'v1',
  'r',
  'ref',
  'presentacion',
  'confirmacion',
  'whatsapp',
  'checkout',
  'dxn',
  'health',
  'assets',
  'static',
  'wp-admin',
  'wp-json',
]);

const STRICT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SYSTEM_PUBLIC_REF_BASE_URL = 'https://leadflow.kuruk.in';

type SponsorVanityScope = {
  workspaceId: string;
  teamId: string;
  sponsorId: string;
};

type SponsorVanityTargetUrlInput = SponsorVanityScope & {
  slug: string;
};

type SponsorVanityShortLinkView = {
  shortUrl: string;
  shortCode: string;
  provider: string;
  createdAt: string;
};

export type SponsorVanityShortLinkSnapshot = {
  slug: string | null;
  targetUrl: string | null;
  shortLink: SponsorVanityShortLinkView | null;
};

@Injectable()
export class SponsorVanityShortLinksService {
  private readonly logger = new Logger(SponsorVanityShortLinksService.name);
  private readonly runtimeConfig = getApiRuntimeConfig();

  constructor(
    private readonly prisma: PrismaService,
    private readonly shortLinkProvider: ShortLinkProvider,
  ) {}

  async getSponsorVanityShortLink(
    scope: SponsorVanityScope,
  ): Promise<SponsorVanityShortLinkSnapshot> {
    const sponsor = await this.requireSponsor(scope);
    const slug = sponsor.publicSlug ?? null;
    const targetUrl = slug
      ? await this.buildTargetUrl({
          ...scope,
          slug,
        })
      : null;
    const shortLink =
      sponsor.vanityShortLink &&
      sponsor.vanityShortLink.slug === slug &&
      sponsor.vanityShortLink.shortCode === slug &&
      sponsor.vanityShortLink.targetUrl === targetUrl
        ? this.mapShortLink(sponsor.vanityShortLink)
        : null;

    return {
      slug,
      targetUrl,
      shortLink,
    };
  }

  async generateSponsorVanityShortLink(
    scope: SponsorVanityScope,
  ): Promise<SponsorVanityShortLinkSnapshot> {
    const sponsor = await this.requireSponsor(scope);
    const slug = this.validateSponsorSlug(sponsor.publicSlug);
    const targetUrl = await this.buildTargetUrl({
      ...scope,
      slug,
    });

    await this.ensureSponsorSlugIsUnique(slug, sponsor.id);
    await this.ensureShortCodeIsAvailable(slug, sponsor.id);

    if (
      sponsor.vanityShortLink &&
      sponsor.vanityShortLink.slug === slug &&
      sponsor.vanityShortLink.shortCode === slug &&
      sponsor.vanityShortLink.targetUrl === targetUrl
    ) {
      return {
        slug,
        targetUrl,
        shortLink: this.mapShortLink(sponsor.vanityShortLink),
      };
    }

    if (sponsor.vanityShortLink) {
      await this.deleteSponsorVanityShortLink(scope);
    }

    let shortened: Awaited<
      ReturnType<ShortLinkProvider['shortenUrlWithKeyword']>
    >;

    try {
      shortened = await this.shortLinkProvider.shortenUrlWithKeyword(
        targetUrl,
        slug,
      );
    } catch (error) {
      this.handleShortLinkCreateError(error);
    }

    try {
      const record = await this.prisma.sponsorVanityShortLink.create({
        data: {
          workspaceId: sponsor.workspaceId,
          teamId: sponsor.teamId,
          sponsorId: sponsor.id,
          slug,
          targetUrl,
          shortCode: shortened.shortCode,
          shortUrl: shortened.shortUrl,
          provider: shortened.provider,
          providerMetadata: shortened.providerMetadata,
        },
      });

      return {
        slug,
        targetUrl,
        shortLink: this.mapShortLink(record),
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException({
          code: 'SPONSOR_VANITY_SHORT_CODE_TAKEN',
          message: 'This vanity shortlink keyword is already in use.',
        });
      }

      throw error;
    }
  }

  async deleteSponsorVanityShortLink(scope: SponsorVanityScope) {
    const existing = await this.prisma.sponsorVanityShortLink.findFirst({
      where: {
        sponsorId: scope.sponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
    });

    if (!existing) {
      return {
        ok: true,
        deleted: false,
      };
    }

    try {
      await this.shortLinkProvider.deleteShortUrl(existing.shortCode);
    } catch (error) {
      this.handleShortLinkDeleteError(error, existing.shortCode);
    }

    await this.prisma.sponsorVanityShortLink.delete({
      where: {
        id: existing.id,
      },
    });

    return {
      ok: true,
      deleted: true,
    };
  }

  async deleteSponsorVanityShortLinkIfSlugChanged(input: {
    workspaceId: string;
    teamId: string;
    sponsorId: string;
    previousSlug: string | null;
    nextSlug: string | null;
  }) {
    if (input.previousSlug === input.nextSlug) {
      return {
        ok: true,
        deleted: false,
      };
    }

    return this.deleteSponsorVanityShortLink({
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      sponsorId: input.sponsorId,
    });
  }

  async buildTargetUrl(input: SponsorVanityTargetUrlInput) {
    this.assertTenantScopedTargetInput(input);
    const publicBaseUrl = await this.resolvePublicRefBaseUrl(input);

    return this.appendReferralSlug(publicBaseUrl, input.slug);
  }

  private assertTenantScopedTargetInput(
    input: Partial<SponsorVanityTargetUrlInput>,
  ) {
    if (!input.workspaceId || !input.teamId || !input.sponsorId) {
      throw new BadRequestException({
        code: 'SPONSOR_REF_SCOPE_REQUIRED',
        message:
          'workspaceId, teamId, and sponsorId are required to build a sponsor referral URL.',
      });
    }
  }

  private async resolvePublicRefBaseUrl(scope: SponsorVanityScope) {
    const primaryTeamDomain = await this.prisma.domain.findFirst({
      where: {
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        status: 'active',
        isPrimary: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        host: true,
        normalizedHost: true,
      },
    });

    if (primaryTeamDomain) {
      return this.buildPublicOrigin(
        primaryTeamDomain.normalizedHost ?? primaryTeamDomain.host,
      );
    }

    const teamDomain = await this.prisma.domain.findFirst({
      where: {
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        status: 'active',
      },
      orderBy: [
        {
          isPrimary: 'desc',
        },
        {
          activatedAt: 'desc',
        },
        {
          createdAt: 'asc',
        },
      ],
      select: {
        host: true,
        normalizedHost: true,
      },
    });

    if (teamDomain) {
      return this.buildPublicOrigin(
        teamDomain.normalizedHost ?? teamDomain.host,
      );
    }

    return this.resolveSafeSystemRefBaseUrl(scope);
  }

  private async resolveSafeSystemRefBaseUrl(scope: SponsorVanityScope) {
    const configuredBaseUrl = this.runtimeConfig.publicRefBaseUrl;
    const configuredHost = this.getUrlHost(configuredBaseUrl);

    if (!configuredHost) {
      return SYSTEM_PUBLIC_REF_BASE_URL;
    }

    const tenantDomain = await this.prisma.domain.findFirst({
      where: {
        normalizedHost: configuredHost,
      },
      select: {
        workspaceId: true,
        teamId: true,
      },
    });

    if (
      tenantDomain &&
      (tenantDomain.workspaceId !== scope.workspaceId ||
        tenantDomain.teamId !== scope.teamId)
    ) {
      this.logger.warn(
        `Ignoring PUBLIC_REF_BASE_URL ${configuredHost} because it belongs to another tenant.`,
      );
      return SYSTEM_PUBLIC_REF_BASE_URL;
    }

    return configuredBaseUrl;
  }

  private buildPublicOrigin(host: string) {
    const normalizedHost = host.trim().replace(/\/+$/, '');
    const protocol =
      normalizedHost.startsWith('localhost') ||
      normalizedHost.startsWith('127.0.0.1')
        ? 'http'
        : 'https';

    return `${protocol}://${normalizedHost}`;
  }

  private appendReferralSlug(baseUrl: string, slug: string) {
    const url = new URL(baseUrl);
    const path = url.pathname.replace(/\/+$/, '');
    const prefix = path === '/' ? '' : path;
    const refPrefix = prefix.endsWith('/ref') ? prefix : `${prefix}/ref`;

    url.pathname = `${refPrefix}/${encodeURIComponent(slug)}`;
    return url.toString();
  }

  private getUrlHost(value: string) {
    try {
      return new URL(value).hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  private async requireSponsor(scope: SponsorVanityScope) {
    const sponsor = await this.prisma.sponsor.findFirst({
      where: {
        id: scope.sponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
      include: {
        vanityShortLink: true,
      },
    });

    if (!sponsor) {
      throw new NotFoundException({
        code: 'SPONSOR_NOT_FOUND',
        message: 'The requested sponsor was not found for this team.',
      });
    }

    return sponsor;
  }

  private validateSponsorSlug(value: string | null) {
    const slug = value?.trim() ?? '';

    if (!slug) {
      throw new BadRequestException({
        code: 'SPONSOR_PUBLIC_SLUG_REQUIRED',
        message: 'A public advisor slug is required before generating a link.',
      });
    }

    if (slug.length < 3 || slug.length > 40) {
      throw new BadRequestException({
        code: 'SPONSOR_PUBLIC_SLUG_INVALID_LENGTH',
        message: 'The public advisor slug must be 3 to 40 characters long.',
      });
    }

    if (!STRICT_SLUG_PATTERN.test(slug)) {
      throw new BadRequestException({
        code: 'SPONSOR_PUBLIC_SLUG_INVALID',
        message:
          'The public advisor slug can only include lowercase letters, numbers, and hyphens.',
      });
    }

    if (RESERVED_SHORTLINK_SLUGS.has(slug)) {
      throw new BadRequestException({
        code: 'SPONSOR_PUBLIC_SLUG_RESERVED',
        message: 'This public advisor slug is reserved.',
      });
    }

    return slug;
  }

  private async ensureSponsorSlugIsUnique(slug: string, sponsorId: string) {
    const existing = await this.prisma.sponsor.findFirst({
      where: {
        publicSlug: slug,
        NOT: {
          id: sponsorId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'SPONSOR_PUBLIC_SLUG_TAKEN',
        message: 'This public advisor slug is already in use.',
      });
    }
  }

  private async ensureShortCodeIsAvailable(
    shortCode: string,
    sponsorId: string,
  ) {
    const existing = await this.prisma.sponsorVanityShortLink.findFirst({
      where: {
        shortCode,
        NOT: {
          sponsorId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException({
        code: 'SPONSOR_VANITY_SHORT_CODE_TAKEN',
        message: 'This vanity shortlink keyword is already in use.',
      });
    }
  }

  private mapShortLink(record: {
    shortUrl: string;
    shortCode: string;
    provider: string;
    createdAt: Date;
  }): SponsorVanityShortLinkView {
    return {
      shortUrl: record.shortUrl,
      shortCode: record.shortCode,
      provider: record.provider,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private handleShortLinkCreateError(error: unknown): never {
    if (error instanceof ShortLinkKeywordConflictError) {
      throw new ConflictException({
        code: 'YOURLS_KEYWORD_TAKEN',
        message: 'This vanity shortlink keyword is already occupied in YOURLS.',
      });
    }

    if (
      error instanceof ShortLinkProviderUnavailableError ||
      error instanceof ShortLinkProviderRequestError
    ) {
      throw new ServiceUnavailableException({
        code: 'YOURLS_UNAVAILABLE',
        message: 'YOURLS is unavailable. The vanity shortlink was not created.',
      });
    }

    throw error;
  }

  private handleShortLinkDeleteError(error: unknown, shortCode: string) {
    if (error instanceof ShortLinkProviderRequestError) {
      if (error.statusCode === 404) {
        return;
      }

      this.logger.warn(
        `Could not delete vanity shortlink ${shortCode} in YOURLS: ${error.message}`,
      );
      throw new ServiceUnavailableException({
        code: 'YOURLS_DELETE_UNAVAILABLE',
        message: 'YOURLS is unavailable. The vanity shortlink was not deleted.',
      });
    }

    if (error instanceof ShortLinkProviderUnavailableError) {
      throw new ServiceUnavailableException({
        code: 'YOURLS_UNAVAILABLE',
        message: 'YOURLS is unavailable. The vanity shortlink was not deleted.',
      });
    }

    throw error;
  }

  private isUniqueConstraintError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
