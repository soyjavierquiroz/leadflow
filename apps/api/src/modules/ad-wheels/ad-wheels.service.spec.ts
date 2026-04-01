import { BadGatewayException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { AdWheelsService } from './ad-wheels.service';

describe('AdWheelsService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  const buildService = () => {
    const prisma = {
      team: {
        findFirst: jest.fn(),
      },
      sponsor: {
        findFirst: jest.fn(),
      },
      adWheel: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      adWheelParticipant: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;
    const walletEngineService = {
      upsertTeamAccount: jest.fn(),
      formatMinorUnits: jest.fn(),
      debitSeat: jest.fn(),
    } as any;

    return {
      prisma,
      walletEngineService,
      service: new AdWheelsService(prisma, walletEngineService),
    };
  };

  it('creates an active wheel using the provided start date and duration', async () => {
    const { prisma, service } = buildService();
    const startDate = new Date('2026-04-10T00:00:00.000Z');
    const endDate = new Date('2026-04-24T00:00:00.000Z');

    prisma.team.findFirst = jest.fn().mockResolvedValue({ id: 'team-1' });
    prisma.adWheel.findFirst = jest.fn().mockResolvedValue(null);
    prisma.adWheel.create = jest.fn().mockResolvedValue({
      id: 'wheel-1',
      teamId: 'team-1',
      status: 'ACTIVE',
      name: 'Abril',
      seatPrice: 5_000,
      startDate,
      endDate,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });

    const result = await service.createForTeam(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
      },
      {
        status: 'ACTIVE',
        name: 'Abril',
        seatPrice: 5_000,
        startDate: startDate.toISOString(),
        durationDays: 14,
      },
    );

    expect(result.status).toBe('ACTIVE');
    expect(prisma.adWheel.create).toHaveBeenCalledWith({
      data: {
        teamId: 'team-1',
        status: 'ACTIVE',
        name: 'Abril',
        seatPrice: 5_000,
        startDate,
        endDate,
      },
    });
  });

  it('rejects wheel durations shorter than one day', async () => {
    const { prisma, service } = buildService();

    prisma.team.findFirst = jest.fn().mockResolvedValue({ id: 'team-1' });

    await expect(
      service.createForTeam(
        {
          workspaceId: 'workspace-1',
          teamId: 'team-1',
        },
        {
          status: 'ACTIVE',
          name: 'Abril',
          seatPrice: 5_000,
          startDate: '2026-04-10T00:00:00.000Z',
          durationDays: 0,
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        field: 'durationDays',
      }),
    });
  });

  it('updates the wheel schedule when the wheel has not started yet', async () => {
    const { prisma, service } = buildService();
    const now = new Date('2026-04-01T00:00:00.000Z');
    const currentStartDate = new Date('2026-04-10T00:00:00.000Z');
    const nextStartDate = new Date('2026-04-20T00:00:00.000Z');
    const nextEndDate = new Date('2026-05-05T00:00:00.000Z');

    jest.useFakeTimers().setSystemTime(now);

    prisma.team.findFirst = jest.fn().mockResolvedValue({ id: 'team-1' });
    prisma.adWheel.findFirst = jest.fn().mockResolvedValue({
      id: 'wheel-1',
      teamId: 'team-1',
      status: 'ACTIVE',
      name: 'Abril',
      seatPrice: 5_000,
      startDate: currentStartDate,
      endDate: new Date('2026-04-24T00:00:00.000Z'),
      createdAt: now,
      updatedAt: now,
    });
    prisma.adWheel.update = jest.fn().mockResolvedValue({
      id: 'wheel-1',
      teamId: 'team-1',
      status: 'ACTIVE',
      name: 'Abril Plus',
      seatPrice: 7_500,
      startDate: nextStartDate,
      endDate: nextEndDate,
      createdAt: now,
      updatedAt: now,
    });

    const result = await service.updateForTeam(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
      },
      'wheel-1',
      {
        name: 'Abril Plus',
        seatPrice: 7_500,
        startDate: nextStartDate.toISOString(),
        durationDays: 15,
      },
    );

    expect(result).toMatchObject({
      id: 'wheel-1',
      name: 'Abril Plus',
      seatPrice: 7_500,
    });
    expect(prisma.adWheel.update).toHaveBeenCalledWith({
      where: {
        id: 'wheel-1',
      },
      data: {
        name: 'Abril Plus',
        seatPrice: 7_500,
        startDate: nextStartDate,
        endDate: nextEndDate,
      },
    });
  });

  it('rejects seat price and timing edits after the wheel has started', async () => {
    const { prisma, service } = buildService();
    const now = new Date('2026-04-20T00:00:00.000Z');

    jest.useFakeTimers().setSystemTime(now);

    prisma.team.findFirst = jest.fn().mockResolvedValue({ id: 'team-1' });
    prisma.adWheel.findFirst = jest.fn().mockResolvedValue({
      id: 'wheel-1',
      teamId: 'team-1',
      status: 'ACTIVE',
      name: 'Abril',
      seatPrice: 5_000,
      startDate: new Date('2026-04-10T00:00:00.000Z'),
      endDate: new Date('2026-04-24T00:00:00.000Z'),
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    });

    await expect(
      service.updateForTeam(
        {
          workspaceId: 'workspace-1',
          teamId: 'team-1',
        },
        'wheel-1',
        {
          seatPrice: 7_500,
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('still allows renaming a wheel after it has started', async () => {
    const { prisma, service } = buildService();
    const now = new Date('2026-04-20T00:00:00.000Z');
    const wheel = {
      id: 'wheel-1',
      teamId: 'team-1',
      status: 'ACTIVE',
      name: 'Abril',
      seatPrice: 5_000,
      startDate: new Date('2026-04-10T00:00:00.000Z'),
      endDate: new Date('2026-04-24T00:00:00.000Z'),
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    };

    jest.useFakeTimers().setSystemTime(now);

    prisma.team.findFirst = jest.fn().mockResolvedValue({ id: 'team-1' });
    prisma.adWheel.findFirst = jest.fn().mockResolvedValue(wheel);
    prisma.adWheel.update = jest.fn().mockResolvedValue({
      ...wheel,
      name: 'Abril Renombrada',
      updatedAt: now,
    });

    const result = await service.updateForTeam(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
      },
      'wheel-1',
      {
        name: 'Abril Renombrada',
      },
    );

    expect(result.name).toBe('Abril Renombrada');
    expect(prisma.adWheel.update).toHaveBeenCalledWith({
      where: {
        id: 'wheel-1',
      },
      data: {
        name: 'Abril Renombrada',
        seatPrice: 5_000,
        startDate: wheel.startDate,
        endDate: wheel.endDate,
      },
    });
  });

  it('lists the team wheels with participant counts', async () => {
    const { prisma, service } = buildService();

    prisma.team.findFirst = jest.fn().mockResolvedValue({ id: 'team-1' });
    prisma.adWheel.findMany = jest.fn().mockResolvedValue([
      {
        id: 'wheel-2',
        teamId: 'team-1',
        status: 'DRAFT',
        name: 'Mayo',
        seatPrice: 3_000,
        startDate: new Date('2026-05-01T00:00:00.000Z'),
        endDate: new Date('2026-05-31T23:59:59.000Z'),
        createdAt: new Date('2026-04-02T00:00:00.000Z'),
        updatedAt: new Date('2026-04-02T00:00:00.000Z'),
        _count: {
          participants: 1,
        },
      },
      {
        id: 'wheel-1',
        teamId: 'team-1',
        status: 'ACTIVE',
        name: 'Abril',
        seatPrice: 5_000,
        startDate: new Date('2026-04-01T00:00:00.000Z'),
        endDate: new Date('2026-04-30T23:59:59.000Z'),
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-01T00:00:00.000Z'),
        _count: {
          participants: 3,
        },
      },
    ]);

    const result = await service.listForTeam({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'wheel-1',
      status: 'ACTIVE',
      participantCount: 3,
    });
    expect(result[1]).toMatchObject({
      id: 'wheel-2',
      status: 'DRAFT',
      participantCount: 1,
    });
  });

  it('returns the active wheel snapshot for the current sponsor', async () => {
    const { prisma, service } = buildService();

    prisma.sponsor.findFirst = jest.fn().mockResolvedValue({ id: 'sponsor-1' });
    prisma.adWheel.findFirst = jest.fn().mockResolvedValue({
      id: 'wheel-1',
      teamId: 'team-1',
      status: 'ACTIVE',
      name: 'Abril',
      seatPrice: 5_000,
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-04-30T23:59:59.000Z'),
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      participants: [{ sponsorId: 'sponsor-1' }],
    });

    const result = await service.getActiveForSponsor({
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      sponsorId: 'sponsor-1',
    });

    expect(result).toMatchObject({
      isParticipating: true,
      wheel: {
        id: 'wheel-1',
        status: 'ACTIVE',
      },
    });
  });

  it('maps upstream wallet 402 responses to HTTP 402 during sponsor buy-in', async () => {
    const { prisma, walletEngineService, service } = buildService();

    prisma.sponsor.findFirst = jest.fn().mockResolvedValue({ id: 'sponsor-1' });
    prisma.adWheel.findFirst = jest.fn().mockResolvedValue({
      id: 'wheel-1',
      teamId: 'team-1',
      status: 'ACTIVE',
      name: 'Abril',
      seatPrice: 5_000,
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-04-30T23:59:59.000Z'),
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      participants: [],
    });
    walletEngineService.upsertTeamAccount.mockResolvedValue({
      id: 'account-1',
    });
    walletEngineService.formatMinorUnits.mockReturnValue('50.00');
    walletEngineService.debitSeat.mockRejectedValue(
      new BadGatewayException({
        code: 'WALLET_ENGINE_REQUEST_FAILED',
        message:
          'Wallet engine request failed with HTTP 402: insufficient funds',
        upstreamStatus: 402,
      }),
    );

    await expect(
      service.joinForSponsor(
        {
          workspaceId: 'workspace-1',
          teamId: 'team-1',
          sponsorId: 'sponsor-1',
        },
        'wheel-1',
      ),
    ).rejects.toMatchObject({
      status: 402,
    });
  });

  it('returns an existing participation without charging again', async () => {
    const { prisma, walletEngineService, service } = buildService();

    prisma.sponsor.findFirst = jest.fn().mockResolvedValue({ id: 'sponsor-1' });
    prisma.adWheel.findFirst = jest.fn().mockResolvedValue({
      id: 'wheel-1',
      teamId: 'team-1',
      status: 'ACTIVE',
      name: 'Abril',
      seatPrice: 5_000,
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2026-04-30T23:59:59.000Z'),
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
      participants: [
        {
          adWheelId: 'wheel-1',
          sponsorId: 'sponsor-1',
          joinedAt: new Date('2026-04-01T01:00:00.000Z'),
        },
      ],
    });

    const result = await service.joinForSponsor(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
      },
      'wheel-1',
    );

    expect(result.alreadyJoined).toBe(true);
    expect(result.wallet).toBeNull();
    expect(walletEngineService.debitSeat).not.toHaveBeenCalled();
  });

  it('rejects creating a second active wheel for the same team', async () => {
    const { prisma, service } = buildService();

    prisma.team.findFirst = jest.fn().mockResolvedValue({ id: 'team-1' });
    prisma.adWheel.findFirst = jest.fn().mockResolvedValue({ id: 'wheel-1' });

    await expect(
      service.createForTeam(
        {
          workspaceId: 'workspace-1',
          teamId: 'team-1',
        },
        {
          status: 'ACTIVE',
          name: 'Abril',
          seatPrice: 5_000,
          startDate: '2026-04-10T00:00:00.000Z',
          durationDays: 14,
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
