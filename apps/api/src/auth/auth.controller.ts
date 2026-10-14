import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { randomBytes } from 'crypto';
import { Throttle } from '@nestjs/throttler';
import { Public, CurrentAuth, CurrentActor } from '../common/decorators';
import type { Actor, AppRequest, AuthContext } from '../common/types/request-context.types';
import { AuthService } from './auth.service';
import { AcceptInvitationDto, LoginDto, RegisterDto, RequestPasswordResetDto, ResetPasswordDto, VerifyEmailDto } from './dto/auth.dto';
import { DomainException } from '../common/errors/domain.exception';
import { APP_CONFIG } from '../config/config.module';
import type { AppEnv } from '../config/env';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppEnv,
  ) {}

  @Public()
  @Get('csrf')
  getCsrfToken(@Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    let token = req.cookies?.['csrf_token'];
    if (!token || typeof token !== 'string' || token.length < 16) {
      token = randomBytes(24).toString('hex');
      res.cookie('csrf_token', token, {
        httpOnly: false, // Must be readable by client JS to attach in x-csrf-token header
        secure: this.config.cookieSecure,
        sameSite: 'lax',
        path: '/',
        maxAge: this.config.REFRESH_TOKEN_TTL_DAYS * 86400 * 1000,
      });
    }
    return { csrfToken: token };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @CurrentActor() actor: Actor,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.register(dto, actor);
    this.setAuthCookies(res, session.accessToken, session.refreshToken);
    return this.sessionBody(req, session);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @CurrentActor() actor: Actor,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.login(dto, actor);
    this.setAuthCookies(res, session.accessToken, session.refreshToken);
    return this.sessionBody(req, session);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: AppRequest,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') bodyRefresh?: string,
  ) {
    // Browsers must use the HttpOnly cookie; only non-browser API clients may send it in the body.
    const token = req.cookies?.['refresh_token'] || (this.isApiClient(req) ? bodyRefresh : undefined);
    if (!token) {
      throw new DomainException('AUTH_REQUIRED', 'Refresh token required');
    }
    const session = await this.auth.refreshSession(token, actor);
    this.setAuthCookies(res, session.accessToken, session.refreshToken);
    return this.sessionBody(req, session);
  }

  /**
   * Public so a user whose access token has expired can still sign out: the session is
   * identified from the access token if valid, otherwise from the refresh cookie.
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: AppRequest,
    @CurrentActor() actor: Actor,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(req.auth?.sessionId ?? null, req.cookies?.['refresh_token'] ?? null, actor);
    this.clearAuthCookies(res);
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: RequestPasswordResetDto, @CurrentActor() actor: Actor) {
    await this.auth.requestPasswordReset(dto.email, actor);
    return { success: true, message: 'If the email exists, instructions have been sent.' };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
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

  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@CurrentAuth() auth: AuthContext, @CurrentActor() actor: Actor) {
    await this.auth.resendVerificationEmail(auth.userId, actor);
    return { success: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('accept-invitation')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @CurrentActor() actor: Actor,
    @Req() req: AppRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.acceptInvitation(dto, actor);
    this.setAuthCookies(res, session.accessToken, session.refreshToken);
    return this.sessionBody(req, session);
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

  /**
   * Browser sessions live only in HttpOnly cookies, so the access token is not echoed
   * in the response body. Non-browser API clients (no Origin header) still receive it
   * so they can use Bearer authentication.
   */
  private sessionBody(req: AppRequest, session: { user: unknown; expiresInSeconds: number; accessToken: string }) {
    return {
      user: session.user,
      expiresInSeconds: session.expiresInSeconds,
      ...(this.isApiClient(req) ? { accessToken: session.accessToken } : {}),
    };
  }

  private isApiClient(req: AppRequest): boolean {
    return !req.header('origin');
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string | null) {
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: this.config.ACCESS_TOKEN_TTL_SECONDS * 1000,
    });
    if (refreshToken) {
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: this.config.cookieSecure,
        sameSite: 'lax',
        path: '/api/v1/auth',
        maxAge: this.config.REFRESH_TOKEN_TTL_DAYS * 86400 * 1000,
      });
    }
    // Set double-submit CSRF cookie (accessible to frontend JS)
    const csrfToken = randomBytes(24).toString('hex');
    res.cookie('csrf_token', csrfToken, {
      httpOnly: false,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: this.config.REFRESH_TOKEN_TTL_DAYS * 86400 * 1000,
    });
  }

  private clearAuthCookies(res: Response) {
    const opts = { secure: this.config.cookieSecure, sameSite: 'lax' as const };
    res.clearCookie('access_token', { ...opts, path: '/' });
    res.clearCookie('refresh_token', { ...opts, path: '/api/v1/auth' });
    res.clearCookie('csrf_token', { ...opts, path: '/' });
  }
}
