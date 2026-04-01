import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { timingSafeEqual } from 'crypto';
import { AuthService } from '../auth/auth.service';
import type { AuthRequest } from '../auth/auth.types';

const matchesSecret = (expected: string, provided: string | null) => {
  if (!provided) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
};

@Injectable()
export class SystemTenantAccessGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const headerValue = request.headers?.['x-api-key'];
    const providedSecret = Array.isArray(headerValue)
      ? headerValue[0]?.trim() || null
      : headerValue?.trim() || null;

    if (providedSecret) {
      const expectedSecret = process.env.N8N_WEBHOOK_SECRET?.trim() || null;

      if (!expectedSecret) {
        throw new ServiceUnavailableException({
          code: 'N8N_WEBHOOK_SECRET_MISSING',
          message: 'The n8n webhook secret is not configured.',
        });
      }

      if (!matchesSecret(expectedSecret, providedSecret)) {
        throw new UnauthorizedException({
          code: 'SYSTEM_API_KEY_INVALID',
          message: 'The provided system API key is invalid.',
        });
      }

      return true;
    }

    const sessionToken = this.authService.readSessionTokenFromRequest(request);

    if (!sessionToken) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'A valid authenticated session is required.',
      });
    }

    const user = await this.authService.resolveAuthenticatedUser(sessionToken);

    if (!user) {
      throw new UnauthorizedException({
        code: 'SESSION_INVALID',
        message: 'The current session is missing, expired or invalid.',
      });
    }

    if (user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException({
        code: 'SUPER_ADMIN_REQUIRED',
        message: 'This system endpoint requires a super admin session.',
      });
    }

    request.authUser = user;
    request.authSessionToken = sessionToken;

    return true;
  }
}
