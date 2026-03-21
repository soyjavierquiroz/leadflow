import { Injectable } from '@nestjs/common';
import { LeadSourceChannel as PrismaLeadSourceChannel } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { mapLeadRecord } from '../prisma.mappers';
import type { CreateLeadDto } from '../../modules/leads/dto/create-lead.dto';
import type {
  Lead,
  LeadRepository,
} from '../../modules/leads/interfaces/lead.interface';

const toDbSource = (value: string): PrismaLeadSourceChannel => {
  switch (value) {
    case 'landing-page':
      return 'landing_page';
    case 'manual':
    case 'form':
    case 'api':
    case 'import':
    case 'automation':
      return value;
    default:
      return 'manual';
  }
};

@Injectable()
export class LeadPrismaRepository implements LeadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Lead[]> {
    const records = await this.prisma.lead.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapLeadRecord);
  }

  async findById(id: string): Promise<Lead | null> {
    const record = await this.prisma.lead.findUnique({ where: { id } });
    return record ? mapLeadRecord(record) : null;
  }

  async findByVisitorId(visitorId: string): Promise<Lead[]> {
    const records = await this.prisma.lead.findMany({
      where: { visitorId },
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapLeadRecord);
  }

  async findByWorkspaceId(workspaceId: string): Promise<Lead[]> {
    const records = await this.prisma.lead.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapLeadRecord);
  }

  async findBySponsorId(sponsorId: string): Promise<Lead[]> {
    const records = await this.prisma.lead.findMany({
      where: {
        assignments: {
          some: { sponsorId },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map(mapLeadRecord);
  }

  async findByPublicationId(funnelPublicationId: string): Promise<Lead[]> {
    const records = await this.prisma.lead.findMany({
      where: { funnelPublicationId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map(mapLeadRecord);
  }

  async create(data: CreateLeadDto): Promise<Lead> {
    const record = await this.prisma.lead.create({
      data: {
        workspaceId: data.workspaceId,
        funnelId: data.funnelId,
        funnelInstanceId: data.funnelInstanceId ?? null,
        funnelPublicationId: data.funnelPublicationId ?? null,
        visitorId: data.visitorId ?? null,
        sourceChannel: toDbSource(data.sourceChannel),
        fullName: data.fullName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        companyName: data.companyName ?? null,
        status: 'captured',
        currentAssignmentId: null,
        tags: data.tags ?? [],
      },
    });

    return mapLeadRecord(record);
  }

  async save(entity: Lead): Promise<Lead> {
    const record = await this.prisma.lead.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        workspaceId: entity.workspaceId,
        funnelId: entity.funnelId,
        funnelInstanceId: entity.funnelInstanceId,
        funnelPublicationId: entity.funnelPublicationId,
        visitorId: entity.visitorId,
        sourceChannel: toDbSource(entity.sourceChannel),
        fullName: entity.fullName,
        email: entity.email,
        phone: entity.phone,
        companyName: entity.companyName,
        status: entity.status,
        currentAssignmentId: entity.currentAssignmentId,
        tags: entity.tags,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        funnelId: entity.funnelId,
        funnelInstanceId: entity.funnelInstanceId,
        funnelPublicationId: entity.funnelPublicationId,
        visitorId: entity.visitorId,
        sourceChannel: toDbSource(entity.sourceChannel),
        fullName: entity.fullName,
        email: entity.email,
        phone: entity.phone,
        companyName: entity.companyName,
        status: entity.status,
        currentAssignmentId: entity.currentAssignmentId,
        tags: entity.tags,
      },
    });

    return mapLeadRecord(record);
  }
}
