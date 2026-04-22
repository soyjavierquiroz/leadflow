import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import type { AuthRequest } from '../auth/auth.types';

@Injectable()
export class SystemTenantAccessGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
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
