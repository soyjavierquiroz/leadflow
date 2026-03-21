import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { mapWorkspaceRecord } from '../prisma.mappers';
import type { CreateWorkspaceDto } from '../../modules/workspaces/dto/create-workspace.dto';
import type {
  Workspace,
  WorkspaceRepository,
} from '../../modules/workspaces/interfaces/workspace.interface';

@Injectable()
export class WorkspacePrismaRepository implements WorkspaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Workspace[]> {
    const records = await this.prisma.workspace.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapWorkspaceRecord);
  }

  async findById(id: string): Promise<Workspace | null> {
    const record = await this.prisma.workspace.findUnique({ where: { id } });
    return record ? mapWorkspaceRecord(record) : null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const record = await this.prisma.workspace.findUnique({ where: { slug } });
    return record ? mapWorkspaceRecord(record) : null;
  }

  async create(data: CreateWorkspaceDto): Promise<Workspace> {
    const record = await this.prisma.workspace.create({
      data: {
        name: data.name,
        slug: data.slug,
        status: 'draft',
        timezone: data.timezone ?? 'UTC',
        defaultCurrency: data.defaultCurrency ?? 'USD',
        primaryLocale: data.primaryLocale ?? 'es',
        primaryDomain: data.primaryDomain ?? null,
      },
    });

    return mapWorkspaceRecord(record);
  }

  async save(entity: Workspace): Promise<Workspace> {
    const record = await this.prisma.workspace.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        name: entity.name,
        slug: entity.slug,
        status: entity.status,
        timezone: entity.timezone,
        defaultCurrency: entity.defaultCurrency,
        primaryLocale: entity.primaryLocale,
        primaryDomain: entity.primaryDomain,
        createdAt: new Date(entity.createdAt),
        updatedAt: new Date(entity.updatedAt),
      },
      update: {
        name: entity.name,
        slug: entity.slug,
        status: entity.status,
        timezone: entity.timezone,
        defaultCurrency: entity.defaultCurrency,
        primaryLocale: entity.primaryLocale,
        primaryDomain: entity.primaryDomain,
      },
    });

    return mapWorkspaceRecord(record);
  }
}
