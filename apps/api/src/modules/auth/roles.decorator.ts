import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import type { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { SessionAuthGuard } from './session-auth.guard';

export const ROLES_KEY = 'leadflow:roles';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const RequireAuth = () => applyDecorators(UseGuards(SessionAuthGuard));

export const RequireRoles = (...roles: UserRole[]) =>
  applyDecorators(Roles(...roles), UseGuards(SessionAuthGuard, RolesGuard));
