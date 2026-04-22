import { UserRole, UserStatus } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { WalletEngineService } from '../finance/wallet-engine.service';
import { MailerService } from '../shared/mailer.service';
import { TeamMembersService } from './team-members.service';

describe('TeamMembersService', () => {
  const buildService = () => {
    const prisma = {
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const walletEngineService = {} as WalletEngineService;
    const mailerService = {} as MailerService;

    return {
      prisma,
      service: new TeamMembersService(
        prisma,
        walletEngineService,
        mailerService,
      ),
    };
  };

  it('keeps team admin logins active when their seat is disabled', async () => {
    const { prisma, service } = buildService();
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
  });
});
