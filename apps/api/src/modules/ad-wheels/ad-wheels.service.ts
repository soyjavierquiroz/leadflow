import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  readWalletEngineException,
  WalletEngineService,
} from '../finance/wallet-engine.service';
import type { CreateTeamAdWheelDto } from './dto/create-team-ad-wheel.dto';

type TeamScope = {
  workspaceId: string;
  teamId: string;
};

type SponsorScope = TeamScope & {
  sponsorId: string;
};

type AdWheelRecord = {
  id: string;
  teamId: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
  name: string;
  seatPrice: number;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
};

type TeamAdWheelRecord = AdWheelRecord & {
  participantCount: number;
};

type SponsorActiveAdWheelResult = {
  wheel: AdWheelRecord | null;
  isParticipating: boolean;
};

type AdWheelJoinResult = {
  wheel: AdWheelRecord;
  participant: {
    adWheelId: string;
    sponsorId: string;
    joinedAt: string;
  };
  wallet: {
    accountId: string;
    debitedAmount: string;
    unitCode: string;
    unitScale: number;
    balanceAfter: string;
    availableBalance: string;
  } | null;
  alreadyJoined: boolean;
};

const sanitizeRequiredText = (
  value: string | null | undefined,
  field: string,
) => {
  if (typeof value !== 'string') {
    throw new BadRequestException({
      code: 'FIELD_REQUIRED',
      message: `${field} is required.`,
      field,
    });
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new BadRequestException({
      code: 'FIELD_REQUIRED',
      message: `${field} is required.`,
      field,
    });
  }

  return trimmed;
};

const requirePositiveInteger = (
  value: number,
  field: string,
  minimum = 1,
) => {
  if (!Number.isInteger(value) || value < minimum) {
    throw new BadRequestException({
      code: `INVALID_${field.toUpperCase()}`,
      message: `${field} must be an integer greater than or equal to ${minimum}.`,
      field,
    });
  }

  return value;
};

const mapAdWheelRecord = (
  record: Prisma.AdWheelGetPayload<Record<string, never>>,
): AdWheelRecord => ({
  id: record.id,
  teamId: record.teamId,
  status: record.status,
  name: record.name,
  seatPrice: record.seatPrice,
  startDate: record.startDate.toISOString(),
  endDate: record.endDate.toISOString(),
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

@Injectable()
export class AdWheelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletEngineService: WalletEngineService,
  ) {}

  async createForTeam(
    scope: TeamScope,
    dto: CreateTeamAdWheelDto,
  ): Promise<AdWheelRecord> {
    await this.requireTeam(scope);

    const name = sanitizeRequiredText(dto.name, 'name');
    const durationDays = requirePositiveInteger(dto.durationDays, 'durationDays');
    const startDate = new Date();
    const endDate = new Date(startDate);

    endDate.setUTCDate(endDate.getUTCDate() + durationDays);

    if (!Number.isInteger(dto.seatPrice) || dto.seatPrice <= 0) {
      throw new BadRequestException({
        code: 'INVALID_SEAT_PRICE',
        message:
          'seatPrice must be provided as a positive integer minor-unit amount.',
        field: 'seatPrice',
      });
    }

    if (dto.status !== 'DRAFT' && dto.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: 'INVALID_AD_WHEEL_STATUS',
        message: 'status must be either DRAFT or ACTIVE when creating a wheel.',
        field: 'status',
      });
    }

    if (dto.status === 'ACTIVE') {
      const existingActiveWheel = await this.prisma.adWheel.findFirst({
        where: {
          teamId: scope.teamId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
        },
      });

      if (existingActiveWheel) {
        throw new ConflictException({
          code: 'ACTIVE_AD_WHEEL_ALREADY_EXISTS',
          message:
            'This team already has an active ad wheel. Complete it before activating another one.',
        });
      }
    }

    const record = await this.prisma.adWheel.create({
      data: {
        teamId: scope.teamId,
        status: dto.status,
        name,
        seatPrice: dto.seatPrice,
        startDate,
        endDate,
      },
    });

    return mapAdWheelRecord(record);
  }

  async listForTeam(scope: TeamScope): Promise<TeamAdWheelRecord[]> {
    await this.requireTeam(scope);

    const records = await this.prisma.adWheel.findMany({
      where: {
        teamId: scope.teamId,
      },
      include: {
        _count: {
          select: {
            participants: true,
          },
        },
      },
    });

    const statusOrder = {
      ACTIVE: 0,
      DRAFT: 1,
      COMPLETED: 2,
    } satisfies Record<AdWheelRecord['status'], number>;

    return records
      .sort((left, right) => {
        const statusDelta =
          statusOrder[left.status] - statusOrder[right.status];

        if (statusDelta !== 0) {
          return statusDelta;
        }

        return right.createdAt.getTime() - left.createdAt.getTime();
      })
      .map((record) => ({
        ...mapAdWheelRecord(record),
        participantCount: record._count.participants,
      }));
  }

  async getActiveForSponsor(
    scope: SponsorScope,
  ): Promise<SponsorActiveAdWheelResult> {
    await this.requireActiveSponsor(scope);

    const wheel = await this.prisma.adWheel.findFirst({
      where: {
        teamId: scope.teamId,
        status: 'ACTIVE',
      },
      include: {
        participants: {
          where: {
            sponsorId: scope.sponsorId,
          },
          select: {
            sponsorId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!wheel) {
      return {
        wheel: null,
        isParticipating: false,
      };
    }

    return {
      wheel: mapAdWheelRecord(wheel),
      isParticipating: wheel.participants.length > 0,
    };
  }

  async joinForSponsor(
    scope: SponsorScope,
    wheelId: string,
  ): Promise<AdWheelJoinResult> {
    const normalizedWheelId = sanitizeRequiredText(wheelId, 'wheelId');
    await this.requireActiveSponsor(scope);

    const wheel = await this.prisma.adWheel.findFirst({
      where: {
        id: normalizedWheelId,
        teamId: scope.teamId,
      },
      include: {
        participants: {
          where: {
            sponsorId: scope.sponsorId,
          },
          select: {
            adWheelId: true,
            sponsorId: true,
            joinedAt: true,
          },
        },
      },
    });

    if (!wheel) {
      throw new NotFoundException({
        code: 'AD_WHEEL_NOT_FOUND',
        message: 'The requested ad wheel was not found for this team.',
      });
    }

    if (wheel.status !== 'ACTIVE') {
      throw new ConflictException({
        code: 'AD_WHEEL_NOT_ACTIVE',
        message: 'Only active ad wheels can accept sponsor buy-ins.',
      });
    }

    const existingParticipant = wheel.participants[0];

    if (existingParticipant) {
      return {
        wheel: mapAdWheelRecord(wheel),
        participant: {
          adWheelId: existingParticipant.adWheelId,
          sponsorId: existingParticipant.sponsorId,
          joinedAt: existingParticipant.joinedAt.toISOString(),
        },
        wallet: null,
        alreadyJoined: true,
      };
    }

    const account = await this.walletEngineService.upsertTeamAccount(
      scope.teamId,
    );
    const debitedAmount = this.walletEngineService.formatMinorUnits(
      wheel.seatPrice,
    );
    const idempotencyKey = `join_${wheel.id}_${scope.sponsorId}`;

    let debitResult;

    try {
      debitResult = await this.walletEngineService.debitSeat(
        account.id,
        debitedAmount,
        idempotencyKey,
        {
          idempotencyKey,
        },
      );
    } catch (error) {
      const walletError = readWalletEngineException(error);

      if (walletError.upstreamStatus === HttpStatus.PAYMENT_REQUIRED) {
        throw new HttpException(
          {
            code: 'AD_WHEEL_BUY_IN_PAYMENT_REQUIRED',
            message:
              'The wheel buy-in could not be completed because the available wallet balance is insufficient.',
            cause: walletError.message,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }

      throw error;
    }

    try {
      const participant = await this.prisma.adWheelParticipant.create({
        data: {
          adWheelId: wheel.id,
          sponsorId: scope.sponsorId,
        },
      });

      return {
        wheel: mapAdWheelRecord(wheel),
        participant: {
          adWheelId: participant.adWheelId,
          sponsorId: participant.sponsorId,
          joinedAt: participant.joinedAt.toISOString(),
        },
        wallet: {
          accountId: account.id,
          debitedAmount,
          unitCode: debitResult.balance.unit_code,
          unitScale: debitResult.balance.unit_scale,
          balanceAfter: debitResult.ledger_entry.balance_after,
          availableBalance: debitResult.balance.available_balance,
        },
        alreadyJoined: false,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const participant = await this.prisma.adWheelParticipant.findUnique({
          where: {
            adWheelId_sponsorId: {
              adWheelId: wheel.id,
              sponsorId: scope.sponsorId,
            },
          },
        });

        if (participant) {
          return {
            wheel: mapAdWheelRecord(wheel),
            participant: {
              adWheelId: participant.adWheelId,
              sponsorId: participant.sponsorId,
              joinedAt: participant.joinedAt.toISOString(),
            },
            wallet: {
              accountId: account.id,
              debitedAmount,
              unitCode: debitResult.balance.unit_code,
              unitScale: debitResult.balance.unit_scale,
              balanceAfter: debitResult.ledger_entry.balance_after,
              availableBalance: debitResult.balance.available_balance,
            },
            alreadyJoined: true,
          };
        }
      }

      throw error;
    }
  }

  private async requireTeam(scope: TeamScope) {
    const team = await this.prisma.team.findFirst({
      where: {
        id: scope.teamId,
        workspaceId: scope.workspaceId,
      },
      select: {
        id: true,
      },
    });

    if (!team) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: 'The requested team was not found for the current workspace.',
      });
    }

    return team;
  }

  private async requireActiveSponsor(scope: SponsorScope) {
    const sponsor = await this.prisma.sponsor.findFirst({
      where: {
        id: scope.sponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        status: 'active',
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!sponsor) {
      throw new NotFoundException({
        code: 'SPONSOR_NOT_FOUND',
        message: 'The current sponsor is not active for this team.',
      });
    }

    return sponsor;
  }
}
