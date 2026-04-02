import { NotFoundException } from '@nestjs/common';
import type { FunnelRecord } from '../../prisma/prisma.mappers';
import type { PrismaService } from '../../prisma/prisma.service';
import { FunnelsService } from './funnels.service';

type TeamFindUniqueArgs = Parameters<PrismaService['team']['findUnique']>[0];
type FunnelFindFirstArgs = Parameters<PrismaService['funnel']['findFirst']>[0];
type FunnelCreateArgs = Parameters<PrismaService['funnel']['create']>[0];
type TransactionCallback = Parameters<PrismaService['$transaction']>[0];

type PrismaMock = {
  $transaction: jest.Mock<
    ReturnType<PrismaService['$transaction']>,
    [TransactionCallback]
  >;
  team: {
    findUnique: jest.Mock<
      Promise<{ id: string; workspaceId: string } | null>,
      [TeamFindUniqueArgs]
    >;
  };
  funnel: {
    findFirst: jest.Mock<
      Promise<FunnelRecord | { id: string } | null>,
      [FunnelFindFirstArgs]
    >;
    create: jest.Mock<Promise<FunnelRecord>, [FunnelCreateArgs]>;
  };
};

const buildFunnelRecord = (
  overrides: Partial<FunnelRecord> = {},
): FunnelRecord => {
  const now = new Date('2026-04-02T00:30:00.000Z');

  return {
    id: 'funnel-template-1',
    workspaceId: 'workspace-template',
    name: 'Base Funnel',
    description: null,
    code: 'base-funnel',
    thumbnailUrl: 'https://cdn.kurukin.com/funnels/base.png',
    status: 'active',
    isTemplate: true,
    stages: ['captured', 'qualified', 'assigned'],
    entrySources: ['manual', 'form', 'landing_page'],
    defaultTeamId: null,
    defaultRotationPoolId: 'pool-template-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

describe('FunnelsService', () => {
  const createService = () => {
    const teamFindUnique = jest.fn<
      Promise<{ id: string; workspaceId: string } | null>,
      [TeamFindUniqueArgs]
    >();
    const funnelFindFirst = jest.fn<
      Promise<FunnelRecord | { id: string } | null>,
      [FunnelFindFirstArgs]
    >();
    const funnelCreate = jest.fn<Promise<FunnelRecord>, [FunnelCreateArgs]>();
    const transaction = jest.fn<
      ReturnType<PrismaService['$transaction']>,
      [TransactionCallback]
    >(async (callback) => {
      const tx = {
        funnel: {
          findFirst: funnelFindFirst,
          create: funnelCreate,
        },
      };

      return callback(tx as never);
    });

    const prisma: PrismaMock = {
      $transaction: transaction,
      team: {
        findUnique: teamFindUnique,
      },
      funnel: {
        findFirst: funnelFindFirst,
        create: funnelCreate,
      },
    };

    return {
      service: new FunnelsService(prisma as unknown as PrismaService),
      teamFindUnique,
      funnelFindFirst,
      funnelCreate,
      transaction,
    };
  };

  it('rejects cloning when the source funnel is not a valid template', async () => {
    const { service, teamFindUnique, funnelFindFirst, transaction } =
      createService();

    teamFindUnique.mockResolvedValue({
      id: 'team-1',
      workspaceId: 'workspace-1',
    });
    funnelFindFirst.mockResolvedValue(null);

    await expect(
      service.cloneTemplateToTeam('funnel-1', 'team-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(funnelFindFirst).toHaveBeenCalledWith({
      where: {
        id: 'funnel-1',
        isTemplate: true,
      },
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('clones a valid template into the target team as a non-template funnel', async () => {
    const { service, teamFindUnique, funnelFindFirst, funnelCreate } =
      createService();
    const template = buildFunnelRecord();
    const clonedRecord = buildFunnelRecord({
      id: 'funnel-clone-1',
      workspaceId: 'workspace-team-1',
      name: 'Funnel Equipo Norte',
      code: 'base-funnel-copy',
      isTemplate: false,
      defaultTeamId: 'team-1',
      defaultRotationPoolId: null,
    });

    teamFindUnique.mockResolvedValue({
      id: 'team-1',
      workspaceId: 'workspace-team-1',
    });
    funnelFindFirst.mockResolvedValueOnce(template).mockResolvedValueOnce(null);
    funnelCreate.mockResolvedValue(clonedRecord);

    const result = await service.cloneTemplateToTeam(
      'funnel-template-1',
      'team-1',
      'Funnel Equipo Norte',
    );

    expect(funnelCreate).toHaveBeenCalledWith({
      data: {
        workspaceId: 'workspace-team-1',
        name: 'Funnel Equipo Norte',
        description: null,
        code: 'base-funnel-copy',
        thumbnailUrl: 'https://cdn.kurukin.com/funnels/base.png',
        status: 'active',
        isTemplate: false,
        stages: ['captured', 'qualified', 'assigned'],
        entrySources: ['manual', 'form', 'landing_page'],
        defaultTeamId: 'team-1',
        defaultRotationPoolId: null,
      },
    });
    expect(result.id).toBe('funnel-clone-1');
    expect(result.defaultTeamId).toBe('team-1');
    expect(result.isTemplate).toBe(false);
  });
});
