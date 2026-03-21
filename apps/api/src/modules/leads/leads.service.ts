import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { LEAD_REPOSITORY } from '../shared/domain.tokens';
import type { CreateLeadDto } from './dto/create-lead.dto';
import type { Lead, LeadRepository } from './interfaces/lead.interface';

@Injectable()
export class LeadsService {
  constructor(
    @Optional()
    @Inject(LEAD_REPOSITORY)
    private readonly repository?: LeadRepository,
  ) {}

  createDraft(dto: CreateLeadDto): Lead {
    return buildEntity<Lead>({
      workspaceId: dto.workspaceId,
      funnelId: dto.funnelId,
      funnelInstanceId: dto.funnelInstanceId ?? null,
      funnelPublicationId: dto.funnelPublicationId ?? null,
      visitorId: dto.visitorId ?? null,
      sourceChannel: dto.sourceChannel,
      fullName: dto.fullName ?? null,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      companyName: dto.companyName ?? null,
      status: 'captured',
      currentAssignmentId: null,
      tags: dto.tags ?? [],
    });
  }

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
    sponsorId?: string;
    funnelPublicationId?: string;
  }): Promise<Lead[]> {
    if (!this.repository) {
      throw new Error('LeadRepository provider is not configured.');
    }

    if (filters?.sponsorId) {
      return this.repository.findBySponsorId(filters.sponsorId);
    }

    if (filters?.funnelPublicationId) {
      return this.repository.findByPublicationId(filters.funnelPublicationId);
    }

    if (filters?.teamId) {
      return this.repository.findByTeamId(filters.teamId);
    }

    if (filters?.workspaceId) {
      return this.repository.findByWorkspaceId(filters.workspaceId);
    }

    return this.repository.findAll();
  }
}
