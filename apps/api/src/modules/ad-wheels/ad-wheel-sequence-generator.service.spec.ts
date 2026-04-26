import type { PrismaService } from '../../prisma/prisma.service';
import { AdWheelSequenceGeneratorService } from './ad-wheel-sequence-generator.service';

type ParticipantFindManyArgs = Parameters<
  PrismaService['adWheelParticipant']['findMany']
>[0];
type TurnDeleteManyArgs = Parameters<
  PrismaService['adWheelTurn']['deleteMany']
>[0];
type TurnFindFirstArgs = Parameters<
  PrismaService['adWheelTurn']['findFirst']
>[0];
type TurnCreateManyArgs = Parameters<
  PrismaService['adWheelTurn']['createMany']
>[0];
type TransactionCallback = Parameters<PrismaService['$transaction']>[0];

type ParticipantRecord = {
  sponsorId: string;
  seatCount: number;
  joinedAt: Date;
};

type TxMock = {
  adWheelParticipant: {
    findMany: jest.Mock<Promise<ParticipantRecord[]>, [ParticipantFindManyArgs]>;
  };
  adWheelTurn: {
    deleteMany: jest.Mock<Promise<{ count: number }>, [TurnDeleteManyArgs]>;
    findFirst: jest.Mock<
      Promise<{ position: number } | null>,
      [TurnFindFirstArgs]
    >;
    createMany: jest.Mock<Promise<{ count: number }>, [TurnCreateManyArgs]>;
  };
};

type PrismaMock = {
  $transaction: jest.Mock<
    ReturnType<PrismaService['$transaction']>,
    [TransactionCallback]
  >;
};

describe('AdWheelSequenceGeneratorService', () => {
  const buildService = () => {
    const tx: TxMock = {
      adWheelParticipant: {
        findMany: jest.fn(),
      },
      adWheelTurn: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const transaction = jest.fn<
      ReturnType<PrismaService['$transaction']>,
      [TransactionCallback]
    >(async (callback) => callback(tx as never));
    const prisma: PrismaMock = {
      $transaction: transaction,
    };

    return {
      prisma,
      tx,
      transaction,
      service: new AdWheelSequenceGeneratorService(
        prisma as unknown as PrismaService,
      ),
    };
  };

  it('generates smooth weighted turns inside a transaction', async () => {
    const { transaction, tx, service } = buildService();

    tx.adWheelParticipant.findMany.mockResolvedValue([
      {
        sponsorId: 'sponsor-a',
        seatCount: 3,
        joinedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        sponsorId: 'sponsor-b',
        seatCount: 1,
        joinedAt: new Date('2026-04-02T00:00:00.000Z'),
      },
    ]);
    tx.adWheelTurn.findFirst.mockResolvedValue(null);

    const result = await service.generateSequence('wheel-1');

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.adWheelParticipant.findMany).toHaveBeenCalledWith({
      where: {
        adWheelId: 'wheel-1',
        seatCount: {
          gt: 0,
        },
      },
      select: {
        sponsorId: true,
        seatCount: true,
        joinedAt: true,
      },
      orderBy: [{ joinedAt: 'asc' }, { sponsorId: 'asc' }],
    });
    expect(tx.adWheelTurn.deleteMany).toHaveBeenCalledWith({
      where: {
        adWheelId: 'wheel-1',
        isConsumed: false,
      },
    });
    expect(tx.adWheelTurn.createMany).toHaveBeenCalledWith({
      data: [
        { adWheelId: 'wheel-1', sponsorId: 'sponsor-a', position: 1 },
        { adWheelId: 'wheel-1', sponsorId: 'sponsor-b', position: 2 },
        { adWheelId: 'wheel-1', sponsorId: 'sponsor-a', position: 3 },
        { adWheelId: 'wheel-1', sponsorId: 'sponsor-a', position: 4 },
      ],
    });
    expect(result.map((turn) => turn.sponsorId)).toEqual([
      'sponsor-a',
      'sponsor-b',
      'sponsor-a',
      'sponsor-a',
    ]);
  });

  it('starts new pending turns after consumed turn positions', async () => {
    const { tx, service } = buildService();

    tx.adWheelParticipant.findMany.mockResolvedValue([
      {
        sponsorId: 'sponsor-a',
        seatCount: 1,
        joinedAt: new Date('2026-04-01T00:00:00.000Z'),
      },
    ]);
    tx.adWheelTurn.findFirst.mockResolvedValue({ position: 9 });

    await service.generateSequence('wheel-1');

    expect(tx.adWheelTurn.findFirst).toHaveBeenCalledWith({
      where: {
        adWheelId: 'wheel-1',
        isConsumed: true,
      },
      select: {
        position: true,
      },
      orderBy: {
        position: 'desc',
      },
    });
    expect(tx.adWheelTurn.createMany).toHaveBeenCalledWith({
      data: [{ adWheelId: 'wheel-1', sponsorId: 'sponsor-a', position: 10 }],
    });
  });

  it('deletes pending turns and returns an empty sequence when there are no seats', async () => {
    const { tx, service } = buildService();

    tx.adWheelParticipant.findMany.mockResolvedValue([]);

    await expect(service.generateSequence('wheel-1')).resolves.toEqual([]);
    expect(tx.adWheelTurn.deleteMany).toHaveBeenCalledWith({
      where: {
        adWheelId: 'wheel-1',
        isConsumed: false,
      },
    });
    expect(tx.adWheelTurn.findFirst).not.toHaveBeenCalled();
    expect(tx.adWheelTurn.createMany).not.toHaveBeenCalled();
  });
});
