import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { mapAssignmentRecord } from '../prisma.mappers';
import type { CreateAssignmentDto } from '../../modules/assignments/dto/create-assignment.dto';
import type {
  Assignment,
  AssignmentRepository,
} from '../../modules/assignments/interfaces/assignment.interface';

@Injectable()
export class AssignmentPrismaRepository implements AssignmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Assignment[]> {
    const records = await this.prisma.assignment.findMany({
      orderBy: { assignedAt: 'desc' },
    });

    return records.map(mapAssignmentRecord);
  }

  async findById(id: string): Promise<Assignment | null> {
    const record = await this.prisma.assignment.findUnique({ where: { id } });
    return record ? mapAssignmentRecord(record) : null;
  }

  async findByWorkspaceId(workspaceId: string): Promise<Assignment[]> {
    const records = await this.prisma.assignment.findMany({
      where: { workspaceId },
      orderBy: { assignedAt: 'desc' },
    });

    return records.map(mapAssignmentRecord);
  }

  async findOpenByLeadId(leadId: string): Promise<Assignment | null> {
    const record = await this.prisma.assignment.findFirst({
      where: {
        leadId,
        status: {
          in: ['pending', 'assigned', 'accepted'],
        },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return record ? mapAssignmentRecord(record) : null;
  }

  async create(data: CreateAssignmentDto): Promise<Assignment> {
    const record = await this.prisma.assignment.create({
      data: {
        workspaceId: data.workspaceId,
        leadId: data.leadId,
        sponsorId: data.sponsorId,
        teamId: data.teamId,
        funnelId: data.funnelId,
        rotationPoolId: data.rotationPoolId ?? null,
        status: 'pending',
        reason: data.reason ?? 'rotation',
        assignedAt: new Date(),
        resolvedAt: null,
      },
    });

    return mapAssignmentRecord(record);
  }

  async save(entity: Assignment): Promise<Assignment> {
    const record = await this.prisma.assignment.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        leadId: entity.leadId,
        sponsorId: entity.sponsorId,
        teamId: entity.teamId,
        funnelId: entity.funnelId,
        rotationPoolId: entity.rotationPoolId,
        status: entity.status,
        reason: entity.reason,
        assignedAt: new Date(entity.assignedAt),
        resolvedAt: entity.resolvedAt ? new Date(entity.resolvedAt) : null,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        sponsorId: entity.sponsorId,
        teamId: entity.teamId,
        funnelId: entity.funnelId,
        rotationPoolId: entity.rotationPoolId,
        status: entity.status,
        reason: entity.reason,
        assignedAt: new Date(entity.assignedAt),
        resolvedAt: entity.resolvedAt ? new Date(entity.resolvedAt) : null,
      },
    });

    return mapAssignmentRecord(record);
  }
}
