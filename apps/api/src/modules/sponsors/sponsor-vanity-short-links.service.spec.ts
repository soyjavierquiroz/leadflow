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
    targetUrl: string;
  }> = {},
) => ({
  id: 'vanity-1',
  workspaceId: 'workspace-1',
  teamId: 'team-1',
  sponsorId: 'sponsor-1',
  slug: input.slug ?? 'javier-quiroz',
  targetUrl: input.targetUrl ?? 'https://leadflow.kuruk.in/ref/javier-quiroz',
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

const buildService = (input: { publicRefBaseUrl?: string } = {}) => {
  const previousPublicRefBaseUrl = process.env.PUBLIC_REF_BASE_URL;

  if (input.publicRefBaseUrl) {
    process.env.PUBLIC_REF_BASE_URL = input.publicRefBaseUrl;
  } else {
    delete process.env.PUBLIC_REF_BASE_URL;
  }

  const prisma = {
    domain: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
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

  const service = new SponsorVanityShortLinksService(
    prisma as never,
    shortLinkProvider as never,
  );

  if (previousPublicRefBaseUrl === undefined) {
    delete process.env.PUBLIC_REF_BASE_URL;
  } else {
    process.env.PUBLIC_REF_BASE_URL = previousPublicRefBaseUrl;
  }

  return {
    prisma,
    shortLinkProvider,
    service,
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
      'https://leadflow.kuruk.in/ref/javier-quiroz',
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

  it('uses the current team primary domain for sponsor referral targets', async () => {
    const { prisma, shortLinkProvider, service } = buildService();

    prisma.domain.findFirst.mockResolvedValueOnce({
      host: 'margarita.example.com',
      normalizedHost: 'margarita.example.com',
    });
    prisma.sponsor.findFirst
      .mockResolvedValueOnce(buildSponsor({ publicSlug: 'margarita-pasos' }))
      .mockResolvedValueOnce(null);
    prisma.sponsorVanityShortLink.findFirst.mockResolvedValue(null);
    shortLinkProvider.shortenUrlWithKeyword.mockResolvedValue({
      resolvedUrl: 'https://kuruk.in/margarita-pasos',
      shortUrl: 'https://kuruk.in/margarita-pasos',
      shortCode: 'margarita-pasos',
      provider: 'yourls',
      providerMetadata: null,
    });
    prisma.sponsorVanityShortLink.create.mockResolvedValue(
      buildVanity({
        slug: 'margarita-pasos',
        shortCode: 'margarita-pasos',
        shortUrl: 'https://kuruk.in/margarita-pasos',
        targetUrl: 'https://margarita.example.com/ref/margarita-pasos',
      }),
    );

    await service.generateSponsorVanityShortLink({
      ...scope,
      sponsorId: 'sponsor-1',
    });

    expect(prisma.domain.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-1',
          teamId: 'team-1',
          isPrimary: true,
        }),
      }),
    );
    expect(shortLinkProvider.shortenUrlWithKeyword).toHaveBeenCalledWith(
      'https://margarita.example.com/ref/margarita-pasos',
      'margarita-pasos',
    );
  });

  it('falls back to the LeadFlow system domain for an individual without an active domain', async () => {
    const { prisma, service } = buildService();

    prisma.sponsor.findFirst.mockResolvedValueOnce(
      buildSponsor({ publicSlug: 'margarita-pasos' }),
    );

    await expect(
      service.getSponsorVanityShortLink({
        ...scope,
        sponsorId: 'sponsor-1',
      }),
    ).resolves.toMatchObject({
      slug: 'margarita-pasos',
      targetUrl: 'https://leadflow.kuruk.in/ref/margarita-pasos',
    });
  });

  it('does not use a configured fallback domain when that host belongs to another tenant', async () => {
    const { prisma, service } = buildService({
      publicRefBaseUrl: 'https://ingresos.retodetransformacion.com/ref',
    });

    prisma.domain.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        workspaceId: 'workspace-b',
        teamId: 'team-b',
      });
    prisma.sponsor.findFirst.mockResolvedValueOnce(
      buildSponsor({ publicSlug: 'margarita-pasos' }),
    );

    await expect(
      service.getSponsorVanityShortLink({
        ...scope,
        sponsorId: 'sponsor-1',
      }),
    ).resolves.toMatchObject({
      targetUrl: 'https://leadflow.kuruk.in/ref/margarita-pasos',
    });
  });

  it('allows ingresos.retodetransformacion.com only when it is the current team domain', async () => {
    const { prisma, service } = buildService({
      publicRefBaseUrl: 'https://leadflow.kuruk.in',
    });

    prisma.domain.findFirst.mockResolvedValueOnce({
      host: 'ingresos.retodetransformacion.com',
      normalizedHost: 'ingresos.retodetransformacion.com',
    });
    prisma.sponsor.findFirst.mockResolvedValueOnce(
      buildSponsor({ publicSlug: 'margarita-pasos' }),
    );

    await expect(
      service.getSponsorVanityShortLink({
        ...scope,
        sponsorId: 'sponsor-1',
      }),
    ).resolves.toMatchObject({
      targetUrl:
        'https://ingresos.retodetransformacion.com/ref/margarita-pasos',
    });
  });

  it('requires tenant scope to build a target URL', async () => {
    const { service } = buildService();

    await expect(
      service.buildTargetUrl({
        workspaceId: '',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
        slug: 'margarita-pasos',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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

  it('recreates a stale shortlink when the persisted target belongs to another domain', async () => {
    const { prisma, shortLinkProvider, service } = buildService();
    const stale = buildVanity({
      targetUrl: 'https://ingresos.retodetransformacion.com/ref/javier-quiroz',
    });
    const fresh = buildVanity();

    prisma.sponsor.findFirst
      .mockResolvedValueOnce(buildSponsor({ vanityShortLink: stale }))
      .mockResolvedValueOnce(null);
    prisma.sponsorVanityShortLink.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(stale);
    prisma.sponsorVanityShortLink.delete.mockResolvedValue(stale);
    shortLinkProvider.deleteShortUrl.mockResolvedValue({
      ok: true,
      notFound: false,
    });
    shortLinkProvider.shortenUrlWithKeyword.mockResolvedValue({
      resolvedUrl: 'https://kuruk.in/javier-quiroz',
      shortUrl: 'https://kuruk.in/javier-quiroz',
      shortCode: 'javier-quiroz',
      provider: 'yourls',
      providerMetadata: null,
    });
    prisma.sponsorVanityShortLink.create.mockResolvedValue(fresh);

    const result = await service.generateSponsorVanityShortLink(scope);

    expect(shortLinkProvider.deleteShortUrl).toHaveBeenCalledWith(
      'javier-quiroz',
    );
    expect(shortLinkProvider.shortenUrlWithKeyword).toHaveBeenCalledWith(
      'https://leadflow.kuruk.in/ref/javier-quiroz',
      'javier-quiroz',
    );
    expect(result.shortLink?.shortUrl).toBe(fresh.shortUrl);
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

    await expect(
      service.generateSponsorVanityShortLink(scope),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(shortLinkProvider.shortenUrlWithKeyword).not.toHaveBeenCalled();
  });

  it('rejects reserved slugs before calling YOURLS', async () => {
    const { prisma, shortLinkProvider, service } = buildService();

    prisma.sponsor.findFirst.mockResolvedValueOnce(
      buildSponsor({ publicSlug: 'api' }),
    );

    await expect(
      service.generateSponsorVanityShortLink(scope),
    ).rejects.toBeInstanceOf(BadRequestException);
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

    await expect(
      service.generateSponsorVanityShortLink(scope),
    ).rejects.toBeInstanceOf(ConflictException);
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

    await expect(
      service.generateSponsorVanityShortLink(scope),
    ).rejects.toBeInstanceOf(ConflictException);
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
