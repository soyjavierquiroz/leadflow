import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { mapTeamRecord, teamInclude } from '../prisma.mappers';
import type { CreateTeamDto } from '../../modules/teams/dto/create-team.dto';
import type {
  Team,
  TeamRepository,
} from '../../modules/teams/interfaces/team.interface';

@Injectable()
export class TeamPrismaRepository implements TeamRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Team[]> {
    const records = await this.prisma.team.findMany({
      include: teamInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapTeamRecord);
  }

  async findById(id: string): Promise<Team | null> {
    const record = await this.prisma.team.findUnique({
      where: { id },
      include: teamInclude,
    });

    return record ? mapTeamRecord(record) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Team[]> {
    const records = await this.prisma.team.findMany({
      where: { workspaceId },
      include: teamInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapTeamRecord);
  }

  async create(data: CreateTeamDto): Promise<Team> {
    const record = await this.prisma.team.create({
      data: {
        workspaceId: data.workspaceId,
        name: data.name,
        code: data.code,
        status: 'draft',
        description: data.description ?? null,
        managerUserId: data.managerUserId ?? null,
      },
      include: teamInclude,
    });

    return mapTeamRecord(record);
  }

  async save(entity: Team): Promise<Team> {
    const record = await this.prisma.team.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        name: entity.name,
        code: entity.code,
        status: entity.status,
        description: entity.description,
        managerUserId: entity.managerUserId,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        name: entity.name,
        code: entity.code,
        status: entity.status,
        description: entity.description,
        managerUserId: entity.managerUserId,
      },
      include: teamInclude,
    });

    return mapTeamRecord(record);
  }
}
