import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import {
  ACTIVE_TEAM_ADMIN_MEMBER_ACCESS_KEY,
  ROLES_KEY,
} from './roles.decorator';
import type { AuthRequest } from './auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const allowedRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const allowActiveTeamAdminMemberAccess =
      this.reflector.getAllAndOverride<boolean>(
        ACTIVE_TEAM_ADMIN_MEMBER_ACCESS_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? false;

    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const authUser = request.authUser;
    const currentRole = authUser?.role;

    if (currentRole && allowedRoles.includes(currentRole)) {
      return true;
    }

    if (
      allowActiveTeamAdminMemberAccess &&
      currentRole === UserRole.TEAM_ADMIN &&
      authUser?.sponsor?.isActive
    ) {
      return true;
    }

    if (!currentRole) {
      throw new ForbiddenException({
        code: 'ROLE_NOT_ALLOWED',
        message: 'The current role is not allowed to access this resource.',
      });
    }

    throw new ForbiddenException({
      code: 'ROLE_NOT_ALLOWED',
      message: 'The current role is not allowed to access this resource.',
    });
  }
}
