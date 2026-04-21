import { createHmac } from 'crypto';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { sanitizeToKurukinFormat } from '../shared/phone-utils';
import { PrismaService } from '../../prisma/prisma.service';

const BLACKLIST_DASHBOARD_URL =
  'https://blacklist.kuruk.in/dashboard/importaciones';
const BLACKLIST_JWT_ALGORITHM = 'HS256';
const BLACKLIST_JWT_TTL_SECONDS = 15 * 60;

type BlacklistJwtPayload = {
  phone: string;
  iat: number;
  exp: number;
};

const encodeBase64Url = (value: string) =>
  Buffer.from(value).toString('base64url');

const signHs256Jwt = (payload: BlacklistJwtPayload, secret: string) => {
  const headerSegment = encodeBase64Url(
    JSON.stringify({
      alg: BLACKLIST_JWT_ALGORITHM,
      typ: 'JWT',
    }),
  );
  const payloadSegment = encodeBase64Url(JSON.stringify(payload));
  const unsignedToken = `${headerSegment}.${payloadSegment}`;
  const signatureSegment = createHmac('sha256', secret)
    .update(unsignedToken)
    .digest('base64url');

  return `${unsignedToken}.${signatureSegment}`;
};

@Injectable()
export class SsoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async buildBlacklistUrl(user: AuthenticatedUser) {
    const secret =
      this.configService.get<string>('SSO_BLACKLIST_SECRET')?.trim();

    if (!secret) {
      throw new ServiceUnavailableException({
        code: 'SSO_BLACKLIST_SECRET_MISSING',
        message:
          'SSO_BLACKLIST_SECRET must be configured before opening Kurukin Hub.',
      });
    }

    const token = await this.generateToken(user, secret);

    return {
      url: `${BLACKLIST_DASHBOARD_URL}?token=${token}`,
    };
  }

  private async generateToken(user: AuthenticatedUser, secret: string) {
    const member = await this.prisma.user.findFirst({
      where: {
        id: user.id,
        role: UserRole.MEMBER,
        workspaceId: user.workspaceId ?? undefined,
        teamId: user.teamId ?? undefined,
      },
      select: {
        sponsorId: true,
        sponsor: {
          select: {
            phone: true,
          },
        },
      },
    });

    if (!member?.sponsorId) {
      throw new BadRequestException({
        code: 'SSO_BLACKLIST_MEMBER_REQUIRED',
        message:
          'Only authenticated members with a linked sponsor can open Kurukin Hub.',
      });
    }

    const phone = member.sponsor?.phone;

    if (!phone) {
      throw new BadRequestException({
        code: 'SSO_BLACKLIST_PHONE_REQUIRED',
        message:
          'Configure the advisor phone first so Leadflow can generate the Kurukin SSO token.',
      });
    }

    console.log('SSO_FLOW_DIAGNOSTIC:', {
      hasSecret: !!process.env.SSO_BLACKLIST_SECRET,
      phoneFound: phone,
    });

    const advisorPhone = sanitizeToKurukinFormat(phone);
    const issuedAt = Math.floor(Date.now() / 1000);
    return signHs256Jwt(
      {
        phone: advisorPhone,
        iat: issuedAt,
        exp: issuedAt + BLACKLIST_JWT_TTL_SECONDS,
      },
      secret,
    );
  }
}
