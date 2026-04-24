import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { ROTATION_POOL_REPOSITORY } from '../shared/domain.tokens';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateRotationPoolDto } from './dto/create-rotation-pool.dto';
import type { UpdateRotationMemberDto } from './dto/update-rotation-member.dto';
import type {
  RotationPool,
  RotationPoolRepository,
} from './interfaces/rotation-pool.interface';

export type RotationPoolMemberView = {
  id: string;
  rotationPoolId: string;
  poolName: string;
  sponsorId: string;
  sponsorName: string;
  sponsorStatus: string;
  sponsorAvailabilityStatus: string;
  position: number;
  weight: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RotationPoolMemberDeletionResult = {
  id: string;
  deleted: true;
};

@Injectable()
export class RotationPoolsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(ROTATION_POOL_REPOSITORY)
    private readonly repository?: RotationPoolRepository,
  ) {}

  createDraft(dto: CreateRotationPoolDto): RotationPool {
    return buildEntity<RotationPool>({
      workspaceId: dto.workspaceId,
      teamId: dto.teamId,
      name: dto.name,
      status: 'draft',
      strategy: dto.strategy ?? 'round-robin',
      sponsorIds: dto.sponsorIds ?? [],
      funnelIds: dto.funnelIds ?? [],
      isFallbackPool: dto.isFallbackPool ?? false,
    });
  }

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
  }): Promise<RotationPool[]> {
    if (!this.repository) {
      throw new Error('RotationPoolRepository provider is not configured.');
    }

    if (filters?.teamId) {
      return this.repository.findByTeamId(filters.teamId);
    }

    if (filters?.workspaceId) {
      return this.repository.findByWorkspaceId(filters.workspaceId);
    }

    return this.repository.findAll();
  }

  async listMembers(filters: {
    workspaceId: string;
    teamId: string;
    rotationPoolId?: string;
  }): Promise<RotationPoolMemberView[]> {
    const members = await this.prisma.rotationMember.findMany({
      where: {
        rotationPool: {
          workspaceId: filters.workspaceId,
          teamId: filters.teamId,
        },
        ...(filters.rotationPoolId
          ? {
              rotationPoolId: filters.rotationPoolId,
            }
          : {}),
      },
      include: {
        rotationPool: {
          select: {
            id: true,
            name: true,
          },
        },
        sponsor: {
          select: {
            id: true,
            displayName: true,
            status: true,
            availabilityStatus: true,
          },
        },
      },
      orderBy: [{ rotationPoolId: 'asc' }, { position: 'asc' }],
    });

    return members.map((member) => ({
      id: member.id,
      rotationPoolId: member.rotationPoolId,
      poolName: member.rotationPool.name,
      sponsorId: member.sponsor.id,
      sponsorName: member.sponsor.displayName,
      sponsorStatus: member.sponsor.status,
      sponsorAvailabilityStatus: member.sponsor.availabilityStatus,
      position: member.position,
      weight: member.weight,
      isActive: member.isActive,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    }));
  }

  async updateMemberForTeam(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    memberId: string,
    dto: UpdateRotationMemberDto,
  ): Promise<RotationPoolMemberView> {
    if (
      dto.isActive === undefined &&
      dto.position === undefined &&
      dto.weight === undefined
    ) {
      throw new BadRequestException({
        code: 'ROTATION_MEMBER_UPDATE_EMPTY',
        message: 'At least one rotation member field is required.',
      });
    }

    const member = await this.prisma.rotationMember.findFirst({
      where: {
        id: memberId,
        rotationPool: {
          workspaceId: scope.workspaceId,
          teamId: scope.teamId,
        },
      },
      include: {
        rotationPool: {
          select: {
            id: true,
            name: true,
          },
        },
        sponsor: {
          select: {
            id: true,
            displayName: true,
            status: true,
            availabilityStatus: true,
          },
        },
      },
    });

    if (!member) {
      throw new NotFoundException({
        code: 'ROTATION_MEMBER_NOT_FOUND',
        message: 'The requested rotation member was not found for this team.',
      });
    }

    if (
      dto.position !== undefined &&
      (!Number.isInteger(dto.position) || dto.position < 1)
    ) {
      throw new BadRequestException({
        code: 'ROTATION_MEMBER_POSITION_INVALID',
        message:
          'Rotation member position must be an integer greater than zero.',
      });
    }

    if (
      dto.weight !== undefined &&
      (!Number.isInteger(dto.weight) || dto.weight < 1)
    ) {
      throw new BadRequestException({
        code: 'ROTATION_MEMBER_WEIGHT_INVALID',
        message: 'Rotation member weight must be an integer greater than zero.',
      });
    }

    const updatedMember = await this.prisma.$transaction(async (tx) => {
      const siblings = await tx.rotationMember.findMany({
        where: {
          rotationPoolId: member.rotationPoolId,
        },
        orderBy: {
          position: 'asc',
        },
      });

      const currentIndex = siblings.findIndex((item) => item.id === member.id);
      const desiredPosition = Math.min(
        dto.position ?? member.position,
        siblings.length,
      );

      if (currentIndex >= 0 && desiredPosition !== member.position) {
        const reordered = [...siblings];
        const [current] = reordered.splice(currentIndex, 1);
        reordered.splice(desiredPosition - 1, 0, current);

        // Move existing positions out of the unique range first so we can
        // safely rewrite the final ordering without hitting pool+position
        // collisions mid-transaction.
        for (const [index, item] of reordered.entries()) {
          await tx.rotationMember.update({
            where: { id: item.id },
            data: {
              position: siblings.length + index + 1,
            },
          });
        }

        for (const [index, item] of reordered.entries()) {
          await tx.rotationMember.update({
            where: { id: item.id },
            data: {
              position: index + 1,
            },
          });
        }
      }

      return tx.rotationMember.update({
        where: { id: member.id },
        data: {
          isActive: dto.isActive ?? member.isActive,
          weight: dto.weight ?? member.weight,
        },
        include: {
          rotationPool: {
            select: {
              id: true,
              name: true,
            },
          },
          sponsor: {
            select: {
              id: true,
              displayName: true,
              status: true,
              availabilityStatus: true,
            },
          },
        },
      });
    });

    return {
      id: updatedMember.id,
      rotationPoolId: updatedMember.rotationPoolId,
      poolName: updatedMember.rotationPool.name,
      sponsorId: updatedMember.sponsor.id,
      sponsorName: updatedMember.sponsor.displayName,
      sponsorStatus: updatedMember.sponsor.status,
      sponsorAvailabilityStatus: updatedMember.sponsor.availabilityStatus,
      position: updatedMember.position,
      weight: updatedMember.weight,
      isActive: updatedMember.isActive,
      createdAt: updatedMember.createdAt.toISOString(),
      updatedAt: updatedMember.updatedAt.toISOString(),
    };
  }

  async deleteMemberForTeam(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    memberId: string,
  ): Promise<RotationPoolMemberDeletionResult> {
    return this.prisma.$transaction(async (tx) => {
      const member = await tx.rotationMember.findFirst({
        where: {
          id: memberId,
          rotationPool: {
            workspaceId: scope.workspaceId,
            teamId: scope.teamId,
          },
        },
        select: {
          id: true,
          rotationPoolId: true,
          position: true,
        },
      });

      if (!member) {
        throw new NotFoundException({
          code: 'ROTATION_MEMBER_NOT_FOUND',
          message: 'The requested rotation member was not found for this team.',
        });
      }

      await tx.rotationMember.delete({
        where: { id: member.id },
      });

      const siblings = await tx.rotationMember.findMany({
        where: {
          rotationPoolId: member.rotationPoolId,
          position: {
            gt: member.position,
          },
        },
        orderBy: {
          position: 'asc',
        },
        select: {
          id: true,
          position: true,
        },
      });

      for (const sibling of siblings) {
        await tx.rotationMember.update({
          where: { id: sibling.id },
          data: {
            position: sibling.position - 1,
          },
        });
      }

      return {
        id: member.id,
        deleted: true as const,
      };
    });
  }
}
