import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  parentOtpRequestSchema,
  parentOtpVerifySchema,
  wechatBindPhoneSchema,
  wechatCodeLoginSchema,
  passwordLoginSchema,
  secondFactorSchema,
  switchConsumerIdentitySchema,
} from '@budstar/contracts';
import { AuditService } from '../audit/audit.service';
import { Public } from '../authorization/authorization.decorators';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import { ApiException } from '../http/api-error';
import { AuthenticationService } from './authentication.service';

@Controller('auth')
export class AuthenticationController {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly audit: AuditService,
  ) {}

  @Post('parent/request-otp')
  @Public()
  requestParentOtp(@Body() body: unknown) {
    const input = this.parse(parentOtpRequestSchema, body);
    return this.authentication.requestParentOtp(input.phone);
  }

  @Post('parent/verify-otp')
  @Public()
  async verifyParentOtp(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = this.parse(parentOtpVerifySchema, body);
    const session = await this.withLoginAudit(() =>
      this.authentication.verifyParentOtp(input.phone, input.code),
    );
    return this.attachRefreshCookie(response, session);
  }

  @Post('student/login')
  @Public()
  async loginStudent(@Body() body: unknown) {
    const input = this.parse(passwordLoginSchema, body);
    await this.withLoginAudit(() =>
      this.authentication.loginStudent(input.loginIdentifier),
    );
    return { ok: true };
  }

  @Post('consumer/switch-identity')
  async switchConsumerIdentity(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = this.parse(switchConsumerIdentitySchema, body);
    const session = await this.authentication.switchConsumerIdentity(
      this.bearerToken(request),
      input.identity,
    );
    const { refreshTokenForCookie, ...publicSession } = session;
    void refreshTokenForCookie;
    return publicSession;
  }

  @Post('staff/login')
  @Public()
  async loginStaff(@Body() body: unknown) {
    const input = this.parse(passwordLoginSchema, body);
    return this.withLoginAudit(
      () =>
        this.authentication.beginPrivilegedLogin(
          input.loginIdentifier,
          input.password,
          'staff',
        ),
      false,
    );
  }

  @Post('staff/verify-second-factor')
  @Public()
  verifyStaffSecondFactor(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.completeSecondFactor(body, 'staff', response);
  }

  @Post('platform/login')
  @Public()
  async loginPlatformAdmin(@Body() body: unknown) {
    const input = this.parse(passwordLoginSchema, body);
    return this.withLoginAudit(
      () =>
        this.authentication.beginPrivilegedLogin(
          input.loginIdentifier,
          input.password,
          'platform-admin',
        ),
      false,
    );
  }

  @Post('wechat/login')
  @Public()
  async loginWechat(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = this.parse(wechatCodeLoginSchema, body);
    return this.withLoginAudit(
      () => this.authentication.loginWechat(input.code),
      false,
    );
  }

  @Post('wechat/bind-phone')
  async bindWechatPhone(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = this.parse(wechatBindPhoneSchema, body);
    return this.authentication.bindWechatPhone(
      request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '',
      input.code,
    );
  }

  @Post('partner/login')
  @Public()
  async loginPartner(@Body() body: unknown) {
    const input = this.parse(passwordLoginSchema, body);
    return this.withLoginAudit(
      () =>
        this.authentication.beginPrivilegedLogin(
          input.loginIdentifier,
          input.password,
          'partner',
        ),
      false,
    );
  }

  @Post('partner/verify-second-factor')
  @Public()
  verifyPartnerSecondFactor(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.completeSecondFactor(body, 'partner', response);
  }

  @Post('platform/verify-second-factor')
  @Public()
  verifyPlatformSecondFactor(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.completeSecondFactor(body, 'platform-admin', response);
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    const token = this.refreshCookie(request);
    const session = await this.authentication.refresh(token);
    return this.attachRefreshCookie(response, session);
  }

  @Post('logout')
  @Public()
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request);
    try {
      await this.authentication.revokeSessionByRefreshToken(
        this.refreshCookie(request),
      );
    } finally {
      this.clearRefreshCookie(response);
    }
    return { revoked: true };
  }

  @Get('session')
  async session(@Req() request: AuthenticatedRequest) {
    return this.authentication.restore(this.bearerToken(request));
  }

  private async completeSecondFactor(
    body: unknown,
    kind: 'staff' | 'partner' | 'platform-admin',
    response: Response,
  ) {
    const input = this.parse(secondFactorSchema, body);
    const session = await this.withLoginAudit(() =>
      this.authentication.completePrivilegedLogin(
        input.challengeToken,
        input.code,
        kind,
      ),
    );
    return this.attachRefreshCookie(response, session);
  }

  private async withLoginAudit<T>(
    action: () => T | Promise<T>,
    successIsLogin = true,
  ): Promise<T> {
    try {
      const result = await action();
      const actor =
        typeof result === 'object' &&
        result !== null &&
        'actor' in result &&
        typeof result.actor === 'object' &&
        result.actor !== null &&
        'userAccountId' in result.actor &&
        typeof result.actor.userAccountId === 'string'
          ? result.actor
          : undefined;
      if (successIsLogin && actor) {
        const actorAccountId = actor.userAccountId as string;
        await this.recordAuditSafely(() =>
          this.audit.recordLocalLoginSuccess({ actorAccountId }),
        );
      }
      return result;
    } catch (error) {
      await this.recordAuditSafely(() =>
        this.audit.record({ action: 'AUTH_LOGIN_FAILED' }),
      );
      throw error;
    }
  }

  private async recordAuditSafely(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch {
      // The authentication result is authoritative. Production successful-login
      // audit is committed atomically with the session by the repository.
    }
  }

  private assertTrustedOrigin(request: AuthenticatedRequest): void {
    const origin = request.headers.origin;
    if (!origin) return;
    const allowed = (
      process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3002'
    )
      .split(',')
      .map((value) => value.trim());
    if (!allowed.includes(origin)) {
      throw new ApiException(403, 'FORBIDDEN', '请求来源不受信任');
    }
  }

  private attachRefreshCookie<T extends { refreshTokenForCookie: string }>(
    response: Response,
    session: T,
  ): Omit<T, 'refreshTokenForCookie'> {
    response.cookie('budstar_refresh', session.refreshTokenForCookie, {
      httpOnly: true,
      secure: this.secureCookies(),
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 30 * 24 * 60 * 60_000,
    });
    const { refreshTokenForCookie, ...publicSession } = session;
    void refreshTokenForCookie;
    return publicSession;
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie('budstar_refresh', {
      httpOnly: true,
      secure: this.secureCookies(),
      sameSite: 'strict',
      path: '/api/auth',
    });
  }

  private secureCookies(): boolean {
    const configured = process.env.REFRESH_COOKIE_SECURE;
    return configured === undefined
      ? process.env.NODE_ENV === 'production'
      : configured === 'true';
  }

  private refreshCookie(request: AuthenticatedRequest): string {
    const header = request.headers.cookie ?? '';
    const match = header
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('budstar_refresh='));
    if (!match) throw new ApiException(401, 'UNAUTHORIZED', '请先完成身份验证');
    return decodeURIComponent(match.slice('budstar_refresh='.length));
  }

  private bearerToken(request: AuthenticatedRequest): string {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      throw new ApiException(401, 'UNAUTHORIZED', '请先完成身份验证');
    }
    return authorization.slice('Bearer '.length);
  }

  private parse<T>(
    schema: {
      safeParse(input: unknown):
        | { success: true; data: T }
        | {
            success: false;
            error: {
              issues: Array<{
                path: PropertyKey[];
                code: string;
              }>;
            };
          };
    },
    body: unknown,
  ): T {
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new ApiException(
        400,
        'VALIDATION_ERROR',
        '请求参数不合法',
        result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          code: issue.code,
        })),
      );
    }
    return result.data;
  }
}
