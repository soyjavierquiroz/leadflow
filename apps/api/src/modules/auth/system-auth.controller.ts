import { Controller, Param, Post, Req, Res } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { FastifyReply } from 'fastify';
import { CurrentAuthUser } from './current-auth-user.decorator';
import { AuthService } from './auth.service';
import type { AuthRequest, AuthenticatedUser } from './auth.types';
import { RequireRoles } from './roles.decorator';

@Controller('system/auth')
export class SystemAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('impersonate/:targetUserId')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async impersonate(
    @Param('targetUserId') targetUserId: string,
    @CurrentAuthUser() impersonator: AuthenticatedUser,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.impersonate({
      targetUserId,
      impersonator,
      userAgent: request.headers['user-agent'] ?? null,
      ipAddress: request.ip ?? null,
    });

    this.authService.setSessionCookie(reply, result.sessionToken);

    return {
      success: true,
      message: 'Impersonation session started successfully.',
      redirectPath: result.user.homePath,
      user: result.user,
    };
  }
}
