import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { AuthRequest } from './auth.types';
import { CurrentAuthUser } from './current-auth-user.decorator';
import type { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { RequireAuth } from './roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.authService.authenticate({
      email: dto.email,
      password: dto.password,
      userAgent: request.headers['user-agent'] ?? null,
      ipAddress: request.ip ?? null,
    });

    this.authService.setSessionCookie(reply, result.sessionToken);

    return {
      user: result.user,
      redirectPath: result.user.homePath,
    };
  }

  @Post('logout')
  async logout(
    @Req() request: AuthRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const sessionToken = this.authService.readSessionTokenFromRequest(request);

    await this.authService.invalidateSession(sessionToken);
    this.authService.clearSessionCookie(reply);

    return {
      success: true,
    };
  }

  @Get('me')
  @RequireAuth()
  me(@CurrentAuthUser() user: NonNullable<AuthRequest['authUser']>) {
    return {
      user,
    };
  }
}
