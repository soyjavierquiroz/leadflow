import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type WeightedParticipant = {
  sponsorId: string;
  seatCount: number;
  currentWeight: number;
};

export type GeneratedAdWheelTurn = {
  adWheelId: string;
  sponsorId: string;
  position: number;
};

@Injectable()
export class AdWheelSequenceGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async generateSequence(adWheelId: string): Promise<GeneratedAdWheelTurn[]> {
    return this.prisma.$transaction(async (tx) => {
      const participants = await tx.adWheelParticipant.findMany({
        where: {
          adWheelId,
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

      const sequence = this.buildSmoothWeightedSequence(participants);

      await tx.adWheelTurn.deleteMany({
        where: {
          adWheelId,
          isConsumed: false,
        },
      });

      if (sequence.length === 0) {
        return [];
      }

      const lastConsumedTurn = await tx.adWheelTurn.findFirst({
        where: {
          adWheelId,
          isConsumed: true,
        },
        select: {
          position: true,
        },
        orderBy: {
          position: 'desc',
        },
      });
      const positionOffset = lastConsumedTurn?.position ?? 0;
      const turns = sequence.map((sponsorId, index) => ({
        adWheelId,
        sponsorId,
        position: positionOffset + index + 1,
      }));

      await tx.adWheelTurn.createMany({
        data: turns,
      });

      return turns;
    });
  }

  private buildSmoothWeightedSequence(
    participants: Array<Pick<WeightedParticipant, 'sponsorId' | 'seatCount'>>,
  ): string[] {
    const weightedParticipants: WeightedParticipant[] = participants.map(
      (participant) => ({
        ...participant,
        currentWeight: 0,
      }),
    );
    const totalSeats = weightedParticipants.reduce(
      (total, participant) => total + participant.seatCount,
      0,
    );
    const sequence: string[] = [];

    for (let turn = 0; turn < totalSeats; turn += 1) {
      let winner: WeightedParticipant | null = null;

      for (const participant of weightedParticipants) {
        participant.currentWeight += participant.seatCount;

        if (
          !winner ||
          participant.currentWeight > winner.currentWeight ||
          (participant.currentWeight === winner.currentWeight &&
            participant.seatCount < winner.seatCount)
        ) {
          winner = participant;
        }
      }

      if (!winner) {
        break;
      }

      winner.currentWeight -= totalSeats;
      sequence.push(winner.sponsorId);
    }

    return sequence;
  }
}
