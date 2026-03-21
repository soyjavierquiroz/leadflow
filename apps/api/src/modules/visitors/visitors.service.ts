import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { VISITOR_REPOSITORY } from '../shared/domain.tokens';
import type { CreateVisitorDto } from './dto/create-visitor.dto';
import type {
  Visitor,
  VisitorRepository,
} from './interfaces/visitor.interface';

@Injectable()
export class VisitorsService {
  constructor(
    @Optional()
    @Inject(VISITOR_REPOSITORY)
    private readonly repository?: VisitorRepository,
  ) {}

  createDraft(dto: CreateVisitorDto): Visitor {
    const seenAt = new Date().toISOString();

    return buildEntity<Visitor>({
      workspaceId: dto.workspaceId,
      anonymousId: dto.anonymousId,
      kind: dto.kind ?? 'anonymous',
      status: 'active',
      sourceChannel: dto.sourceChannel,
      leadId: dto.leadId ?? null,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
      utmSource: dto.utmSource ?? null,
      utmCampaign: dto.utmCampaign ?? null,
    });
  }
}
