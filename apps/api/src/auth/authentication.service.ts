import fs from 'node:fs';
import path from 'node:path';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import type {
  AuthenticatedSession,
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
  CONSUMER_ACCOUNT_REPOSITORY,
  type ConsumerAccountRecord,
  type ConsumerAccountRepository,
} from './consumer-account.repository';
import {
  PARENT_BINDING_LOOKUP,
  type ParentBindingLookup,
} from './parent-binding.lookup';

type Account = {
  id: string;
  kind: AuthorizationActor['kind'];
  loginIdentifier: string;
  /** 仅本地/测试夹具使用的明文密码；生产只接受 passwordHash。 */
  password?: string;
  /** scrypt$<salt base64>$<hash base64> */
  passwordHash?: string;
  /** HMAC-SHA256(AUTH_TOKEN_SECRET, 手机号)，不存明文手机号。 */
  phoneHash?: string;
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
  wechatOpenidHash?: string;
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
    @Inject(CONSUMER_ACCOUNT_REPOSITORY)
    private readonly consumerAccounts: ConsumerAccountRepository,
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
    await this.assertAttemptAllowed(
      `otp-request:${this.digest(phone)}`,
      5,
      5 * 60_000,
    );
    await this.sendOtp(phone, this.otpDestination('parent', phone));
    return { sent: true };
  }

  private async sendOtp(phone: string, destination: string): Promise<void> {
    const code =
      process.env.NODE_ENV === 'production'
        ? String(randomInt(0, 1_000_000)).padStart(6, '0')
        : process.env.LOCAL_VERIFICATION_CODE!;
    const expiresAt = new Date(Date.now() + 5 * 60_000);
    await this.adapters.verificationCodeStore.issue(
      destination,
      code,
      expiresAt,
    );
    await this.adapters.verificationCodeSender.send(phone, code);
  }

  /** 验证码表只存手机号摘要，不落明文手机号。 */
  private otpDestination(scope: 'parent', phone: string): string {
    return `${scope}:${this.digest(phone)}`;
  }

  async verifyParentOtp(
    phone: string,
    code: string,
  ): Promise<IssuedAuthenticatedSession> {
    await this.assertAttemptAllowed(
      `otp-verify:${this.digest(phone)}`,
      5,
      5 * 60_000,
    );
    if (
      !(await this.adapters.verificationCodeStore.consume(
        this.otpDestination('parent', phone),
        code,
        new Date(),
      ))
    ) {
      throw this.unauthorized();
    }
    return this.issueSession(await this.findOrCreatePhoneAccount(phone));
  }

  /** 官网客户：平台统一分配的账号 + 密码。 */
  async loginParentWithPassword(
    username: string,
    password: string,
  ): Promise<IssuedAuthenticatedSession> {
    const normalized = username.trim().toLowerCase();
    await this.assertAttemptAllowed(
      `password:parent:${normalized}`,
      5,
      5 * 60_000,
    );
    const record = await this.consumerAccounts.findByUsername(normalized);
    const account = record ? this.cacheConsumer(record) : undefined;
    if (!account?.passwordHash || !this.passwordMatches(account, password)) {
      throw this.unauthorized();
    }
    const active = this.requireActive(account.id);
    active.activeIdentity = 'parent';
    return this.issueSession(active);
  }

  /**
   * 平台为客户分配（或重置）账号密码。按手机号关联到同一客户：
   * 客户用验证码登录或账号密码登录进入的是同一个账号。
   */
  async assignConsumerCredentials(input: {
    phone: string;
    username: string;
    password: string;
  }): Promise<{ userAccountId: string; username: string }> {
    const username = input.username.trim().toLowerCase();
    const account = await this.findOrCreatePhoneAccount(input.phone);
    const owner = await this.consumerAccounts.findByUsername(username);
    if (owner && owner.id !== account.id) {
      throw new ApiException(409, 'CONFLICT', '该账号名已被其他客户使用');
    }
    const passwordHash = this.hashPassword(input.password);
    await this.consumerAccounts.assignCredentials(
      account.id,
      username,
      passwordHash,
    );
    account.passwordHash = passwordHash;
    return { userAccountId: account.id, username };
  }

  listAssignedConsumerAccounts() {
    return this.consumerAccounts.listAssigned();
  }

  private phoneLoginIdentifier(phone: string): string {
    return `phone:${this.digest(phone)}`;
  }

  private async findOrCreatePhoneAccount(phone: string): Promise<Account> {
    const loginIdentifier = this.phoneLoginIdentifier(phone);
    const record =
      (await this.consumerAccounts.findByLoginIdentifier(loginIdentifier)) ??
      (await this.consumerAccounts.create({
        loginIdentifier,
        displayName: '家长用户',
      }));
    const account = this.requireActive(this.cacheConsumer(record).id);
    account.activeIdentity = 'parent';
    return account;
  }

  private cacheConsumer(record: ConsumerAccountRecord): Account {
    const cached = this.accounts.get(record.id);
    const account: Account = {
      id: record.id,
      kind: 'parent',
      loginIdentifier: record.loginIdentifier,
      displayName: record.displayName,
      status: record.status,
      parentProfileId: record.parentProfileId,
      passwordHash: record.passwordHash ?? undefined,
      wechatOpenidHash: record.wechatOpenidHash ?? undefined,
      activeIdentity: cached?.activeIdentity ?? 'parent',
      activeStudentBindings: cached?.activeStudentBindings ?? [],
    };
    this.accounts.set(record.id, account);
    return account;
  }

  /** 内存缓存未命中时（如服务重启后）从数据库加载消费端账号。 */
  private async loadAccount(accountId: string): Promise<Account> {
    if (!this.accounts.has(accountId)) {
      const record = await this.consumerAccounts.findById(accountId);
      if (record) this.cacheConsumer(record);
    }
    return this.requireActive(accountId);
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, 32);
    return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
  }

  /**
   * ADR-0006：微信登录为身份底座——openid 确定性建号/取号，
   * 免手机号即可浏览官网内容与提交预约线索；家庭内容需再绑定手机号。
   */
  async loginWechat(code: string): Promise<IssuedAuthenticatedSession> {
    await this.assertAttemptAllowed('wechat-login', 60, 5 * 60_000);
    const resolver = this.adapters.wechatCodeResolver;
    if (!resolver) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'WECHAT_NOT_CONFIGURED',
        '微信登录未配置',
      );
    }
    const { openid } = await resolver.code2session(code);
    const wechatOpenidHash = this.digest(openid);
    const record =
      (await this.consumerAccounts.findByWechatOpenidHash(wechatOpenidHash)) ??
      (await this.consumerAccounts.create({
        loginIdentifier: `wechat:${wechatOpenidHash}`,
        displayName: '微信用户',
        wechatOpenidHash,
      }));
    const account = this.requireActive(this.cacheConsumer(record).id);
    account.activeIdentity = 'parent';
    return this.issueSession(account);
  }

  /**
   * ADR-0006：微信手机号绑定——仅用于匹配既有手机号账号（家庭绑定钥匙），
   * 合并后不赋予任何员工能力。
   */
  async bindWechatPhone(
    accessToken: string,
    code: string,
  ): Promise<IssuedAuthenticatedSession> {
    const resolver = this.adapters.wechatPhoneNumberResolver;
    if (!resolver) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'WECHAT_NOT_CONFIGURED',
        '微信手机号解析未配置',
      );
    }
    const payload = this.verifyAccessToken(accessToken);
    const current = await this.loadAccount(payload.sub);
    if (!(await this.sessions.isActive(payload.sid, payload.sub, new Date()))) {
      throw this.unauthorized();
    }
    const { phoneNumber } = await resolver.getPhoneNumber(code);
    const target = await this.findOrCreatePhoneAccount(phoneNumber);
    if (current.wechatOpenidHash && current.id !== target.id) {
      await this.consumerAccounts.linkWechat(
        target.id,
        current.wechatOpenidHash,
      );
      target.wechatOpenidHash = current.wechatOpenidHash;
      current.wechatOpenidHash = undefined;
    }
    return this.issueSession(target);
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
    const account = await this.loadAccount(payload.sub);
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

  /** 机构后台统一入口：按账号自动识别员工或平台管理员，无需选择入口。 */
  async loginAdminWithPassword(
    loginIdentifier: string,
    password: string,
  ): Promise<IssuedAuthenticatedSession> {
    const identifier = loginIdentifier.trim();
    await this.assertAttemptAllowed(
      `password:admin:${identifier}`,
      5,
      5 * 60_000,
    );
    const account = [...this.accounts.values()].find(
      (candidate) =>
        candidate.loginIdentifier === identifier &&
        (candidate.kind === 'staff' || candidate.kind === 'platform-admin'),
    );
    if (!account || !this.passwordMatches(account, password)) {
      throw this.unauthorized();
    }
    return this.issueSession(this.requireActive(account.id));
  }

  /** 机构后台账号密码登录（已取消固定二次验证码）。 */
  async loginWithPassword(
    loginIdentifier: string,
    password: string,
    kind: 'staff' | 'partner' | 'platform-admin',
  ): Promise<IssuedAuthenticatedSession> {
    await this.assertAttemptAllowed(
      `password:${kind}:${loginIdentifier}`,
      5,
      5 * 60_000,
    );
    return this.issueSession(
      this.verifyPassword(loginIdentifier, password, kind),
    );
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
      await this.loadAccount(result.accountId),
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
    const account = await this.loadAccount(payload.sub);
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
    if (!account || !this.passwordMatches(account, password)) {
      throw this.unauthorized();
    }
    return this.requireActive(account.id);
  }

  private passwordMatches(account: Account, password: string): boolean {
    if (account.passwordHash) {
      const [scheme, salt, hash] = account.passwordHash.split('$');
      if (scheme !== 'scrypt' || !salt || !hash) return false;
      const expected = Buffer.from(hash, 'base64');
      const actual = scryptSync(
        password,
        Buffer.from(salt, 'base64'),
        expected.length,
      );
      return timingSafeEqual(actual, expected);
    }
    // 生产环境拒绝明文密码配置。
    if (process.env.NODE_ENV === 'production' || !account.password) {
      return false;
    }
    return timingSafeEqual(
      Buffer.from(this.digest(password)),
      Buffer.from(this.digest(account.password)),
    );
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
    // 试点部署：生产从 /opt/budstar/api/config/production-accounts.json 读取
    if (process.env.NODE_ENV === 'production') {
      const accountsPath = path.resolve(
        process.cwd(),
        'config/production-accounts.json',
      );
      if (fs.existsSync(accountsPath)) {
        try {
          return JSON.parse(fs.readFileSync(accountsPath, 'utf8')) as Account[];
        } catch {
          console.error('Failed to parse production accounts JSON');
        }
      }
      return [];
    }
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
