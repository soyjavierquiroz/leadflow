import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicIdentityLinkService } from './public-identity-link.service';

export const ACTION_LINK_DEFAULT_APP_KEY = 'leadflow';
export const ACTION_LINK_OPEN_VSL = 'leadflow.open_vsl';
export const ACTION_LINK_DEFAULT_PURPOSE = 'vsl_followup';
export const ACTION_LINK_DEFAULT_CHANNEL = 'whatsapp';
export const ACTION_LINK_DEFAULT_VSL_STEP_KEY = 'presentacion';

export type ResolveActionLinkInput = {
  leadId: string;
  assignmentId?: string | null;
  appKey?: string;
  actionKey: string;
  purpose?: string;
  channel?: string;
  params?: {
    stepKey?: string;
  };
  idempotencyKey?: string | null;
  createdBy?: string | null;
};

export type ResolveActionLinkOutput = {
  ok: true;
  actionKey: typeof ACTION_LINK_OPEN_VSL;
  appKey: typeof ACTION_LINK_DEFAULT_APP_KEY;
  purpose: string;
  channel: string;
  url: string;
  longUrl: string;
  shortUrl: string | null;
  provider: string;
  trackedLinkId: string;
  cached: boolean;
  expiresAt: Date | null;
  metadata: {
    targetStep: {
      id: string;
      slug: string;
      path: string;
      stepType: string;
    };
    shortCode: string | null;
  };
};

type LegacyTrackedLinkResult = Awaited<
  ReturnType<PublicIdentityLinkService['generateTrackedIdentityLink']>
>;

@Injectable()
export class ActionLinkResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publicIdentityLinkService: PublicIdentityLinkService,
  ) {}

  async resolve(input: ResolveActionLinkInput): Promise<ResolveActionLinkOutput> {
    const appKey = this.normalizeOptionalString(input.appKey) ?? 'leadflow';
    if (appKey !== ACTION_LINK_DEFAULT_APP_KEY) {
      throw new BadRequestException({
        code: 'ACTION_LINK_UNSUPPORTED_APP',
        message: `Action link app "${appKey}" is not supported.`,
      });
    }

    if (input.actionKey !== ACTION_LINK_OPEN_VSL) {
      throw new BadRequestException({
        code: 'ACTION_LINK_UNSUPPORTED_ACTION',
        message: `Action "${input.actionKey}" is not supported.`,
      });
    }

    await this.validateAssignment(input);

    const purpose =
      this.normalizeOptionalString(input.purpose) ??
      ACTION_LINK_DEFAULT_PURPOSE;
    const channel =
      this.normalizeOptionalString(input.channel) ??
      ACTION_LINK_DEFAULT_CHANNEL;
    const stepKey =
      this.normalizeOptionalString(input.params?.stepKey) ??
      ACTION_LINK_DEFAULT_VSL_STEP_KEY;

    const legacyResult =
      await this.publicIdentityLinkService.generateTrackedIdentityLink({
        leadId: input.leadId,
        stepKey,
      });
    const expiresAt = await this.findTrackedLinkExpiresAt(
      legacyResult.trackedLinkId,
    );

    return this.mapOpenVslResult({
      legacyResult,
      purpose,
      channel,
      expiresAt,
    });
  }

  private async validateAssignment(input: ResolveActionLinkInput) {
    const assignmentId = this.normalizeOptionalString(input.assignmentId);
    if (!assignmentId) {
      return;
    }

    const lead = await this.prisma.lead.findUnique({
      where: {
        id: input.leadId,
      },
      select: {
        id: true,
        currentAssignmentId: true,
      },
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'ACTION_LINK_LEAD_NOT_FOUND',
        message: `Lead ${input.leadId} was not found.`,
      });
    }

    if (lead.currentAssignmentId !== assignmentId) {
      throw new BadRequestException({
        code: 'ACTION_LINK_ASSIGNMENT_MISMATCH',
        message:
          'The provided assignmentId does not match the lead current assignment.',
      });
    }
  }

  private async findTrackedLinkExpiresAt(trackedLinkId: string) {
    const trackedLink = await this.prisma.trackedLink.findUnique({
      where: {
        id: trackedLinkId,
      },
      select: {
        expiresAt: true,
      },
    });

    return trackedLink?.expiresAt ?? null;
  }

  private mapOpenVslResult(input: {
    legacyResult: LegacyTrackedLinkResult;
    purpose: string;
    channel: string;
    expiresAt: Date | null;
  }): ResolveActionLinkOutput {
    return {
      ok: true,
      actionKey: ACTION_LINK_OPEN_VSL,
      appKey: ACTION_LINK_DEFAULT_APP_KEY,
      purpose: input.purpose,
      channel: input.channel,
      url: input.legacyResult.url,
      longUrl: input.legacyResult.longUrl,
      shortUrl: input.legacyResult.shortUrl,
      provider: input.legacyResult.shortLinkProvider,
      trackedLinkId: input.legacyResult.trackedLinkId,
      cached: input.legacyResult.cached,
      expiresAt: input.expiresAt,
      metadata: {
        targetStep: input.legacyResult.targetStep,
        shortCode: input.legacyResult.shortCode,
      },
    };
  }

  private normalizeOptionalString(value: string | null | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
