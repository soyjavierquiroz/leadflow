import { UserRole, UserStatus } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { WalletEngineService } from '../finance/wallet-engine.service';
import { MailerService } from '../shared/mailer.service';
import { TeamMembersService } from './team-members.service';

describe('TeamMembersService', () => {
  const buildService = () => {
    const prisma = {
      $transaction: jest.fn(),
      user: {
        findFirst: jest.fn(),
      },
    } as unknown as PrismaService;
    const walletEngineService = {
      upsertSponsorAccount: jest.fn(),
    } as unknown as WalletEngineService;
    const mailerService = {} as MailerService;

    return {
      prisma,
      walletEngineService,
      service: new TeamMembersService(
        prisma,
        walletEngineService,
        mailerService,
      ),
    };
  };

  it('keeps team admin logins active when their seat is disabled', async () => {
    const { prisma, walletEngineService, service } = buildService();
    const scope = {
      workspaceId: 'workspace-1',
      teamId: 'team-1',
    };
    const memberRecord = {
      id: 'admin-1',
      email: 'freddy@example.com',
      fullName: 'Freddy',
      role: UserRole.TEAM_ADMIN,
      status: UserStatus.active,
      sponsor: {
        id: 'sponsor-1',
        displayName: 'Freddy',
        isActive: true,
        status: 'active',
        availabilityStatus: 'available',
        memberPortalEnabled: true,
        phone: '+59179790873',
        avatarUrl: null,
        publicSlug: 'freddy',
        email: 'freddy@example.com',
      },
      lastLoginAt: null,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: new Date('2026-04-01T00:00:00.000Z'),
    } as any;
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue(memberRecord),
        update: jest.fn().mockResolvedValue({
          status: UserStatus.active,
        }),
      },
      sponsor: {
        update: jest.fn().mockResolvedValue({
          ...memberRecord.sponsor,
          isActive: false,
        }),
      },
    };

    (prisma.user.findFirst as jest.Mock).mockResolvedValue(memberRecord);

    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    jest
      .spyOn(service as any, 'lockTeamSeatCounter')
      .mockResolvedValue(undefined);
    jest.spyOn(service as any, 'requireTeam').mockResolvedValue({
      id: 'team-1',
      name: 'Team Uno',
      maxSeats: 3,
    });
    jest.spyOn(service as any, 'countActiveSeats').mockResolvedValue(0);

    await service.updateStatus(scope, memberRecord.id, {
      isActive: false,
    });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: {
        id: memberRecord.id,
      },
      data: {
        status: UserStatus.active,
      },
    });
    expect(walletEngineService.upsertSponsorAccount).toHaveBeenCalledWith(
      memberRecord.sponsor.id,
    );
  });

  it('hard deletes advisor users, their sponsor, and legacy permissions', async () => {
    const { prisma, service } = buildService();
    const scope = {
      workspaceId: 'workspace-1',
      teamId: 'team-1',
    };
    const memberRecord = {
      id: 'member-1',
      email: 'advisor@example.com',
      fullName: 'Advisor Uno',
      role: UserRole.MEMBER,
      status: UserStatus.disabled,
      sponsor: {
        id: 'sponsor-1',
      },
    } as any;
    const tx = {
      user: {
        findFirst: jest.fn().mockResolvedValue(memberRecord),
        delete: jest.fn().mockResolvedValue(memberRecord),
      },
      sponsor: {
        delete: jest.fn().mockResolvedValue(memberRecord.sponsor),
      },
      team: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      authSession: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const deleteLegacyServicePermissions = jest
      .spyOn(service as any, 'deleteLegacyServicePermissions')
      .mockResolvedValue(undefined);

    (prisma.$transaction as jest.Mock).mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    jest.spyOn(service as any, 'requireTeam').mockResolvedValue({
      id: 'team-1',
      name: 'Team Uno',
      maxSeats: 3,
    });
    jest.spyOn(service as any, 'countActiveSeats').mockResolvedValue(0);

    await expect(service.remove(scope, memberRecord.id)).resolves.toEqual({
      team: {
        teamId: 'team-1',
        teamName: 'Team Uno',
        maxSeats: 3,
        activeSeats: 0,
        availableSeats: 3,
      },
      deletedMemberId: memberRecord.id,
    });

    expect(deleteLegacyServicePermissions).toHaveBeenCalledWith(tx, {
      userId: memberRecord.id,
      sponsorId: memberRecord.sponsor.id,
    });
    expect(tx.authSession.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: memberRecord.id,
      },
    });
    expect(tx.user.delete).toHaveBeenCalledWith({
      where: {
        id: memberRecord.id,
      },
    });
    expect(tx.sponsor.delete).toHaveBeenCalledWith({
      where: {
        id: memberRecord.sponsor.id,
      },
    });
  });
});
