import { Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import type {
  AuthenticatedSession,
  AuthenticationChallenge,
  ConsumerIdentity,
  StaffRole,
} from '@budstar/contracts';
import { ApiException } from '../http/api-error';
import type { AuthorizationActor } from '../authorization/campus-authorization.policy';
import { type AuthenticationAdapters } from './authentication-boundaries';
import {
  AUTHENTICATION_SESSION_REPOSITORY,
  type AuthenticationSessionRepository,
} from './authentication-session.repository';
import {
  AUTHENTICATION_STATE_REPOSITORY,
  type AuthenticationStateRepository,
} from './authentication-state.repository';
import { AUTHENTICATION_ADAPTERS } from './authentication.tokens';
import {
  PARENT_BINDING_LOOKUP,
  type ParentBindingLookup,
} from './parent-binding.lookup';

type Account = {
  id: string;
  kind: AuthorizationActor['kind'];
  loginIdentifier: string;
  password?: string;
  displayName: string;
  status: 'ACTIVE' | 'SUSPENDED';
  memberships?: Array<{
    campusId: string;
    campusName: string;
    roles: StaffRole[];
  }>;
  parentProfileId?: string;
  studentProfileId?: string;
  activeIdentity?: ConsumerIdentity;
  activeStudentBindings?: string[];
};

/** Local/dev fixtures when LOCAL_AUTH_ACCOUNTS_JSON is unset. Never used in production. */
const DEFAULT_LOCAL_AUTH_ACCOUNTS: Account[] = [
  {
    id: 'staff-local',
    kind: 'staff',
    loginIdentifier: 'staff@local',
    password: 'Password123!',
    displayName: '本地教务',
    status: 'ACTIVE',
    memberships: [
      {
        campusId: 'shenzhen-nanshan',
        campusName: '深圳南山校区',
        roles: ['TEACHER'],
      },
    ],
  },
  {
    id: 'partner-local',
    kind: 'partner',
    loginIdentifier: 'partner@local',
    password: 'Partner123!',
    displayName: '本地合作方',
    status: 'ACTIVE',
  },
  {
    id: 'platform-local',
    kind: 'platform-admin',
    loginIdentifier: 'platform@local',
    password: 'Platform123!',
    displayName: '本地平台管理员',
    status: 'ACTIVE',
  },
  {
    id: 'student-local',
    kind: 'student',
    loginIdentifier: 'student@local',
    password: 'Student123!',
    displayName: '本地学生',
    status: 'ACTIVE',
    parentProfileId: 'parent-profile-local',
    studentProfileId: 'student-profile-local',
    activeIdentity: 'student',
  },
];

type AccessPayload = {
  sub: string;
  sid: string;
  exp: number;
  type: 'access';
  aid?: ConsumerIdentity;
};

export type IssuedAuthenticatedSession = AuthenticatedSession & {
  refreshTokenForCookie: string;
};

@Injectable()
export class AuthenticationService {
  private readonly accounts = new Map<string, Account>();
  private readonly tokenSecret: string;

  constructor(
    @Inject(AUTHENTICATION_ADAPTERS)
    private readonly adapters: AuthenticationAdapters,
    @Inject(AUTHENTICATION_SESSION_REPOSITORY)
    private readonly sessions: AuthenticationSessionRepository,
    @Inject(AUTHENTICATION_STATE_REPOSITORY)
    private readonly authenticationState: AuthenticationStateRepository,
    private readonly moduleRef: ModuleRef,
  ) {
    const configuredSecret = process.env.AUTH_TOKEN_SECRET;
    if (process.env.NODE_ENV === 'production' && !configuredSecret) {
      throw new Error('AUTH_TOKEN_SECRET is required in production');
    }
    this.tokenSecret =
      configuredSecret ?? 'local-test-secret-do-not-use-in-production';
    for (const account of this.localAccountsFromEnvironment()) {
      this.accounts.set(account.id, account);
    }
  }

  async requestParentOtp(phone: string): Promise<{ sent: true }> {
    await this.assertAttemptAllowed(`otp-request:${phone}`, 5, 5 * 60_000);
    const code =
      process.env.NODE_ENV === 'production'
        ? String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
        : process.env.LOCAL_VERIFICATION_CODE!;
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    await this.adapters.verificationCodeStore.issue(phone, code, expiresAt);
    await this.adapters.verificationCodeSender.send(phone, code);
    return { sent: true };
  }

  async verifyParentOtp(
    phone: string,
    code: string,
  ): Promise<IssuedAuthenticatedSession> {
    await this.assertAttemptAllowed(`otp-verify:${phone}`, 5, 5 * 60_000);
    if (
      !(await this.adapters.verificationCodeStore.consume(
        phone,
        code,
        new Date(),
      ))
    ) {
      throw this.unauthorized();
    }
    const accountId = `parent-${this.digest(phone).slice(0, 24)}`;
    if (!this.accounts.has(accountId)) {
      this.accounts.set(accountId, {
        id: accountId,
        kind: 'parent',
        loginIdentifier: `phone:${this.digest(phone)}`,
        displayName: '家长用户',
        status: 'ACTIVE',
        parentProfileId: randomUUID(),
        studentProfileId: randomUUID(),
        activeIdentity: 'parent',
        activeStudentBindings: [],
      });
    }
    const account = this.requireActive(accountId);
    account.activeIdentity = 'parent';
    if (!account.parentProfileId) {
      account.parentProfileId = randomUUID();
    }
    if (!account.studentProfileId) {
      account.studentProfileId = randomUUID();
    }
    return this.issueSession(account);
  }

  /**
   * ADR-0007：家庭视图合并后学生不再独立登录；
   * 学生档案保留为纯业务数据，由家长在家庭视图内切换选择。
   */
  async loginStudent(loginIdentifier: string): Promise<never> {
    await this.assertAttemptAllowed(
      `password:student:${loginIdentifier}`,
      5,
      5 * 60_000,
    );
    throw new ApiException(
      403,
      'STUDENT_LOGIN_DISABLED',
      '学生账号已停用：请在家庭视图内以家长身份登录，并切换学生档案',
    );
  }

  async switchConsumerIdentity(
    accessToken: string,
    identity: ConsumerIdentity,
  ): Promise<IssuedAuthenticatedSession> {
    const payload = this.verifyAccessToken(accessToken);
    const account = this.requireActive(payload.sub);
    if (!(await this.sessions.isActive(payload.sid, payload.sub, new Date()))) {
      throw this.unauthorized();
    }
    if (account.kind !== 'parent') {
      throw new ApiException(403, 'FORBIDDEN', '仅消费端账号可切换身份');
    }
    if (identity === 'student') {
      // ADR-0007：学生是家庭视图内的档案切换，不是登录身份。
      throw new ApiException(
        403,
        'STUDENT_LOGIN_DISABLED',
        '学生账号已停用：请在家庭视图内切换学生档案',
      );
    }
    if (!account.parentProfileId) {
      account.parentProfileId = randomUUID();
    }
    account.activeIdentity = 'parent';
    return this.reissueAccessToken(account, payload.sid);
  }

  async beginPrivilegedLogin(
    loginIdentifier: string,
    password: string,
    kind: 'staff' | 'partner' | 'platform-admin',
  ): Promise<AuthenticationChallenge> {
    await this.assertAttemptAllowed(
      `password:${kind}:${loginIdentifier}`,
      5,
      5 * 60_000,
    );
    const account = this.verifyPassword(loginIdentifier, password, kind);
    const challengeToken = this.randomToken();
    await this.authenticationState.createChallenge({
      tokenHash: this.digest(challengeToken),
      accountId: account.id,
      intendedKind: kind,
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });
    return { challengeToken, secondFactorRequired: true };
  }

  async completePrivilegedLogin(
    challengeToken: string,
    code: string,
    kind: 'staff' | 'partner' | 'platform-admin',
  ): Promise<IssuedAuthenticatedSession> {
    const challengeHash = this.digest(challengeToken);
    const challenge = await this.authenticationState.attemptChallenge(
      challengeHash,
      kind,
      new Date(Date.now()),
      5,
    );
    if (challenge.status === 'invalid') throw this.unauthorized();
    if (challenge.status === 'rate-limited') throw this.rateLimited();
    const account = this.requireActive(challenge.accountId);
    if (!(await this.adapters.secondFactorVerifier.verify(account.id, code))) {
      throw this.unauthorized();
    }
    await this.authenticationState.completeChallenge(challengeHash);
    return this.issueSession(account);
  }

  async refresh(refreshToken: string): Promise<IssuedAuthenticatedSession> {
    const nextRefreshToken = this.randomToken();
    const result = await this.sessions.rotate(
      this.digest(refreshToken),
      {
        id: randomUUID(),
        tokenHash: this.digest(nextRefreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
      },
      new Date(),
    );
    if (result.status !== 'rotated') {
      throw this.unauthorized();
    }
    return this.issueSession(
      this.requireActive(result.accountId),
      result.sessionId,
      nextRefreshToken,
    );
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.sessions.revokeSession(sessionId, new Date());
  }

  async revokeSessionByRefreshToken(refreshToken: string): Promise<void> {
    await this.sessions.revokeByRefreshToken(
      this.digest(refreshToken),
      new Date(),
    );
  }

  async authenticate(accessToken: string): Promise<{
    account: Account;
    actor: AuthorizationActor;
    sessionId: string;
  }> {
    const payload = this.verifyAccessToken(accessToken);
    const account = this.requireActive(payload.sub);
    if (!(await this.sessions.isActive(payload.sid, payload.sub, new Date()))) {
      throw this.unauthorized();
    }
    if (payload.aid) {
      account.activeIdentity = payload.aid;
    }
    await this.refreshParentBindings(account);
    return {
      account,
      actor: this.toActor(account),
      sessionId: payload.sid,
    };
  }

  async restore(accessToken: string): Promise<AuthenticatedSession> {
    const payload = this.verifyAccessToken(accessToken);
    const { account } = await this.authenticate(accessToken);
    return this.sessionView(
      account,
      accessToken,
      new Date(payload.exp).toISOString(),
    );
  }

  setAccountStatusForTesting(
    accountId: string,
    status: Account['status'],
  ): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Account fixture mutation is test-only');
    }
    const account = this.accounts.get(accountId);
    if (!account) throw new Error('Unknown test account');
    account.status = status;
  }

  syncActiveStudentBindings(
    userAccountId: string,
    studentProfileIds: string[],
  ): void {
    const account = this.accounts.get(userAccountId);
    if (!account || !account.parentProfileId) return;
    account.activeStudentBindings = [...studentProfileIds];
  }

  private async refreshParentBindings(account: Account): Promise<void> {
    if (
      this.resolveActiveIdentity(account) !== 'parent' ||
      !account.parentProfileId
    ) {
      return;
    }
    let lookup: ParentBindingLookup | undefined;
    try {
      lookup = this.moduleRef.get<ParentBindingLookup>(PARENT_BINDING_LOOKUP, {
        strict: false,
      });
    } catch {
      lookup = undefined;
    }
    if (!lookup) return;
    try {
      account.activeStudentBindings = await lookup.listActiveStudentIds(
        account.parentProfileId,
      );
    } catch {
      // Local/dev may boot before DB is ready; keep auth usable.
      account.activeStudentBindings = account.activeStudentBindings ?? [];
    }
  }

  private verifyPassword(
    loginIdentifier: string,
    password: string,
    kind: Account['kind'],
  ): Account {
    const account = [...this.accounts.values()].find(
      (candidate) =>
        candidate.loginIdentifier === loginIdentifier &&
        candidate.kind === kind,
    );
    const actual = Buffer.from(this.digest(password));
    const expected = Buffer.from(
      this.digest(account?.password ?? 'invalid-secret'),
    );
    if (!account || !timingSafeEqual(actual, expected)) {
      throw this.unauthorized();
    }
    return this.requireActive(account.id);
  }

  private requireActive(accountId: string): Account {
    const account = this.accounts.get(accountId);
    if (!account) throw this.unauthorized();
    if (account.status === 'SUSPENDED') {
      throw new ApiException(403, 'FORBIDDEN', '账号已停用');
    }
    return account;
  }

  private async issueSession(
    account: Account,
    sessionId: string = randomUUID(),
    refreshToken: string = this.randomToken(),
  ): Promise<IssuedAuthenticatedSession> {
    const now = Date.now();
    const accessExpiresAt = now + 15 * 60_000;
    const activeIdentity = this.resolveActiveIdentity(account);
    const accessToken = this.sign({
      sub: account.id,
      sid: sessionId,
      exp: accessExpiresAt,
      type: 'access',
      aid: activeIdentity,
    });
    if (arguments.length < 3) {
      await this.sessions.create({
        accountId: account.id,
        familyId: randomUUID(),
        sessionId,
        tokenHash: this.digest(refreshToken),
        expiresAt: new Date(now + 30 * 24 * 60 * 60_000),
        auditLogin: true,
      });
    }
    const session = this.sessionView(
      account,
      accessToken,
      new Date(accessExpiresAt).toISOString(),
    );
    return Object.assign(session, {
      refreshTokenForCookie: refreshToken,
    });
  }

  private reissueAccessToken(
    account: Account,
    sessionId: string,
  ): IssuedAuthenticatedSession {
    const now = Date.now();
    const accessExpiresAt = now + 15 * 60_000;
    const activeIdentity = this.resolveActiveIdentity(account);
    const accessToken = this.sign({
      sub: account.id,
      sid: sessionId,
      exp: accessExpiresAt,
      type: 'access',
      aid: activeIdentity,
    });
    const session = this.sessionView(
      account,
      accessToken,
      new Date(accessExpiresAt).toISOString(),
    );
    return Object.assign(session, {
      refreshTokenForCookie: '',
    });
  }

  private sessionView(
    account: Account,
    accessToken: string,
    accessTokenExpiresAt: string,
  ): AuthenticatedSession {
    const availableIdentities = this.availableIdentities(account);
    const activeIdentity = this.resolveActiveIdentity(account);
    return {
      accessToken,
      accessTokenExpiresAt,
      actor: {
        kind: activeIdentity ?? account.kind,
        userAccountId: account.id,
        displayName:
          activeIdentity === 'student'
            ? account.kind === 'student'
              ? account.displayName
              : '学生用户'
            : account.displayName,
      },
      availableIdentities,
      activeIdentity,
      campuses:
        account.memberships?.map(({ campusId, campusName, roles }) => ({
          id: campusId,
          name: campusName,
          roles,
        })) ?? [],
    };
  }

  private availableIdentities(
    account: Account,
  ): ConsumerIdentity[] | undefined {
    if (
      account.kind === 'staff' ||
      account.kind === 'platform-admin' ||
      account.kind === 'partner'
    ) {
      return undefined;
    }
    // ADR-0007：家长是唯一的消费端登录身份；学生通过档案切换进入。
    return ['parent'];
  }

  private resolveActiveIdentity(
    account: Account,
  ): ConsumerIdentity | undefined {
    if (
      account.kind === 'staff' ||
      account.kind === 'platform-admin' ||
      account.kind === 'partner'
    ) {
      return undefined;
    }
    const available = this.availableIdentities(account) ?? [];
    if (account.activeIdentity && available.includes(account.activeIdentity)) {
      return account.activeIdentity;
    }
    return 'parent';
  }

  private toActor(account: Account): AuthorizationActor {
    if (account.kind === 'staff') {
      return {
        kind: 'staff',
        userAccountId: account.id,
        memberships:
          account.memberships?.map(({ campusId, roles }) => ({
            campusId,
            roles,
          })) ?? [],
      };
    }
    if (account.kind === 'platform-admin') {
      return {
        kind: 'platform-admin',
        userAccountId: account.id,
        capabilities: [
          'PLATFORM_CAMPUS_GOVERN',
          'PLATFORM_COURSE_VERSION_GOVERN',
          'PLATFORM_CRM_OPERATE',
        ],
      };
    }
    if (account.kind === 'partner') {
      return { kind: 'partner', userAccountId: account.id };
    }
    const activeIdentity = this.resolveActiveIdentity(account);
    if (activeIdentity === 'parent') {
      return {
        kind: 'parent',
        userAccountId: account.id,
        parentProfileId: account.parentProfileId!,
        activeStudentBindings: account.activeStudentBindings ?? [],
      };
    }
    return {
      kind: 'student',
      userAccountId: account.id,
      studentProfileId: account.studentProfileId!,
    };
  }

  private sign(payload: AccessPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.digest(encoded)}`;
  }

  private verifyAccessToken(token: string): AccessPayload {
    const [encoded, signature, extra] = token.split('.');
    if (!encoded || !signature || extra) throw this.unauthorized();
    const actual = Buffer.from(signature);
    const expected = Buffer.from(this.digest(encoded));
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw this.unauthorized();
    }
    try {
      const payload = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8'),
      ) as AccessPayload;
      if (
        payload.type !== 'access' ||
        !payload.sub ||
        !payload.sid ||
        payload.exp <= Date.now()
      ) {
        throw this.unauthorized();
      }
      return payload;
    } catch {
      throw this.unauthorized();
    }
  }

  private digest(value: string): string {
    return createHmac('sha256', this.tokenSecret).update(value).digest('hex');
  }

  private randomToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private async assertAttemptAllowed(
    key: string,
    maximum: number,
    windowMs: number,
  ): Promise<void> {
    const allowed = await this.authenticationState.consumeRateLimit(
      this.digest(key),
      new Date(Date.now()),
      windowMs,
      maximum,
    );
    if (!allowed) throw this.rateLimited();
  }

  private localAccountsFromEnvironment(): Account[] {
    if (process.env.NODE_ENV === 'production') return [];
    const raw = process.env.LOCAL_AUTH_ACCOUNTS_JSON;
    const parsed = JSON.parse(
      raw ?? JSON.stringify(DEFAULT_LOCAL_AUTH_ACCOUNTS),
    ) as Account[];
    return parsed.map((account) => ({
      ...account,
      activeStudentBindings: account.activeStudentBindings ?? [],
    }));
  }

  private unauthorized(): ApiException {
    return new ApiException(401, 'UNAUTHORIZED', '请先完成身份验证');
  }

  private rateLimited(): ApiException {
    return new ApiException(429, 'RATE_LIMITED', '请求过于频繁，请稍后再试');
  }
}
