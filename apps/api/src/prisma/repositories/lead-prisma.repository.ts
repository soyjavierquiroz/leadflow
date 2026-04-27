import { Injectable } from '@nestjs/common';
import {
  LeadSourceChannel as PrismaLeadSourceChannel,
  type Prisma,
} from '@prisma/client';
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

const leadOriginInclude = {
  originAdWheel: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.LeadInclude;

@Injectable()
export class LeadPrismaRepository implements LeadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Lead[]> {
    const records = await this.prisma.lead.findMany({
      include: leadOriginInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapLeadRecord);
  }

  async findById(id: string): Promise<Lead | null> {
    const record = await this.prisma.lead.findUnique({
      where: { id },
      include: leadOriginInclude,
    });
    return record ? mapLeadRecord(record) : null;
  }

  async findByVisitorId(visitorId: string): Promise<Lead[]> {
    const records = await this.prisma.lead.findMany({
      where: { visitorId },
      include: leadOriginInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapLeadRecord);
  }

  async findByWorkspaceId(workspaceId: string): Promise<Lead[]> {
    const records = await this.prisma.lead.findMany({
      where: { workspaceId },
      include: leadOriginInclude,
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapLeadRecord);
  }

  async findByTeamId(teamId: string): Promise<Lead[]> {
    const records = await this.prisma.lead.findMany({
      where: {
        OR: [
          {
            assignments: {
              some: { teamId },
            },
          },
          {
            funnelInstance: {
              teamId,
            },
          },
          {
            funnelPublication: {
              teamId,
            },
          },
        ],
      },
      include: leadOriginInclude,
      orderBy: { createdAt: 'desc' },
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
      include: leadOriginInclude,
      orderBy: { createdAt: 'desc' },
    });

    return records.map(mapLeadRecord);
  }

  async findByPublicationId(funnelPublicationId: string): Promise<Lead[]> {
    const records = await this.prisma.lead.findMany({
      where: { funnelPublicationId },
      include: leadOriginInclude,
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
        trafficLayer: 'ORGANIC',
        originAdWheelId: null,
        visitorId: data.visitorId ?? null,
        sourceChannel: toDbSource(data.sourceChannel),
        fullName: data.fullName ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        companyName: data.companyName ?? null,
        status: 'captured',
        qualificationGrade: null,
        summaryText: null,
        nextActionLabel: null,
        followUpAt: null,
        lastContactedAt: null,
        lastQualifiedAt: null,
        currentAssignmentId: null,
        tags: data.tags ?? [],
      },
      include: leadOriginInclude,
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
        trafficLayer: entity.trafficLayer,
        originAdWheelId: entity.originAdWheelId,
        visitorId: entity.visitorId,
        sourceChannel: toDbSource(entity.sourceChannel),
        fullName: entity.fullName,
        email: entity.email,
        phone: entity.phone,
        companyName: entity.companyName,
        status: entity.status,
        qualificationGrade: entity.qualificationGrade,
        summaryText: entity.summaryText,
        nextActionLabel: entity.nextActionLabel,
        followUpAt: entity.followUpAt ? new Date(entity.followUpAt) : null,
        lastContactedAt: entity.lastContactedAt
          ? new Date(entity.lastContactedAt)
          : null,
        lastQualifiedAt: entity.lastQualifiedAt
          ? new Date(entity.lastQualifiedAt)
          : null,
        currentAssignmentId: entity.currentAssignmentId,
        tags: entity.tags,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        funnelId: entity.funnelId,
        funnelInstanceId: entity.funnelInstanceId,
        funnelPublicationId: entity.funnelPublicationId,
        trafficLayer: entity.trafficLayer,
        originAdWheelId: entity.originAdWheelId,
        visitorId: entity.visitorId,
        sourceChannel: toDbSource(entity.sourceChannel),
        fullName: entity.fullName,
        email: entity.email,
        phone: entity.phone,
        companyName: entity.companyName,
        status: entity.status,
        qualificationGrade: entity.qualificationGrade,
        summaryText: entity.summaryText,
        nextActionLabel: entity.nextActionLabel,
        followUpAt: entity.followUpAt ? new Date(entity.followUpAt) : null,
        lastContactedAt: entity.lastContactedAt
          ? new Date(entity.lastContactedAt)
          : null,
        lastQualifiedAt: entity.lastQualifiedAt
          ? new Date(entity.lastQualifiedAt)
          : null,
        currentAssignmentId: entity.currentAssignmentId,
        tags: entity.tags,
      },
      include: leadOriginInclude,
    });

    return mapLeadRecord(record);
  }
}
