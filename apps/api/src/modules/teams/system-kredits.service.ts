import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletEngineService } from '../finance/wallet-engine.service';
import { sanitizeNullableText } from '../shared/url.utils';

type KreditDirectoryRow = {
  userId: string;
  userName: string;
  email: string;
  sponsorId: string;
  sponsorName: string;
  teamId: string;
  teamName: string;
  workspaceId: string;
  workspaceName: string;
  kreditBalance: string;
};

type KreditTarget =
  | {
      targetType: 'team';
      targetId: string;
      tenantId: string;
      teamId: string;
      teamName: string;
      sponsorId: null;
      sponsorName: null;
      workspaceId: string;
      workspaceName: string;
    }
  | {
      targetType: 'sponsor';
      targetId: string;
      tenantId: string;
      teamId: string;
      teamName: string;
      sponsorId: string;
      sponsorName: string;
      workspaceId: string;
      workspaceName: string;
    };

const sanitizeRequiredText = (value: string, field: string) => {
  const normalized = sanitizeNullableText(value);

  if (!normalized) {
    throw new BadRequestException({
      code: 'INVALID_KREDIT_INPUT',
      message: `${field} is required.`,
    });
  }

  return normalized;
};

const buildAdminReferenceId = (input: {
  adminUserId: string;
  targetType: 'team' | 'sponsor';
  targetId: string;
}) => {
  const safeAdminUserId = input.adminUserId.replace(/[^A-Za-z0-9_.:-]/g, '-');
  const safeTargetId = input.targetId.replace(/[^A-Za-z0-9_.:-]/g, '-');

  return [
    'admin-credit',
    safeAdminUserId,
    input.targetType,
    safeTargetId,
    Date.now().toString(36),
  ].join(':');
};

@Injectable()
export class SystemKreditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletEngineService: WalletEngineService,
  ) {}

  async listUserDirectory(): Promise<KreditDirectoryRow[]> {
    const users = await this.prisma.user.findMany({
      where: {
        sponsorId: {
          not: null,
        },
      },
      orderBy: [{ fullName: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        fullName: true,
        email: true,
        sponsor: {
          select: {
            id: true,
            displayName: true,
            team: {
              select: {
                id: true,
                name: true,
                workspace: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const rows = await Promise.all(
      users
        .filter((user) => user.sponsor?.team?.workspace)
        .map(async (user) => {
          const sponsor = user.sponsor!;
          const account = await this.walletEngineService.upsertSponsorAccount(
            sponsor.id,
          );
          const kreditBalance = await this.walletEngineService.getSponsorKredits(
            account.accountId,
          );

          return {
            userId: user.id,
            userName: user.fullName,
            email: user.email,
            sponsorId: sponsor.id,
            sponsorName: sponsor.displayName,
            teamId: sponsor.team.id,
            teamName: sponsor.team.name,
            workspaceId: sponsor.team.workspace.id,
            workspaceName: sponsor.team.workspace.name,
            kreditBalance,
          } satisfies KreditDirectoryRow;
        }),
    );

    return rows;
  }

  async injectCredits(input: {
    adminUserId: string;
    targetType: 'team' | 'sponsor';
    targetId: string;
    amountDecimal: string;
    reason?: string;
    note?: string;
  }) {
    const adminUserId = sanitizeRequiredText(input.adminUserId, 'adminUserId');
    const targetType =
      input.targetType === 'team' || input.targetType === 'sponsor'
        ? input.targetType
        : null;
    const targetId = sanitizeRequiredText(input.targetId, 'targetId');

    if (!targetType) {
      throw new BadRequestException({
        code: 'INVALID_KREDIT_TARGET',
        message: 'targetType must be team or sponsor.',
      });
    }

    const amountDecimal = this.walletEngineService.normalizeKreditAmount(
      sanitizeRequiredText(input.amountDecimal, 'amountDecimal'),
    );
    const reason = sanitizeNullableText(input.reason) ?? undefined;
    const note = sanitizeNullableText(input.note) ?? undefined;
    const target = await this.resolveTarget(targetType, targetId);
    const account = await this.walletEngineService.upsertAccount(target.tenantId);
    const referenceId = buildAdminReferenceId({
      adminUserId,
      targetType,
      targetId,
    });
    const result = await this.walletEngineService.creditKredits(
      account.accountId,
      amountDecimal,
      {
        featureKey: 'leadflow.admin.manual_credit',
        referenceType: 'admin_credit',
        referenceId,
        reason,
        meta: {
          adminUserId,
          targetType,
          targetId,
          workspaceId: target.workspaceId,
          workspaceName: target.workspaceName,
          teamId: target.teamId,
          teamName: target.teamName,
          sponsorId: target.sponsorId,
          sponsorName: target.sponsorName,
          note,
        },
      },
    );

    return {
      target,
      accountId: account.accountId,
      requestedAmount: amountDecimal,
      referenceId,
      balance: result.balance,
      ledgerEntry: result.ledger_entry,
    };
  }

  private async resolveTarget(
    targetType: 'team' | 'sponsor',
    targetId: string,
  ): Promise<KreditTarget> {
    if (targetType === 'team') {
      const team = await this.prisma.team.findUnique({
        where: {
          id: targetId,
        },
        select: {
          id: true,
          name: true,
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!team) {
        throw new NotFoundException({
          code: 'TEAM_NOT_FOUND',
          message: 'The requested team was not found.',
        });
      }

      return {
        targetType,
        targetId: team.id,
        tenantId: team.id,
        teamId: team.id,
        teamName: team.name,
        sponsorId: null,
        sponsorName: null,
        workspaceId: team.workspace.id,
        workspaceName: team.workspace.name,
      };
    }

    const sponsor = await this.prisma.sponsor.findUnique({
      where: {
        id: targetId,
      },
      select: {
        id: true,
        displayName: true,
        team: {
          select: {
            id: true,
            name: true,
            workspace: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!sponsor) {
      throw new NotFoundException({
        code: 'SPONSOR_NOT_FOUND',
        message: 'The requested sponsor was not found.',
      });
    }

    return {
      targetType,
      targetId: sponsor.id,
      tenantId: sponsor.id,
      teamId: sponsor.team.id,
      teamName: sponsor.team.name,
      sponsorId: sponsor.id,
      sponsorName: sponsor.displayName,
      workspaceId: sponsor.team.workspace.id,
      workspaceName: sponsor.team.workspace.name,
    };
  }
}
