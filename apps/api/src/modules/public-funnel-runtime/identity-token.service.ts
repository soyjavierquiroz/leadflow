import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { getApiRuntimeConfig } from '../../config/runtime';

type IdentityTokenPayload = {
  leadId: string;
  publicationId: string;
  targetStepPath: string;
  iat: number;
  exp: number;
};

const encodeBase64Url = (value: string) =>
  Buffer.from(value, 'utf8').toString('base64url');

const decodeBase64Url = (value: string) =>
  Buffer.from(value, 'base64url').toString('utf8');

@Injectable()
export class IdentityTokenService {
  private readonly runtimeConfig = getApiRuntimeConfig();

  issueToken(input: {
    leadId: string;
    publicationId: string;
    targetStepPath: string;
  }) {
    const secret = this.runtimeConfig.identityTokenSecret;
    if (!secret) {
      throw new ServiceUnavailableException({
        code: 'IDENTITY_TOKEN_SECRET_MISSING',
        message: 'The identity token secret is not configured.',
      });
    }

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt =
      issuedAt + Math.max(1, this.runtimeConfig.identityTokenTtlHours) * 3600;
    const payload: IdentityTokenPayload = {
      leadId: input.leadId,
      publicationId: input.publicationId,
      targetStepPath: input.targetStepPath,
      iat: issuedAt,
      exp: expiresAt,
    };

    const encodedPayload = encodeBase64Url(JSON.stringify(payload));
    const signature = this.sign(encodedPayload, secret);

    return `${encodedPayload}.${signature}`;
  }

  verifyToken(token: string) {
    const secret = this.runtimeConfig.identityTokenSecret;
    if (!secret) {
      throw new ServiceUnavailableException({
        code: 'IDENTITY_TOKEN_SECRET_MISSING',
        message: 'The identity token secret is not configured.',
      });
    }

    const [encodedPayload, providedSignature] = token.split('.');
    if (!encodedPayload || !providedSignature) {
      throw new UnauthorizedException({
        code: 'IDENTITY_TOKEN_INVALID',
        message: 'The identity token is malformed.',
      });
    }

    const expectedSignature = this.sign(encodedPayload, secret);
    const expectedBuffer = Buffer.from(expectedSignature);
    const providedBuffer = Buffer.from(providedSignature);

    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      throw new UnauthorizedException({
        code: 'IDENTITY_TOKEN_INVALID',
        message: 'The identity token signature is invalid.',
      });
    }

    let payload: IdentityTokenPayload;
    try {
      payload = JSON.parse(
        decodeBase64Url(encodedPayload),
      ) as IdentityTokenPayload;
    } catch {
      throw new UnauthorizedException({
        code: 'IDENTITY_TOKEN_INVALID',
        message: 'The identity token payload is invalid.',
      });
    }

    if (
      !payload.leadId ||
      !payload.publicationId ||
      !payload.targetStepPath ||
      !Number.isFinite(payload.exp)
    ) {
      throw new UnauthorizedException({
        code: 'IDENTITY_TOKEN_INVALID',
        message: 'The identity token payload is incomplete.',
      });
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new UnauthorizedException({
        code: 'IDENTITY_TOKEN_EXPIRED',
        message: 'The identity token has expired.',
      });
    }

    return payload;
  }

  private sign(payload: string, secret: string) {
    return createHmac('sha256', secret).update(payload).digest('base64url');
  }
}
