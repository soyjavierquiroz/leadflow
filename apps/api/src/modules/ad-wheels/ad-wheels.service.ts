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
import { AdWheelSequenceGeneratorService } from './ad-wheel-sequence-generator.service';
import type { CreateTeamAdWheelDto } from './dto/create-team-ad-wheel.dto';
import type { UpdateTeamAdWheelDto } from './dto/update-team-ad-wheel.dto';
import type { UpsertTeamAdWheelParticipantDto } from './dto/upsert-team-ad-wheel-participant.dto';

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
  publicationId: string | null;
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
  totalSeatCount: number;
  publication: {
    id: string;
    pathPrefix: string;
    domainHost: string;
    funnelName: string;
    funnelCode: string;
  } | null;
  participants: Array<{
    sponsorId: string;
    sponsorName: string;
    sponsorStatus: string;
    sponsorAvailabilityStatus: string;
    seatCount: number;
    joinedAt: string;
  }>;
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

type TeamAdWheelParticipantResult = {
  wheel: TeamAdWheelRecord;
  participant: TeamAdWheelRecord['participants'][number];
};

const DAY_IN_MS = 1000 * 60 * 60 * 24;

const teamAdWheelInclude = {
  publication: {
    select: {
      id: true,
      pathPrefix: true,
      domain: {
        select: {
          host: true,
        },
      },
      funnelInstance: {
        select: {
          name: true,
          code: true,
        },
      },
    },
  },
  participants: {
    select: {
      sponsorId: true,
      seatCount: true,
      joinedAt: true,
      sponsor: {
        select: {
          displayName: true,
          status: true,
          availabilityStatus: true,
        },
      },
    },
    orderBy: [{ joinedAt: 'asc' }, { sponsorId: 'asc' }],
  },
  _count: {
    select: {
      participants: true,
    },
  },
} satisfies Prisma.AdWheelInclude;

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

const requireIntegerAtLeast = (
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

const parseRequiredDate = (
  value: string | null | undefined,
  field: string,
): Date => {
  const normalized = sanitizeRequiredText(value, field);
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException({
      code: 'INVALID_DATE',
      message: `${field} must be a valid ISO-8601 date.`,
      field,
    });
  }

  return parsed;
};

const calculateEndDate = (startDate: Date, durationDays: number) => {
  const endDate = new Date(startDate);

  endDate.setUTCDate(endDate.getUTCDate() + durationDays);

  return endDate;
};

const calculateDurationDays = (startDate: Date, endDate: Date) =>
  Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / DAY_IN_MS));

const mapAdWheelRecord = (
  record: Pick<
    Prisma.AdWheelGetPayload<Record<string, never>>,
    | 'id'
    | 'teamId'
    | 'publicationId'
    | 'status'
    | 'name'
    | 'seatPrice'
    | 'startDate'
    | 'endDate'
    | 'createdAt'
    | 'updatedAt'
  >,
): AdWheelRecord => ({
  id: record.id,
  teamId: record.teamId,
  publicationId: record.publicationId,
  status: record.status,
  name: record.name,
  seatPrice: record.seatPrice,
  startDate: record.startDate.toISOString(),
  endDate: record.endDate.toISOString(),
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

const mapTeamAdWheelRecord = (
  record: Pick<
    Prisma.AdWheelGetPayload<Record<string, never>>,
    | 'id'
    | 'teamId'
    | 'publicationId'
    | 'status'
    | 'name'
    | 'seatPrice'
    | 'startDate'
    | 'endDate'
    | 'createdAt'
    | 'updatedAt'
  > & {
    publication: {
      id: string;
      pathPrefix: string;
      domain: {
        host: string;
      };
      funnelInstance: {
        name: string;
        code: string;
      };
    } | null;
    participants: Array<{
      sponsorId: string;
      seatCount: number;
      joinedAt: Date;
      sponsor: {
        displayName: string;
        status: string;
        availabilityStatus: string;
      };
    }>;
    _count: {
      participants: number;
    };
  },
): TeamAdWheelRecord => {
  const participants = record.participants.map((participant) => ({
    sponsorId: participant.sponsorId,
    sponsorName: participant.sponsor.displayName,
    sponsorStatus: participant.sponsor.status,
    sponsorAvailabilityStatus: participant.sponsor.availabilityStatus,
    seatCount: participant.seatCount,
    joinedAt: participant.joinedAt.toISOString(),
  }));

  return {
    ...mapAdWheelRecord(record),
    participantCount: record._count.participants,
    totalSeatCount: participants.reduce(
      (total, participant) => total + participant.seatCount,
      0,
    ),
    publication: record.publication
      ? {
          id: record.publication.id,
          pathPrefix: record.publication.pathPrefix,
          domainHost: record.publication.domain.host,
          funnelName: record.publication.funnelInstance.name,
          funnelCode: record.publication.funnelInstance.code,
        }
      : null,
    participants,
  };
};

@Injectable()
export class AdWheelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletEngineService: WalletEngineService,
    private readonly adWheelSequenceGeneratorService: AdWheelSequenceGeneratorService,
  ) {}

  async createForTeam(
    scope: TeamScope,
    dto: CreateTeamAdWheelDto,
  ): Promise<AdWheelRecord> {
    await this.requireTeam(scope);

    const name = sanitizeRequiredText(dto.name, 'name');
    const startDate = parseRequiredDate(dto.startDate, 'startDate');
    const durationDays = requireIntegerAtLeast(dto.durationDays, 'durationDays');
    const endDate = calculateEndDate(startDate, durationDays);

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

    const publication = await this.requirePublicationForTeam(
      scope,
      dto.publicationId,
    );

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
        publicationId: publication.id,
        status: dto.status,
        name,
        seatPrice: dto.seatPrice,
        startDate,
        endDate,
      },
    });

    return mapAdWheelRecord(record);
  }

  async updateForTeam(
    scope: TeamScope,
    wheelId: string,
    dto: UpdateTeamAdWheelDto,
  ): Promise<AdWheelRecord> {
    await this.requireTeam(scope);

    const normalizedWheelId = sanitizeRequiredText(wheelId, 'wheelId');
    const wheel = await this.prisma.adWheel.findFirst({
      where: {
        id: normalizedWheelId,
        teamId: scope.teamId,
      },
      select: {
        id: true,
        teamId: true,
        publicationId: true,
        status: true,
        name: true,
        seatPrice: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!wheel) {
      throw new NotFoundException({
        code: 'AD_WHEEL_NOT_FOUND',
        message: 'The requested ad wheel was not found for this team.',
      });
    }

    const currentDurationDays = calculateDurationDays(
      wheel.startDate,
      wheel.endDate,
    );
    const nextPublicationId =
      dto.publicationId === undefined
        ? wheel.publicationId
        : (await this.requirePublicationForTeam(scope, dto.publicationId)).id;
    const nextName =
      dto.name === undefined ? wheel.name : sanitizeRequiredText(dto.name, 'name');
    const nextSeatPrice =
      dto.seatPrice === undefined
        ? wheel.seatPrice
        : requireIntegerAtLeast(dto.seatPrice, 'seatPrice');
    const nextStartDate =
      dto.startDate === undefined
        ? wheel.startDate
        : parseRequiredDate(dto.startDate, 'startDate');
    const nextDurationDays =
      dto.durationDays === undefined
        ? currentDurationDays
        : requireIntegerAtLeast(dto.durationDays, 'durationDays');
    const nextEndDate = calculateEndDate(nextStartDate, nextDurationDays);
    const scheduleIsEditable =
      wheel.status === 'DRAFT' || Date.now() < wheel.startDate.getTime();
    const scheduleChanged =
      nextSeatPrice !== wheel.seatPrice ||
      nextStartDate.getTime() !== wheel.startDate.getTime() ||
      nextDurationDays !== currentDurationDays;

    if (!scheduleIsEditable && scheduleChanged) {
      throw new ConflictException({
        code: 'AD_WHEEL_SCHEDULE_LOCKED',
        message:
          'Seat price and wheel timing can only be edited while the wheel is in draft or before the start date.',
      });
    }

    const record = await this.prisma.adWheel.update({
      where: {
        id: wheel.id,
      },
      data: {
        ...(dto.publicationId !== undefined
          ? { publicationId: nextPublicationId }
          : {}),
        name: nextName,
        seatPrice: nextSeatPrice,
        startDate: nextStartDate,
        endDate: nextEndDate,
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
      include: teamAdWheelInclude,
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
      .map(mapTeamAdWheelRecord);
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
      const participant = await this.prisma.$transaction(async (tx) => {
        const createdParticipant = await tx.adWheelParticipant.create({
          data: {
            adWheelId: wheel.id,
            sponsorId: scope.sponsorId,
          },
        });
        await tx.adWheel.update({
          where: {
            id: wheel.id,
          },
          data: {
            currentTurnPosition: 1,
            sequenceVersion: {
              increment: 1,
            },
          },
          select: {
            id: true,
          },
        });
        await this.adWheelSequenceGeneratorService.replaceSequenceInTransaction(
          tx,
          wheel.id,
        );

        return createdParticipant;
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

  async upsertParticipantForTeam(
    scope: TeamScope,
    wheelId: string,
    dto: UpsertTeamAdWheelParticipantDto,
  ): Promise<TeamAdWheelParticipantResult> {
    await this.requireTeam(scope);

    const normalizedWheelId = sanitizeRequiredText(wheelId, 'wheelId');
    const sponsorId = sanitizeRequiredText(dto.sponsorId, 'sponsorId');
    const seatCount = requireIntegerAtLeast(dto.seatCount, 'seatCount', 0);

    const wheel = await this.prisma.adWheel.findFirst({
      where: {
        id: normalizedWheelId,
        teamId: scope.teamId,
      },
      select: {
        id: true,
      },
    });

    if (!wheel) {
      throw new NotFoundException({
        code: 'AD_WHEEL_NOT_FOUND',
        message: 'The requested ad wheel was not found for this team.',
      });
    }

    const sponsor = await this.prisma.sponsor.findFirst({
      where: {
        id: sponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        isActive: true,
        status: 'active',
        availabilityStatus: 'available',
      },
      select: {
        id: true,
      },
    });

    if (!sponsor) {
      throw new NotFoundException({
        code: 'SPONSOR_NOT_FOUND',
        message:
          'The selected sponsor is not active or does not belong to this team.',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.adWheelParticipant.upsert({
        where: {
          adWheelId_sponsorId: {
            adWheelId: wheel.id,
            sponsorId,
          },
        },
        create: {
          adWheelId: wheel.id,
          sponsorId,
          seatCount,
        },
        update: {
          seatCount,
        },
      });
      await tx.adWheel.update({
        where: {
          id: wheel.id,
        },
        data: {
          currentTurnPosition: 1,
          sequenceVersion: {
            increment: 1,
          },
        },
        select: {
          id: true,
        },
      });
      await this.adWheelSequenceGeneratorService.replaceSequenceInTransaction(
        tx,
        wheel.id,
      );
    });

    const updatedWheel = await this.prisma.adWheel.findUnique({
      where: {
        id: wheel.id,
      },
      include: teamAdWheelInclude,
    });

    if (!updatedWheel) {
      throw new NotFoundException({
        code: 'AD_WHEEL_NOT_FOUND',
        message: 'The requested ad wheel was not found for this team.',
      });
    }

    const mappedWheel = mapTeamAdWheelRecord(updatedWheel);
    const participant = mappedWheel.participants.find(
      (item) => item.sponsorId === sponsorId,
    );

    if (!participant) {
      throw new NotFoundException({
        code: 'AD_WHEEL_PARTICIPANT_NOT_FOUND',
        message: 'The wheel participant could not be resolved after update.',
      });
    }

    return {
      wheel: mappedWheel,
      participant,
    };
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

  private async requirePublicationForTeam(scope: TeamScope, publicationId: string) {
    const normalizedPublicationId = sanitizeRequiredText(
      publicationId,
      'publicationId',
    );
    const publication = await this.prisma.funnelPublication.findFirst({
      where: {
        id: normalizedPublicationId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        status: 'active',
        isActive: true,
        domain: {
          status: 'active',
        },
        funnelInstance: {
          status: 'active',
        },
      },
      select: {
        id: true,
      },
    });

    if (!publication) {
      throw new NotFoundException({
        code: 'FUNNEL_PUBLICATION_NOT_FOUND',
        message:
          'The selected funnel publication is not active or does not belong to this team.',
      });
    }

    return publication;
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
