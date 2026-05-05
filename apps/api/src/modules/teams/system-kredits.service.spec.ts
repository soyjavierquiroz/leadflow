import { SystemKreditsService } from './system-kredits.service';

describe('SystemKreditsService', () => {
  const buildService = () => {
    const prisma = {
      user: {
        findMany: jest.fn(),
      },
      team: {
        findUnique: jest.fn(),
      },
      sponsor: {
        findUnique: jest.fn(),
      },
    };
    const walletEngineService = {
      normalizeKreditAmount: jest.fn(),
      upsertAccount: jest.fn(),
      upsertSponsorAccount: jest.fn(),
      getSponsorKredits: jest.fn(),
      creditKredits: jest.fn(),
    };

    return {
      prisma,
      walletEngineService,
      service: new SystemKreditsService(
        prisma as never,
        walletEngineService as never,
      ),
    };
  };

  it('builds the user directory from user -> sponsor -> team -> workspace', async () => {
    const { prisma, walletEngineService, service } = buildService();

    prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        fullName: 'Laura Admin',
        email: 'laura@example.com',
        sponsor: {
          id: 'sponsor-1',
          displayName: 'Laura Sponsor',
          team: {
            id: 'team-1',
            name: 'Agency One',
            workspace: {
              id: 'workspace-1',
              name: 'Workspace One',
            },
          },
        },
      },
    ]);
    walletEngineService.upsertSponsorAccount.mockResolvedValue({
      accountId: 'wallet-1',
    });
    walletEngineService.getSponsorKredits.mockResolvedValue('12.500000');

    await expect(service.listUserDirectory()).resolves.toEqual([
      {
        userId: 'user-1',
        userName: 'Laura Admin',
        email: 'laura@example.com',
        sponsorId: 'sponsor-1',
        sponsorName: 'Laura Sponsor',
        teamId: 'team-1',
        teamName: 'Agency One',
        workspaceId: 'workspace-1',
        workspaceName: 'Workspace One',
        kreditBalance: '12.500000',
      },
    ]);
  });

  it('credits sponsor KREDIT accounts with an auditable admin reference', async () => {
    const { prisma, walletEngineService, service } = buildService();

    prisma.sponsor.findUnique.mockResolvedValue({
      id: 'sponsor-1',
      displayName: 'Laura Sponsor',
      team: {
        id: 'team-1',
        name: 'Agency One',
        workspace: {
          id: 'workspace-1',
          name: 'Workspace One',
        },
      },
    });
    walletEngineService.normalizeKreditAmount.mockReturnValue('3.500000');
    walletEngineService.upsertAccount.mockResolvedValue({
      accountId: 'wallet-1',
    });
    walletEngineService.creditKredits.mockResolvedValue({
      balance: {
        account_id: 'wallet-1',
        unit_code: 'KREDIT',
        unit_scale: 6,
        balance: '8.500000',
        held_amount: '0.000000',
        available_balance: '8.500000',
        updated_at: '2026-05-05T00:00:00.000Z',
      },
      ledger_entry: {
        id: 'ledger-1',
        account_id: 'wallet-1',
        movement_type: 'credit',
        amount: '3.500000',
        balance_after: '8.500000',
        unit_code: 'KREDIT',
        unit_scale: 6,
        meta_json: {},
        created_at: '2026-05-05T00:00:00.000Z',
      },
    });

    const result = await service.injectCredits({
      adminUserId: 'admin-1',
      targetType: 'sponsor',
      targetId: 'sponsor-1',
      amountDecimal: '3.5',
      reason: 'manual top-up',
      note: 'support case',
    });

    expect(walletEngineService.creditKredits).toHaveBeenCalledWith(
      'wallet-1',
      '3.500000',
      expect.objectContaining({
        featureKey: 'leadflow.admin.manual_credit',
        referenceType: 'admin_credit',
        reason: 'manual top-up',
        meta: expect.objectContaining({
          adminUserId: 'admin-1',
          targetType: 'sponsor',
          targetId: 'sponsor-1',
          teamId: 'team-1',
          sponsorId: 'sponsor-1',
          note: 'support case',
        }),
      }),
    );
    expect(result.referenceId).toContain('admin-credit:admin-1:sponsor:sponsor-1:');
  });
});
