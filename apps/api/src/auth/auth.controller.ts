import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public, CurrentAuth, CurrentActor } from '../common/decorators';
import type { Actor, AppRequest, AuthContext } from '../common/types/request-context.types';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RequestPasswordResetDto, ResetPasswordDto, VerifyEmailDto } from './dto/auth.dto';
import { DomainException } from '../common/errors/domain.exception';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.register(dto, actor);
    this.setAuthCookies(res, session.accessToken, session.refreshToken);
    return session;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.login(dto, actor);
    this.setAuthCookies(res, session.accessToken, session.refreshToken);
    return session;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: AppRequest,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyRefresh?: string,
  ) {
    const token = bodyRefresh || req.cookies?.['refresh_token'];
    if (!token) {
      throw new DomainException('AUTH_REQUIRED', 'Refresh token required');
    }
    const session = await this.auth.refreshSession(token, actor);
    this.setAuthCookies(res, session.accessToken, session.refreshToken);
    return session;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentAuth() auth: AuthContext,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(auth.sessionId, actor);
    this.clearAuthCookies(res);
    return { success: true };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: RequestPasswordResetDto, @CurrentActor() actor: Actor) {
    await this.auth.requestPasswordReset(dto.email, actor);
    return { success: true, message: 'If the email exists, instructions have been sent.' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto, @CurrentActor() actor: Actor) {
    await this.auth.resetPassword(dto, actor);
    return { success: true };
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto, @CurrentActor() actor: Actor) {
    await this.auth.verifyEmail(dto.token, actor);
    return { success: true };
  }

  @Get('me')
  async me(@CurrentAuth() auth: AuthContext) {
    return this.auth.getCurrentUser(auth.userId);
  }

  @Get('sessions')
  async sessions(@CurrentAuth() auth: AuthContext) {
    return this.auth.getUserSessions(auth.userId);
  }

  @Post('sessions/:id/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAuth() auth: AuthContext,
    @CurrentActor() actor: Actor,
  ) {
    await this.auth.revokeSession(id, auth.userId, actor);
    return { success: true };
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true' || process.env.APP_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 900 * 1000,
    });
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true' || process.env.APP_ENV === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 14 * 86400 * 1000,
    });
  }

  private clearAuthCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
  }
}
