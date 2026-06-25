import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, Prisma, TeamType, UserRole } from '@prisma/client';
import {
  buildIndividualCommercialProfile,
  resolveBusinessBlueprintForProfile,
} from '@leadflow/account-model';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { UpdateCommercialProfileDto } from './dto/update-commercial-profile.dto';

const allowedSalesMotions = new Set([
  'whatsapp',
  'whatsapp_calls',
  'in_person',
  'mixed',
]);

const requiredText = (value: string | null | undefined, field: string) => {
  if (typeof value !== 'string') {
    throw new BadRequestException({
      code: 'FIELD_REQUIRED',
      field,
      message: `${field} is required.`,
    });
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new BadRequestException({
      code: 'FIELD_REQUIRED',
      field,
      message: `${field} is required.`,
    });
  }

  return trimmed;
};

const optionalText = (value: string | null | undefined) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
};

const nullableText = (value: string | null | undefined) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed ? trimmed : null;
};

type CommercialProfileClient =
  | PrismaService
  | Prisma.TransactionClient;

export type CommercialProfileContext = {
  workspaceId: string;
  teamId: string;
  sponsorId?: string | null;
};

export type UpsertCommercialProfilePayload = UpdateCommercialProfileDto & {
  businessName: string;
  legacyNiche?: string | null;
};

type ExistingCommercialProfile = Prisma.CommercialProfileGetPayload<object>;
type CommercialProfilePayload = UpdateCommercialProfileDto & {
  legacyNiche?: string | null;
};

@Injectable()
export class CommercialProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertCommercialProfileForIndividualAccount(
    context: CommercialProfileContext,
    payload: UpsertCommercialProfilePayload,
    client: CommercialProfileClient = this.prisma,
  ) {
    const data = this.buildProfileData(payload, null);

    return client.commercialProfile.upsert({
      where: {
        teamId: context.teamId,
      },
      create: {
        ...data,
        workspaceId: context.workspaceId,
        teamId: context.teamId,
        sponsorId: context.sponsorId ?? null,
      },
      update: {
        ...data,
        workspaceId: context.workspaceId,
        sponsorId: context.sponsorId ?? null,
      },
    });
  }

  async getCommercialProfileForTeam(teamId: string) {
    return this.prisma.commercialProfile.findUnique({
      where: {
        teamId,
      },
    });
  }

  async getCommercialProfileSnapshotForTeam(teamId: string) {
    const profile = await this.getCommercialProfileForTeam(teamId);

    return {
      profile,
      isComplete: this.isCommercialProfileComplete(profile),
    };
  }

  async updateCommercialProfileForTeam(
    teamId: string,
    payload: CommercialProfilePayload,
  ) {
    const existing = await this.prisma.commercialProfile.findUnique({
      where: {
        teamId,
      },
    });

    if (existing) {
      const data = this.buildProfileData(payload, existing);

      return this.prisma.commercialProfile.update({
        where: {
          teamId,
        },
        data,
      });
    }

    const team = await this.prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        id: true,
        name: true,
        workspaceId: true,
        sponsors: {
          orderBy: {
            createdAt: 'asc',
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    if (!team) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: 'The current team was not found.',
      });
    }

    const businessName = payload.businessName ?? team.name;
    const data = this.buildProfileData(
      {
        ...payload,
        businessName,
      },
      null,
    );

    return this.prisma.commercialProfile.create({
      data: {
        ...data,
        workspaceId: team.workspaceId,
        teamId: team.id,
        sponsorId: team.sponsors[0]?.id ?? null,
      },
    });
  }

  assertCanUseCurrentTeamEndpoint(user: AuthenticatedUser) {
    if (!user.workspaceId || !user.teamId) {
      throw new ForbiddenException({
        code: 'TEAM_CONTEXT_REQUIRED',
        message: 'A current team context is required.',
      });
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException({
        code: 'COMMERCIAL_PROFILE_ME_UNAVAILABLE_FOR_SUPER_ADMIN',
        message:
          'Super Admin users must operate commercial profiles through system context.',
      });
    }
  }

  async assertCurrentTeamSupportsCommercialProfile(user: AuthenticatedUser) {
    this.assertCanUseCurrentTeamEndpoint(user);

    const team = await this.prisma.team.findUnique({
      where: {
        id: user.teamId!,
      },
      include: {
        workspace: true,
      },
    });

    if (
      !team ||
      team.workspaceId !== user.workspaceId ||
      team.teamType !== TeamType.personal ||
      team.workspace.accountType !== AccountType.individual
    ) {
      throw new ForbiddenException({
        code: 'INDIVIDUAL_TEAM_CONTEXT_REQUIRED',
        message:
          'Commercial profile /me requires an individual personal team context.',
      });
    }
  }

  isCommercialProfileComplete(profile: ExistingCommercialProfile | null) {
    return Boolean(
      profile?.businessName &&
        profile.vertical &&
        profile.industry &&
        profile.businessModel &&
        profile.blueprintKey,
    );
  }

  private buildProfileData(
    payload: CommercialProfilePayload,
    existing: ExistingCommercialProfile | null,
  ) {
    const base =
      payload.niche !== undefined || payload.legacyNiche !== undefined
        ? buildIndividualCommercialProfile(payload.niche ?? payload.legacyNiche)
        : existing
          ? {
              vertical: existing.vertical,
              industry: existing.industry,
              businessModel: existing.businessModel,
              legacyNiche: existing.legacyNiche ?? 'other',
              presetVersion: existing.presetVersion,
              blueprintKey: existing.blueprintKey,
              blueprintVersion: existing.blueprintVersion,
            }
          : buildIndividualCommercialProfile(null);

    const vertical = optionalText(payload.vertical) ?? base.vertical;
    const industry = optionalText(payload.industry) ?? base.industry;
    const businessModel =
      optionalText(payload.businessModel) ?? base.businessModel;
    const blueprint = resolveBusinessBlueprintForProfile({
      vertical,
      industry,
      businessModel,
    });
    const businessName =
      payload.businessName === undefined
        ? existing?.businessName
        : requiredText(payload.businessName, 'businessName');
    const salesMotion = optionalText(payload.salesMotion);

    if (salesMotion && !allowedSalesMotions.has(salesMotion)) {
      throw new BadRequestException({
        code: 'INVALID_SALES_MOTION',
        field: 'salesMotion',
        message: 'salesMotion is invalid.',
      });
    }

    return {
      vertical,
      industry,
      businessModel,
      legacyNiche: nullableText(
        payload.niche ?? payload.legacyNiche ?? base.legacyNiche,
      ),
      presetVersion: base.presetVersion,
      blueprintKey: blueprint.blueprintKey,
      blueprintVersion: blueprint.version,
      businessName: requiredText(businessName, 'businessName'),
      mainProduct:
        payload.mainProduct === undefined
          ? existing?.mainProduct
          : nullableText(payload.mainProduct),
      averagePrice:
        payload.averagePrice === undefined
          ? existing?.averagePrice
          : nullableText(payload.averagePrice),
      salesMotion:
        payload.salesMotion === undefined
          ? existing?.salesMotion
          : salesMotion,
      country:
        payload.country === undefined
          ? existing?.country
          : nullableText(payload.country),
      phone:
        payload.phone === undefined
          ? existing?.phone
          : nullableText(payload.phone),
    };
  }
}
