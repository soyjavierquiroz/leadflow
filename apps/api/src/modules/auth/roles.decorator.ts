import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { SessionAuthGuard } from './session-auth.guard';

export const ROLES_KEY = 'leadflow:roles';
export const ACTIVE_TEAM_ADMIN_MEMBER_ACCESS_KEY =
  'leadflow:active-team-admin-member-access';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const RequireAuth = () => applyDecorators(UseGuards(SessionAuthGuard));

export const RequireRoles = (...roles: UserRole[]) =>
  applyDecorators(Roles(...roles), UseGuards(SessionAuthGuard, RolesGuard));

export const RequireOperationalMemberAccess = () =>
  applyDecorators(
    Roles(UserRole.MEMBER),
    SetMetadata(ACTIVE_TEAM_ADMIN_MEMBER_ACCESS_KEY, true),
    UseGuards(SessionAuthGuard, RolesGuard),
  );
