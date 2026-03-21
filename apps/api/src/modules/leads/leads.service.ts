import { Injectable } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import type { CreateLeadDto } from './dto/create-lead.dto';
import type { Lead } from './interfaces/lead.interface';

@Injectable()
export class LeadsService {
  createDraft(dto: CreateLeadDto): Lead {
    return buildEntity<Lead>({
      workspaceId: dto.workspaceId,
      funnelId: dto.funnelId,
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
}
