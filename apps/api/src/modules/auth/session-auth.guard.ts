import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthRequest } from './auth.types';
import { AuthService } from './auth.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
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

    request.authUser = user;
    request.authSessionToken = sessionToken;

    return true;
  }
}
