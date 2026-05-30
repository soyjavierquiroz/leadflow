import { Prisma } from '@prisma/client';
import { PublicIdentityLinkService } from './public-identity-link.service';

const expiresAt = new Date('2026-06-01T12:00:00.000Z');

const buildLead = (overrides?: Record<string, unknown>) => ({
  id: 'lead-1',
  workspaceId: 'workspace-1',
  fullName: 'Veronica Perez',
  email: 'veronica@example.com',
  phone: null,
  companyName: null,
  status: 'assigned',
  updatedAt: new Date('2026-05-30T12:00:00.000Z'),
  visitor: {
    id: 'visitor-1',
    anonymousId: 'anonymous-1',
  },
  currentAssignment: {
    id: 'assignment-1',
    ownershipKey: 'lf_own_3af5cca1a045f54d1834defd',
    status: 'assigned',
    reason: 'rotation',
    assignedAt: new Date('2026-05-30T11:00:00.000Z'),
    sponsor: {
      id: 'sponsor-1',
      displayName: 'Freddy Catunta',
      email: 'freddy@example.com',
      phone: '59170554048',
      avatarUrl: null,
    },
  },
  funnelPublication: {
    id: 'publication-1',
    funnelInstanceId: 'instance-1',
    pathPrefix: '/',
    domain: {
      host: 'example.com',
      canonicalHost: 'example.com',
    },
    team: {
      name: 'Equipo DXN',
    },
    handoffStrategy: null,
    funnelInstance: {
      name: 'DXN',
      structuralType: 'two_step_conversion',
      handoffStrategy: null,
      steps: [
        {
          id: 'step-1',
          slug: 'captura',
          stepType: 'landing',
          isEntryStep: true,
          settingsJson: {},
          blocksJson: [],
        },
        {
          id: 'step-2',
          slug: 'presentacion',
          stepType: 'presentation',
          isEntryStep: false,
          settingsJson: {},
          blocksJson: [
            {
              type: 'hero_vsl_delayed_cta',
              content: {
                whatsapp_message:
                  'Hola {{advisor.first_name}}, vi la presentación de {{team.name}} y quiero saber cómo empezar.',
              },
              behavior: {
                cta_mode: 'assigned_whatsapp',
              },
            },
          ],
        },
      ],
    },
  },
  ...overrides,
});

const buildTrackedLinkRecord = (
  overrides?: Partial<{
    id: string;
    longUrl: string;
    shortUrl: string | null;
    shortCode: string | null;
    shortLinkProvider: string;
  }>,
) => ({
  id: 'tracked-link-1',
  longUrl: 'https://example.com/presentacion?ctx=ctx-token',
  shortUrl: null,
  shortCode: null,
  shortLinkProvider: 'fallback_long_url',
  ...overrides,
});

const buildHydrateTrackedLink = (
  overrides?: Partial<{
    id: string;
    status: 'active' | 'revoked' | 'expired' | 'deleted';
    expiresAt: Date | null;
  }>,
) => ({
  id: 'tracked-link-1',
  status: 'active' as const,
  expiresAt,
  ...overrides,
});

const buildRevocableTrackedLink = (
  overrides?: Partial<{
    id: string;
    metadataJson: Record<string, unknown> | null;
  }>,
) => ({
  id: 'tracked-link-1',
  metadataJson: {
    targetStepPath: '/presentacion',
  },
  ...overrides,
});

const buildService = (input?: {
  lead?: ReturnType<typeof buildLead>;
  existingTrackedLink?: ReturnType<typeof buildTrackedLinkRecord> | null;
  createdTrackedLink?: ReturnType<typeof buildTrackedLinkRecord>;
  hydrateTrackedLink?: ReturnType<typeof buildHydrateTrackedLink> | null;
  revocableTrackedLinks?: ReturnType<typeof buildRevocableTrackedLink>[];
  shortenResult?: {
    shortUrl: string | null;
    resolvedUrl: string;
    shortened: boolean;
    provider: 'yourls' | 'fallback_long_url';
  };
  shortCode?: string | null;
}) => {
  const createdTrackedLink =
    input?.createdTrackedLink ?? buildTrackedLinkRecord();
  const prisma = {
    $transaction: jest.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    ),
    lead: {
      findUnique: jest.fn().mockResolvedValue(input?.lead ?? buildLead()),
    },
    trackedLink: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest
        .fn()
        .mockResolvedValue(input?.revocableTrackedLinks ?? []),
      findUnique: jest
        .fn()
        .mockResolvedValue(input?.hydrateTrackedLink ?? null),
      findFirst: jest
        .fn()
        .mockResolvedValue(input?.existingTrackedLink ?? null),
      create: jest.fn().mockResolvedValue(createdTrackedLink),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const identityTokenService = {
    issueToken: jest.fn().mockReturnValue('ctx-token'),
    hashToken: jest.fn().mockReturnValue('ctx-token-hash'),
    getDefaultExpiresAt: jest.fn().mockReturnValue(expiresAt),
    verifyToken: jest.fn().mockReturnValue({
      leadId: 'lead-1',
      publicationId: 'publication-1',
      targetStepPath: '/presentacion',
    }),
  };
  const shortenResult =
    input?.shortenResult ??
    ({
      shortUrl: null,
      resolvedUrl: 'https://example.com/presentacion?ctx=ctx-token',
      shortened: false,
      provider: 'fallback_long_url',
    } as const);
  const shortLinkProvider = {
    shortenUrl: jest.fn().mockResolvedValue(shortenResult),
    extractShortCode: jest.fn().mockReturnValue(input?.shortCode ?? null),
  };
  const service = new PublicIdentityLinkService(
    prisma as any,
    identityTokenService as any,
    shortLinkProvider as any,
  );

  return {
    service,
    prisma,
    identityTokenService,
    shortLinkProvider,
  };
};

describe('PublicIdentityLinkService', () => {
  it('creates a TrackedLink with cached false on first generate', async () => {
    const { service, prisma, identityTokenService } = buildService();

    const result = await service.generateTrackedLink({
      leadId: 'lead-1',
      stepKey: 'presentacion',
    });
    const decodedWhatsappUrl = decodeURIComponent(result.whatsappUrl ?? '');

    expect(result.cached).toBe(false);
    expect(result.trackedLinkId).toBe('tracked-link-1');
    expect(result.token).toBe('ctx-token');
    expect(result.targetStep.path).toBe('/presentacion');
    expect(result.longUrl).toContain('?ctx=');
    expect(decodedWhatsappUrl).toContain(
      'Hola Freddy, vi la presentación de Equipo DXN y quiero saber cómo empezar.',
    );
    expect(decodedWhatsappUrl).toContain('Ref: 3AF5CCA1');
    expect(decodedWhatsappUrl).not.toContain('lf_own_');
    expect(identityTokenService.hashToken).toHaveBeenCalledWith('ctx-token');
    expect(prisma.trackedLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'workspace-1',
          leadId: 'lead-1',
          assignmentId: 'assignment-1',
          ownershipKey: 'lf_own_3af5cca1a045f54d1834defd',
          funnelPublicationId: 'publication-1',
          funnelInstanceId: 'instance-1',
          funnelStepId: 'step-2',
          stepKey: 'presentacion',
          appKey: 'leadflow',
          action: 'open_vsl',
          purpose: 'vsl_followup',
          ctxTokenHash: 'ctx-token-hash',
          expiresAt,
          createdBy: 'n8n',
          metadataJson: {
            targetStepPath: '/presentacion',
            targetStepSlug: 'presentacion',
            host: 'example.com',
            generatedBy: 'generate-tracked-link',
          },
        }),
      }),
    );
  });

  it('reuses an active TrackedLink with cached true', async () => {
    const existingTrackedLink = buildTrackedLinkRecord({
      longUrl: 'https://example.com/presentacion?ctx=old-token',
      shortUrl: 'https://kuruk.in/abc123',
      shortCode: 'abc123',
      shortLinkProvider: 'yourls',
    });
    const { service, identityTokenService, shortLinkProvider } = buildService({
      existingTrackedLink,
    });

    const result = await service.generateTrackedLink({
      leadId: 'lead-1',
      stepKey: 'presentacion',
    });

    expect(result.cached).toBe(true);
    expect(result.trackedLinkId).toBe('tracked-link-1');
    expect(result.token).toBeNull();
    expect(result.longUrl).toBe('https://example.com/presentacion?ctx=old-token');
    expect(result.shortUrl).toBe('https://kuruk.in/abc123');
    expect(result.url).toBe('https://kuruk.in/abc123');
    expect(result.shortCode).toBe('abc123');
    expect(identityTokenService.issueToken).not.toHaveBeenCalled();
    expect(shortLinkProvider.shortenUrl).not.toHaveBeenCalled();
  });

  it('stores fallback_long_url when YOURLS is not available', async () => {
    const { service, prisma } = buildService();

    const result = await service.generateTrackedLink({
      leadId: 'lead-1',
      stepKey: 'presentacion',
    });

    expect(result.shortLinkProvider).toBe('fallback_long_url');
    expect(result.shortUrl).toBeNull();
    expect(prisma.trackedLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shortUrl: null,
          shortCode: null,
          shortLinkProvider: 'fallback_long_url',
        }),
      }),
    );
  });

  it('stores and returns shortUrl and shortCode when YOURLS responds', async () => {
    const createdTrackedLink = buildTrackedLinkRecord({
      shortUrl: 'https://kuruk.in/abc123',
      shortCode: 'abc123',
      shortLinkProvider: 'yourls',
    });
    const { service, prisma, shortLinkProvider } = buildService({
      createdTrackedLink,
      shortenResult: {
        shortUrl: 'https://kuruk.in/abc123',
        resolvedUrl: 'https://kuruk.in/abc123',
        shortened: true,
        provider: 'yourls',
      },
      shortCode: 'abc123',
    });

    const result = await service.generateTrackedLink({
      leadId: 'lead-1',
      stepKey: 'presentacion',
    });

    expect(result.shortUrl).toBe('https://kuruk.in/abc123');
    expect(result.url).toBe('https://kuruk.in/abc123');
    expect(result.shortened).toBe(true);
    expect(result.shortCode).toBe('abc123');
    expect(shortLinkProvider.extractShortCode).toHaveBeenCalledWith(
      'https://kuruk.in/abc123',
    );
    expect(prisma.trackedLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shortUrl: 'https://kuruk.in/abc123',
          shortCode: 'abc123',
          shortLinkProvider: 'yourls',
        }),
      }),
    );
  });

  it('marks expired active links before creating a new TrackedLink', async () => {
    const { service, prisma } = buildService();

    await service.generateTrackedLink({
      leadId: 'lead-1',
      stepKey: 'presentacion',
    });

    expect(prisma.trackedLink.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        leadId: 'lead-1',
        assignmentId: 'assignment-1',
        funnelStepId: 'step-2',
        purpose: 'vsl_followup',
        status: 'active',
        expiresAt: expect.objectContaining({
          lt: expect.any(Date),
        }),
      }),
      data: {
        status: 'expired',
      },
    });
    expect(prisma.trackedLink.create).toHaveBeenCalled();
  });

  it('returns cached true when create races with active idempotency unique', async () => {
    const raceTrackedLink = buildTrackedLinkRecord({
      id: 'tracked-link-race',
      longUrl: 'https://example.com/presentacion?ctx=race-token',
    });
    const { service, prisma } = buildService();
    prisma.trackedLink.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(raceTrackedLink);
    prisma.trackedLink.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const result = await service.generateTrackedLink({
      leadId: 'lead-1',
      stepKey: 'presentacion',
    });

    expect(result.cached).toBe(true);
    expect(result.trackedLinkId).toBe('tracked-link-race');
    expect(result.token).toBeNull();
    expect(result.longUrl).toBe('https://example.com/presentacion?ctx=race-token');
  });

  it('hydrate with active TrackedLink increments clickCount and lastClickedAt', async () => {
    const { service, prisma, identityTokenService } = buildService({
      hydrateTrackedLink: buildHydrateTrackedLink(),
    });

    const result = await service.hydrateIdentityContext('ctx-token');

    expect(identityTokenService.hashToken).toHaveBeenCalledWith('ctx-token');
    expect(prisma.trackedLink.findUnique).toHaveBeenCalledWith({
      where: {
        ctxTokenHash: 'ctx-token-hash',
      },
      select: {
        id: true,
        status: true,
        expiresAt: true,
      },
    });
    expect(prisma.trackedLink.update).toHaveBeenCalledWith({
      where: {
        id: 'tracked-link-1',
      },
      data: {
        clickCount: {
          increment: 1,
        },
        lastClickedAt: expect.any(Date),
      },
    });
    expect(result.submissionContext.leadId).toBe('lead-1');
    expect(result.submissionContext.handoff.whatsappUrl).toContain(
      'https://wa.me/',
    );
  });

  it('hydrate with revoked TrackedLink returns unavailable 410', async () => {
    const { service, prisma } = buildService({
      hydrateTrackedLink: buildHydrateTrackedLink({
        status: 'revoked',
      }),
    });

    await expect(service.hydrateIdentityContext('ctx-token')).rejects.toMatchObject({
      response: {
        code: 'TRACKED_LINK_UNAVAILABLE',
        message: 'This tracked link is no longer available.',
      },
      status: 410,
    });
    expect(prisma.trackedLink.update).not.toHaveBeenCalled();
  });

  it('hydrate with expired status TrackedLink returns unavailable 410', async () => {
    const { service, prisma } = buildService({
      hydrateTrackedLink: buildHydrateTrackedLink({
        status: 'expired',
      }),
    });

    await expect(service.hydrateIdentityContext('ctx-token')).rejects.toMatchObject({
      response: {
        code: 'TRACKED_LINK_UNAVAILABLE',
        message: 'This tracked link is no longer available.',
      },
      status: 410,
    });
    expect(prisma.trackedLink.update).not.toHaveBeenCalled();
  });

  it('hydrate with active expired TrackedLink marks expired and returns unavailable 410', async () => {
    const { service, prisma } = buildService({
      hydrateTrackedLink: buildHydrateTrackedLink({
        expiresAt: new Date('2020-01-01T00:00:00.000Z'),
      }),
    });

    await expect(service.hydrateIdentityContext('ctx-token')).rejects.toMatchObject({
      response: {
        code: 'TRACKED_LINK_UNAVAILABLE',
        message: 'This tracked link is no longer available.',
      },
      status: 410,
    });
    expect(prisma.trackedLink.update).toHaveBeenCalledWith({
      where: {
        id: 'tracked-link-1',
      },
      data: {
        status: 'expired',
      },
    });
  });

  it('hydrate with legacy ctx without TrackedLink still works', async () => {
    const { service, prisma } = buildService({
      hydrateTrackedLink: null,
    });

    const result = await service.hydrateIdentityContext('ctx-token');

    expect(result.publicationId).toBe('publication-1');
    expect(result.targetStepPath).toBe('/presentacion');
    expect(result.submissionContext.assignment?.id).toBe('assignment-1');
    expect(prisma.trackedLink.update).not.toHaveBeenCalled();
  });

  it('revokeTrackedLinksForLead revokes active links and returns count', async () => {
    const { service, prisma } = buildService({
      revocableTrackedLinks: [
        buildRevocableTrackedLink({
          id: 'tracked-link-1',
        }),
        buildRevocableTrackedLink({
          id: 'tracked-link-2',
          metadataJson: null,
        }),
      ],
    });

    const result = await service.revokeTrackedLinksForLead(
      'lead-1',
      'spam lead',
    );

    expect(result).toEqual({
      revoked: 2,
    });
    expect(prisma.trackedLink.findMany).toHaveBeenCalledWith({
      where: {
        leadId: 'lead-1',
        status: 'active',
      },
      select: {
        id: true,
        metadataJson: true,
      },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.trackedLink.update).toHaveBeenCalledTimes(2);
    expect(prisma.trackedLink.update).toHaveBeenCalledWith({
      where: {
        id: 'tracked-link-1',
      },
      data: expect.objectContaining({
        status: 'revoked',
        metadataJson: expect.objectContaining({
          revokedAt: expect.any(String),
          revokedReason: 'spam lead',
        }),
      }),
    });
    expect(prisma.trackedLink.update).toHaveBeenCalledWith({
      where: {
        id: 'tracked-link-2',
      },
      data: expect.objectContaining({
        status: 'revoked',
        metadataJson: expect.objectContaining({
          revokedAt: expect.any(String),
          revokedReason: 'spam lead',
        }),
      }),
    });
  });

  it('revokeTrackedLinksForLead preserves previous metadata', async () => {
    const { service, prisma } = buildService({
      revocableTrackedLinks: [
        buildRevocableTrackedLink({
          metadataJson: {
            targetStepPath: '/presentacion',
            generatedBy: 'generate-tracked-link',
          },
        }),
      ],
    });

    await service.revokeTrackedLinksForLead('lead-1', 'deleted');

    expect(prisma.trackedLink.update).toHaveBeenCalledWith({
      where: {
        id: 'tracked-link-1',
      },
      data: {
        status: 'revoked',
        metadataJson: expect.objectContaining({
          targetStepPath: '/presentacion',
          generatedBy: 'generate-tracked-link',
          revokedAt: expect.any(String),
          revokedReason: 'deleted',
        }),
      },
    });
  });

  it('revokeTrackedLinksForLead returns 0 when no active links exist', async () => {
    const { service, prisma } = buildService({
      revocableTrackedLinks: [],
    });

    const result = await service.revokeTrackedLinksForLead('lead-1');

    expect(result).toEqual({
      revoked: 0,
    });
    expect(prisma.trackedLink.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
