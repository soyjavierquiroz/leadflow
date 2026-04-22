import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import {
  ACTIVE_TEAM_ADMIN_MEMBER_ACCESS_KEY,
  ROLES_KEY,
} from './roles.decorator';

describe('RolesGuard', () => {
  const buildContext = (request: Record<string, unknown>): ExecutionContext =>
    ({
      getHandler: () => 'handler',
      getClass: () => 'class',
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as ExecutionContext;

  it('allows active team admins on operational member routes', () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === ROLES_KEY) {
          return [UserRole.MEMBER];
        }

        if (key === ACTIVE_TEAM_ADMIN_MEMBER_ACCESS_KEY) {
          return true;
        }

        return undefined;
      }),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    const canActivate = guard.canActivate(
      buildContext({
        authUser: {
          role: UserRole.TEAM_ADMIN,
          sponsor: {
            isActive: true,
          },
        },
      }),
    );

    expect(canActivate).toBe(true);
  });

  it('rejects inactive team admins on operational member routes', () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === ROLES_KEY) {
          return [UserRole.MEMBER];
        }

        if (key === ACTIVE_TEAM_ADMIN_MEMBER_ACCESS_KEY) {
          return true;
        }

        return undefined;
      }),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() =>
      guard.canActivate(
        buildContext({
          authUser: {
            role: UserRole.TEAM_ADMIN,
            sponsor: {
              isActive: false,
            },
          },
        }),
      ),
    ).toThrow(ForbiddenException);
  });
});
