import { BadRequestException, ConflictException } from '@nestjs/common';
import { ShortLinkKeywordConflictError } from '../public-funnel-runtime/short-link.provider';
import { SponsorVanityShortLinksService } from './sponsor-vanity-short-links.service';

const fixedDate = new Date('2026-06-02T12:00:00.000Z');

const buildSponsor = (
  input: {
    publicSlug?: string | null;
    vanityShortLink?: Record<string, unknown> | null;
  } = {},
) => ({
  id: 'sponsor-1',
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  displayName: 'Javier Quiroz',
  publicSlug: input.publicSlug ?? 'javier-quiroz',
  status: 'active',
  isActive: true,
  avatarUrl: null,
  email: 'javier@example.com',
  phone: null,
  availabilityStatus: 'available',
  routingWeight: 1,
  memberPortalEnabled: true,
  createdAt: fixedDate,
  updatedAt: fixedDate,
  vanityShortLink: input.vanityShortLink ?? null,
});

const buildVanity = (
  input: Partial<{
    slug: string;
    shortCode: string;
    shortUrl: string;
  }> = {},
) => ({
  id: 'vanity-1',
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  sponsorId: 'sponsor-1',
  slug: input.slug ?? 'javier-quiroz',
  targetUrl:
    'https://ingresos.retodetransformacion.com/ref/javier-quiroz',
  shortCode: input.shortCode ?? 'javier-quiroz',
  shortUrl: input.shortUrl ?? 'https://kuruk.in/javier-quiroz',
  provider: 'yourls',
  providerMetadata: null,
  createdAt: fixedDate,
  updatedAt: fixedDate,
});

const scope = {
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  sponsorId: 'sponsor-1',
};

const buildService = () => {
  const prisma = {
    sponsor: {
      findFirst: jest.fn(),
    },
    sponsorVanityShortLink: {
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };
  const shortLinkProvider = {
    shortenUrlWithKeyword: jest.fn(),
    deleteShortUrl: jest.fn(),
  };

  return {
    prisma,
    shortLinkProvider,
    service: new SponsorVanityShortLinksService(
      prisma as never,
      shortLinkProvider as never,
    ),
  };
};

describe('SponsorVanityShortLinksService', () => {
  it('generates a YOURLS vanity shortlink on demand', async () => {
    const { prisma, shortLinkProvider, service } = buildService();
    const created = buildVanity();

    prisma.sponsor.findFirst
      .mockResolvedValueOnce(buildSponsor())
      .mockResolvedValueOnce(null);
    prisma.sponsorVanityShortLink.findFirst.mockResolvedValue(null);
    shortLinkProvider.shortenUrlWithKeyword.mockResolvedValue({
      resolvedUrl: 'https://kuruk.in/javier-quiroz',
      shortUrl: 'https://kuruk.in/javier-quiroz',
      shortCode: 'javier-quiroz',
      provider: 'yourls',
      providerMetadata: {
        status: 'success',
        keyword: 'javier-quiroz',
      },
    });
    prisma.sponsorVanityShortLink.create.mockResolvedValue(created);

    const result = await service.generateSponsorVanityShortLink(scope);

    expect(shortLinkProvider.shortenUrlWithKeyword).toHaveBeenCalledWith(
      'https://ingresos.retodetransformacion.com/ref/javier-quiroz',
      'javier-quiroz',
    );
    expect(prisma.sponsorVanityShortLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sponsorId: 'sponsor-1',
        slug: 'javier-quiroz',
        shortCode: 'javier-quiroz',
        provider: 'yourls',
      }),
    });
    expect(result.shortLink?.shortUrl).toBe('https://kuruk.in/javier-quiroz');
  });

  it('returns the existing shortlink for the same sponsor and slug', async () => {
    const { prisma, shortLinkProvider, service } = buildService();
    const existing = buildVanity();

    prisma.sponsor.findFirst
      .mockResolvedValueOnce(buildSponsor({ vanityShortLink: existing }))
      .mockResolvedValueOnce(null);
    prisma.sponsorVanityShortLink.findFirst.mockResolvedValue(null);

    const result = await service.generateSponsorVanityShortLink(scope);

    expect(result.shortLink?.shortUrl).toBe(existing.shortUrl);
    expect(shortLinkProvider.shortenUrlWithKeyword).not.toHaveBeenCalled();
    expect(prisma.sponsorVanityShortLink.create).not.toHaveBeenCalled();
  });

  it('hard deletes local and YOURLS shortlink when the slug changes', async () => {
    const { prisma, shortLinkProvider, service } = buildService();
    const existing = buildVanity();

    prisma.sponsorVanityShortLink.findFirst.mockResolvedValue(existing);
    shortLinkProvider.deleteShortUrl.mockResolvedValue({
      ok: true,
      notFound: false,
    });
    prisma.sponsorVanityShortLink.delete.mockResolvedValue(existing);

    const result = await service.deleteSponsorVanityShortLinkIfSlugChanged({
      ...scope,
      previousSlug: 'javier-quiroz',
      nextSlug: 'javier-q',
    });

    expect(result).toEqual({ ok: true, deleted: true });
    expect(shortLinkProvider.deleteShortUrl).toHaveBeenCalledWith(
      'javier-quiroz',
    );
    expect(prisma.sponsorVanityShortLink.delete).toHaveBeenCalledWith({
      where: {
        id: 'vanity-1',
      },
    });
  });

  it('rejects duplicated sponsor public slugs before calling YOURLS', async () => {
    const { prisma, shortLinkProvider, service } = buildService();

    prisma.sponsor.findFirst
      .mockResolvedValueOnce(buildSponsor())
      .mockResolvedValueOnce({ id: 'sponsor-2' });

    await expect(service.generateSponsorVanityShortLink(scope)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(shortLinkProvider.shortenUrlWithKeyword).not.toHaveBeenCalled();
  });

  it('rejects reserved slugs before calling YOURLS', async () => {
    const { prisma, shortLinkProvider, service } = buildService();

    prisma.sponsor.findFirst.mockResolvedValueOnce(
      buildSponsor({ publicSlug: 'api' }),
    );

    await expect(service.generateSponsorVanityShortLink(scope)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(shortLinkProvider.shortenUrlWithKeyword).not.toHaveBeenCalled();
  });

  it('rejects local shortCode conflicts before calling YOURLS', async () => {
    const { prisma, shortLinkProvider, service } = buildService();

    prisma.sponsor.findFirst
      .mockResolvedValueOnce(buildSponsor())
      .mockResolvedValueOnce(null);
    prisma.sponsorVanityShortLink.findFirst.mockResolvedValue({
      id: 'vanity-2',
    });

    await expect(service.generateSponsorVanityShortLink(scope)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(shortLinkProvider.shortenUrlWithKeyword).not.toHaveBeenCalled();
  });

  it('maps YOURLS keyword conflicts to a controlled conflict', async () => {
    const { prisma, shortLinkProvider, service } = buildService();

    prisma.sponsor.findFirst
      .mockResolvedValueOnce(buildSponsor())
      .mockResolvedValueOnce(null);
    prisma.sponsorVanityShortLink.findFirst.mockResolvedValue(null);
    shortLinkProvider.shortenUrlWithKeyword.mockRejectedValue(
      new ShortLinkKeywordConflictError(),
    );

    await expect(service.generateSponsorVanityShortLink(scope)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.sponsorVanityShortLink.create).not.toHaveBeenCalled();
  });

  it('deletes idempotently when no local vanity shortlink exists', async () => {
    const { prisma, shortLinkProvider, service } = buildService();

    prisma.sponsorVanityShortLink.findFirst.mockResolvedValue(null);

    await expect(service.deleteSponsorVanityShortLink(scope)).resolves.toEqual({
      ok: true,
      deleted: false,
    });
    expect(shortLinkProvider.deleteShortUrl).not.toHaveBeenCalled();
    expect(prisma.sponsorVanityShortLink.delete).not.toHaveBeenCalled();
  });
});
