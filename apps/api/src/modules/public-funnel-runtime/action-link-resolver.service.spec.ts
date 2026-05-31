import { BadRequestException } from '@nestjs/common';
import {
  ACTION_LINK_DEFAULT_CHANNEL,
  ACTION_LINK_DEFAULT_PURPOSE,
  ACTION_LINK_OPEN_VSL,
  ActionLinkResolverService,
  type ResolveActionLinkInput,
} from './action-link-resolver.service';

const expiresAt = new Date('2026-06-01T12:00:00.000Z');

const buildLegacyResult = (
  overrides?: Partial<{
    token: string | null;
    longUrl: string;
    shortUrl: string | null;
    url: string;
    shortened: boolean;
    shortLinkProvider: string;
    cached: boolean;
    trackedLinkId: string;
    shortCode: string | null;
  }>,
) => ({
  leadId: 'lead-1',
  publicationId: 'publication-1',
  stepKey: 'presentacion',
  targetStep: {
    id: 'step-2',
    slug: 'presentacion',
    path: '/presentacion',
    stepType: 'presentation',
  },
  token: 'ctx-token',
  longUrl: 'https://example.com/presentacion?ctx=ctx-token',
  shortUrl: null,
  url: 'https://example.com/presentacion?ctx=ctx-token',
  shortened: false,
  shortLinkProvider: 'fallback_long_url',
  whatsappUrl: 'https://wa.me/59170554048',
  cached: false,
  trackedLinkId: 'tracked-link-1',
  shortCode: null,
  ...overrides,
});

const buildService = (input?: {
  legacyResult?: ReturnType<typeof buildLegacyResult>;
  currentAssignmentId?: string | null;
  trackedLinkExpiresAt?: Date | null;
}) => {
  const prisma = {
    lead: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'lead-1',
        currentAssignmentId: input?.currentAssignmentId ?? 'assignment-1',
      }),
    },
    trackedLink: {
      findUnique: jest.fn().mockResolvedValue({
        expiresAt: input?.trackedLinkExpiresAt ?? expiresAt,
      }),
    },
  };
  const publicIdentityLinkService = {
    generateTrackedIdentityLink: jest
      .fn()
      .mockResolvedValue(input?.legacyResult ?? buildLegacyResult()),
  };
  const service = new ActionLinkResolverService(
    prisma as any,
    publicIdentityLinkService as any,
  );

  return {
    service,
    prisma,
    publicIdentityLinkService,
  };
};

const resolveInput = (
  overrides?: Partial<ResolveActionLinkInput>,
): ResolveActionLinkInput => ({
  leadId: 'lead-1',
  actionKey: ACTION_LINK_OPEN_VSL,
  ...overrides,
});

describe('ActionLinkResolverService', () => {
  it('resolves leadflow.open_vsl by delegating to the tracked identity link core', async () => {
    const { service, publicIdentityLinkService } = buildService();

    const result = await service.resolve(
      resolveInput({
        params: {
          stepKey: 'custom-step',
        },
      }),
    );

    expect(
      publicIdentityLinkService.generateTrackedIdentityLink,
    ).toHaveBeenCalledWith({
      leadId: 'lead-1',
      stepKey: 'custom-step',
    });
    expect(result).toEqual({
      ok: true,
      actionKey: 'leadflow.open_vsl',
      appKey: 'leadflow',
      purpose: 'vsl_followup',
      channel: 'whatsapp',
      url: 'https://example.com/presentacion?ctx=ctx-token',
      longUrl: 'https://example.com/presentacion?ctx=ctx-token',
      shortUrl: null,
      provider: 'fallback_long_url',
      trackedLinkId: 'tracked-link-1',
      cached: false,
      expiresAt,
      metadata: {
        targetStep: {
          id: 'step-2',
          slug: 'presentacion',
          path: '/presentacion',
          stepType: 'presentation',
        },
        shortCode: null,
      },
    });
  });

  it('uses default stepKey, purpose, and channel', async () => {
    const { service, publicIdentityLinkService } = buildService();

    const result = await service.resolve(resolveInput());

    expect(
      publicIdentityLinkService.generateTrackedIdentityLink,
    ).toHaveBeenCalledWith({
      leadId: 'lead-1',
      stepKey: 'presentacion',
    });
    expect(result.purpose).toBe(ACTION_LINK_DEFAULT_PURPOSE);
    expect(result.channel).toBe(ACTION_LINK_DEFAULT_CHANNEL);
  });

  it('does not expose the legacy ctx token in the action link output', async () => {
    const { service } = buildService();

    const result = await service.resolve(resolveInput());

    expect(result).not.toHaveProperty('token');
  });

  it('maps cached false results correctly', async () => {
    const { service } = buildService({
      legacyResult: buildLegacyResult({
        cached: false,
        token: 'ctx-token',
        shortUrl: 'https://kuruk.in/abc123',
        url: 'https://kuruk.in/abc123',
        shortened: true,
        shortLinkProvider: 'yourls',
        shortCode: 'abc123',
      }),
    });

    const result = await service.resolve(resolveInput());

    expect(result.cached).toBe(false);
    expect(result.url).toBe('https://kuruk.in/abc123');
    expect(result.shortUrl).toBe('https://kuruk.in/abc123');
    expect(result.provider).toBe('yourls');
    expect(result.metadata.shortCode).toBe('abc123');
    expect(result).not.toHaveProperty('token');
  });

  it('maps cached true results correctly', async () => {
    const { service } = buildService({
      legacyResult: buildLegacyResult({
        cached: true,
        token: null,
        longUrl: 'https://example.com/presentacion?ctx=old-token',
        shortUrl: 'https://kuruk.in/cached',
        url: 'https://kuruk.in/cached',
        shortened: true,
        shortLinkProvider: 'yourls',
        shortCode: 'cached',
      }),
    });

    const result = await service.resolve(resolveInput());

    expect(result.cached).toBe(true);
    expect(result.longUrl).toBe(
      'https://example.com/presentacion?ctx=old-token',
    );
    expect(result.url).toBe('https://kuruk.in/cached');
    expect(result.shortUrl).toBe('https://kuruk.in/cached');
    expect(result.provider).toBe('yourls');
    expect(result.metadata.shortCode).toBe('cached');
    expect(result).not.toHaveProperty('token');
  });

  it('rejects unsupported actionKey', async () => {
    const { service, publicIdentityLinkService } = buildService();

    await expect(
      service.resolve(
        resolveInput({
          actionKey: 'calendar.book_call' as ResolveActionLinkInput['actionKey'],
        }),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'ACTION_LINK_UNSUPPORTED_ACTION',
      },
    });
    expect(
      publicIdentityLinkService.generateTrackedIdentityLink,
    ).not.toHaveBeenCalled();
  });

  it('rejects unsupported appKey', async () => {
    const { service, publicIdentityLinkService } = buildService();

    await expect(
      service.resolve(
        resolveInput({
          appKey: 'wallet',
        }),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'ACTION_LINK_UNSUPPORTED_APP',
      },
    });
    expect(
      publicIdentityLinkService.generateTrackedIdentityLink,
    ).not.toHaveBeenCalled();
  });

  it('validates assignmentId mismatch before delegating', async () => {
    const { service, publicIdentityLinkService } = buildService({
      currentAssignmentId: 'assignment-1',
    });

    await expect(
      service.resolve(
        resolveInput({
          assignmentId: 'assignment-other',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.resolve(
        resolveInput({
          assignmentId: 'assignment-other',
        }),
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'ACTION_LINK_ASSIGNMENT_MISMATCH',
      },
    });
    expect(
      publicIdentityLinkService.generateTrackedIdentityLink,
    ).not.toHaveBeenCalled();
  });

  it('allows matching assignmentId and delegates', async () => {
    const { service, prisma, publicIdentityLinkService } = buildService({
      currentAssignmentId: 'assignment-1',
    });

    await service.resolve(
      resolveInput({
        assignmentId: 'assignment-1',
      }),
    );

    expect(prisma.lead.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'lead-1',
      },
      select: {
        id: true,
        currentAssignmentId: true,
      },
    });
    expect(
      publicIdentityLinkService.generateTrackedIdentityLink,
    ).toHaveBeenCalledWith({
      leadId: 'lead-1',
      stepKey: 'presentacion',
    });
  });

  it('does not call shortener or FunnelEvent services directly', async () => {
    const { service, publicIdentityLinkService } = buildService();

    await service.resolve(resolveInput());

    expect(
      publicIdentityLinkService.generateTrackedIdentityLink,
    ).toHaveBeenCalledTimes(1);
  });
});
