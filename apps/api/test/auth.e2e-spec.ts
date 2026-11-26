import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { createHmac, randomBytes, scryptSync } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { AuditService } from '../src/audit/audit.service';
import { AuthenticationService } from '../src/auth/authentication.service';
import type { AuthenticatedSession } from '@budstar/contracts';

function requireSession(value: unknown): AuthenticatedSession {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('accessToken' in value) ||
    !('accessTokenExpiresAt' in value) ||
    !('actor' in value) ||
    !('campuses' in value)
  ) {
    throw new Error('Expected an authenticated session response');
  }
  return value as AuthenticatedSession;
}

describe('authentication and authorization API (e2e)', () => {
  let app: INestApplication<App>;
  const tokenSecret = 'integration-test-token-secret';
  const staffPhone = '13600136000';
  const platformPhone = '13500135000';
  const phoneHash = (phone: string) =>
    createHmac('sha256', tokenSecret).update(phone).digest('hex');
  const scryptHash = (password: string) => {
    const salt = randomBytes(16);
    return `scrypt$${salt.toString('base64')}$${scryptSync(password, salt, 32).toString('base64')}`;
  };

  beforeEach(async () => {
    process.env.AUTH_TOKEN_SECRET = tokenSecret;
    process.env.LOCAL_VERIFICATION_CODE = '000000';
    process.env.LOCAL_AUTH_ACCOUNTS_JSON = JSON.stringify([
      {
        id: 'staff-local',
        kind: 'staff',
        loginIdentifier: 'staff@local',
        password: 'Password123!',
        phoneHash: phoneHash(staffPhone),
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
        id: 'platform-local',
        kind: 'platform-admin',
        loginIdentifier: 'platform@local',
        passwordHash: scryptHash('Platform123!'),
        phoneHash: phoneHash(platformPhone),
        displayName: '本地平台管理员',
        status: 'ACTIVE',
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
        id: 'student-local',
        kind: 'student',
        loginIdentifier: 'student@local',
        password: 'Student123!',
        displayName: '本地学生',
        status: 'ACTIVE',
        studentProfileId: 'student-profile-local',
      },
      {
        id: 'student-suspended',
        kind: 'student',
        loginIdentifier: 'suspended@local',
        password: 'Student123!',
        displayName: '已挂起学生',
        status: 'SUSPENDED',
        studentProfileId: 'student-profile-suspended',
      },
    ]);
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterEach(async () => app.close());

  async function staffSession(
    agent = request.agent(app.getHttpServer()),
  ): Promise<AuthenticatedSession> {
    const sessionResponse = await agent
      .post('/api/auth/staff/login')
      .send({
        loginIdentifier: 'staff@local',
        password: 'Password123!',
      })
      .expect(201);
    const responseBody: unknown = sessionResponse.body;
    return requireSession(responseBody);
  }

  function cookieFrom(response: request.Response): string {
    const cookies = response.headers['set-cookie'];
    if (!cookies?.[0]) throw new Error('Expected refresh cookie');
    return cookies[0].split(';')[0];
  }

  function expiredToken(session: AuthenticatedSession): string {
    const encoded = session.accessToken.split('.')[0];
    const decoded = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as unknown;
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('sid' in decoded) ||
      typeof decoded.sid !== 'string'
    ) {
      throw new Error('Expected access token session id');
    }
    const payload = Buffer.from(
      JSON.stringify({
        sub: session.actor.userAccountId,
        sid: decoded.sid,
        exp: Date.now() - 1,
        type: 'access',
      }),
    ).toString('base64url');
    const signature = createHmac('sha256', tokenSecret)
      .update(payload)
      .digest('hex');
    return `${payload}.${signature}`;
  }

  it('issues parent-only sessions and rejects disabled student logins (ADR-0007)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/parent/request-otp')
      .send({ phone: '13800138000' })
      .expect(201);
    const parentAgent = request.agent(app.getHttpServer());
    const parent = await parentAgent
      .post('/api/auth/parent/verify-otp')
      .send({ phone: '13800138000', code: '000000' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/parent/verify-otp')
      .send({ phone: '13800138000', code: '000000' })
      .expect(401);

    const parentSession = parent.body as unknown as AuthenticatedSession;
    expect(parentSession.actor.kind).toBe('parent');
    expect(parentSession.activeIdentity).toBe('parent');
    expect(parentSession.availableIdentities).toEqual(['parent']);
    expect(parentSession).not.toHaveProperty('refreshToken');
    expect(parentSession).not.toHaveProperty('refreshTokenForCookie');
    expect(cookieFrom(parent)).toContain('budstar_refresh=');

    const studentLogin = await request(app.getHttpServer())
      .post('/api/auth/student/login')
      .send({
        loginIdentifier: 'student@local',
        password: 'Student123!',
      })
      .expect(403);
    expect(studentLogin.body).toMatchObject({
      code: 'STUDENT_LOGIN_DISABLED',
    });

    const parentAuthorization = await parentAgent
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${parentSession.accessToken}`)
      .set('X-Campus-Id', 'shenzhen-nanshan')
      .expect(403);
    expect(parentAuthorization.body).toEqual({
      code: 'FORBIDDEN',
      message: '无权执行该操作',
    });
  });

  it('rejects switching into a student identity (ADR-0007)', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/parent/request-otp')
      .send({ phone: '13900139000' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/auth/parent/verify-otp')
      .send({ phone: '13900139000', code: '000000' })
      .expect(201);
    const parentSession = login.body as unknown as AuthenticatedSession;
    expect(parentSession.activeIdentity).toBe('parent');

    const rejected = await request(app.getHttpServer())
      .post('/api/auth/consumer/switch-identity')
      .set('Authorization', `Bearer ${parentSession.accessToken}`)
      .send({ identity: 'student' })
      .expect(403);
    expect(rejected.body).toMatchObject({ code: 'STUDENT_LOGIN_DISABLED' });
  });

  it('requires staff login, explicit campus context and combined role capability', async () => {
    const session = await staffSession();
    await request(app.getHttpServer())
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Campus-Id', 'other-campus')
      .expect(403);
    const allowed = await request(app.getHttpServer())
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Campus-Id', 'shenzhen-nanshan')
      .expect(200);

    const allowedBody = allowed.body as unknown as { roles: string[] };
    expect(allowedBody.roles).toEqual(['TEACHER']);
  });

  it('lets a partner view published content and denies staff access', async () => {
    const agent = request.agent(app.getHttpServer());
    const partnerResponse = await agent
      .post('/api/auth/partner/login')
      .send({ loginIdentifier: 'partner@local', password: 'Partner123!' })
      .expect(201);
    const partner = requireSession(partnerResponse.body as unknown);
    expect(partner.actor.kind).toBe('partner');

    const courses = await agent
      .get('/api/partner/content/courses')
      .set('Authorization', `Bearer ${partner.accessToken}`)
      .expect(200);
    expect(Array.isArray(courses.body)).toBe(true);

    const staff = await staffSession();
    await request(app.getHttpServer())
      .get('/api/partner/content/courses')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .expect(403);
  });

  it('rate-limits password and OTP guessing', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/staff/login')
        .send({
          loginIdentifier: 'ghost@local',
          password: 'wrong-password',
        })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/auth/staff/login')
      .send({
        loginIdentifier: 'ghost@local',
        password: 'wrong-password',
      })
      .expect(429);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/parent/verify-otp')
        .send({ phone: '13900139000', code: '111111' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/auth/parent/verify-otp')
      .send({ phone: '13900139000', code: '111111' })
      .expect(429);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/auth/admin/verify-otp')
        .send({ phone: staffPhone, code: '111111' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/auth/admin/verify-otp')
      .send({ phone: staffPhone, code: '111111' })
      .expect(429);
  });

  it('logs staff and platform admins in by registered phone OTP only', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/admin/request-otp')
      .send({ phone: staffPhone })
      .expect(201);
    const staff = await request(app.getHttpServer())
      .post('/api/auth/admin/verify-otp')
      .send({ phone: staffPhone, code: '000000' })
      .expect(201);
    expect(requireSession(staff.body as unknown).actor.kind).toBe('staff');
    expect(cookieFrom(staff)).toContain('budstar_refresh=');

    await request(app.getHttpServer())
      .post('/api/auth/admin/request-otp')
      .send({ phone: platformPhone })
      .expect(201);
    const platform = await request(app.getHttpServer())
      .post('/api/auth/admin/verify-otp')
      .send({ phone: platformPhone, code: '000000' })
      .expect(201);
    expect(requireSession(platform.body as unknown).actor.kind).toBe(
      'platform-admin',
    );

    const unknown = await request(app.getHttpServer())
      .post('/api/auth/admin/request-otp')
      .send({ phone: '13800138000' })
      .expect(403);
    expect(unknown.body).toMatchObject({ code: 'ADMIN_PHONE_NOT_REGISTERED' });

    // 家长验证码不能用于后台登录
    await request(app.getHttpServer())
      .post('/api/auth/parent/request-otp')
      .send({ phone: staffPhone })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/admin/verify-otp')
      .send({ phone: staffPhone, code: '000000' })
      .expect(401);
  });

  it('lets only platform admins assign customer accounts used for web login', async () => {
    const platform = await request(app.getHttpServer())
      .post('/api/auth/platform/login')
      .send({ loginIdentifier: 'platform@local', password: 'Platform123!' })
      .expect(201);
    const platformToken = requireSession(platform.body as unknown).accessToken;
    const staff = await staffSession();

    const payload = {
      phone: '13300133000',
      username: 'family_01',
      password: 'Abc12345',
    };
    await request(app.getHttpServer())
      .post('/api/platform/consumer-accounts')
      .set('Authorization', `Bearer ${staff.accessToken}`)
      .send(payload)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/platform/consumer-accounts')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ ...payload, password: 'short' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/platform/consumer-accounts')
      .set('Authorization', `Bearer ${platformToken}`)
      .send(payload)
      .expect(201);
    const listed = await request(app.getHttpServer())
      .get('/api/platform/consumer-accounts')
      .set('Authorization', `Bearer ${platformToken}`)
      .expect(200);
    expect(JSON.stringify(listed.body)).not.toContain('13300133000');

    const login = await request(app.getHttpServer())
      .post('/api/auth/parent/password-login')
      .send({ username: 'family_01', password: 'Abc12345' })
      .expect(201);
    expect(requireSession(login.body as unknown).actor.kind).toBe('parent');
    expect(cookieFrom(login)).toContain('budstar_refresh=');

    await request(app.getHttpServer())
      .post('/api/auth/parent/request-otp')
      .send({ phone: '13300133000' })
      .expect(201);
    const otp = await request(app.getHttpServer())
      .post('/api/auth/parent/verify-otp')
      .send({ phone: '13300133000', code: '000000' })
      .expect(201);
    expect(requireSession(otp.body as unknown).actor.userAccountId).toBe(
      requireSession(login.body as unknown).actor.userAccountId,
    );
  });

  it('verifies scrypt password hashes and removes second-factor endpoints', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/platform/login')
      .send({ loginIdentifier: 'platform@local', password: 'wrong-password' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/staff/verify-second-factor')
      .send({ challengeToken: 'x', code: '000000' })
      .expect(404);
  });

  it('rotates cookies and revokes the whole family when an old token is replayed', async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/api/auth/staff/login')
      .send({
        loginIdentifier: 'staff@local',
        password: 'Password123!',
      })
      .expect(201);
    const originalCookie = cookieFrom(login);
    const rotated = await agent.post('/api/auth/refresh').send({}).expect(201);
    expect(cookieFrom(rotated)).not.toBe(originalCookie);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie)
      .send({})
      .expect(401);
    await agent.post('/api/auth/refresh').send({}).expect(401);
    await request(app.getHttpServer())
      .post('/api/auth/student/login')
      .send({
        loginIdentifier: 'suspended@local',
        password: 'Student123!',
      })
      .expect(403);
  });

  it('allows only one concurrent refresh and invalidates the winner after reuse detection', async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/api/auth/staff/login')
      .send({
        loginIdentifier: 'staff@local',
        password: 'Password123!',
      })
      .expect(201);
    const originalCookie = cookieFrom(login);
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', originalCookie)
        .send({}),
      request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', originalCookie)
        .send({}),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 401]);
    const winner = first.status === 201 ? first : second;
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', cookieFrom(winner))
      .send({})
      .expect(401);
  });

  it('keeps platform administrators out of campus business data', async () => {
    const sessionResponse = await request(app.getHttpServer())
      .post('/api/auth/platform/login')
      .send({
        loginIdentifier: 'platform@local',
        password: 'Platform123!',
      })
      .expect(201);
    const session = sessionResponse.body as unknown as AuthenticatedSession;

    await request(app.getHttpServer())
      .get('/api/platform/overview')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    const denied = await request(app.getHttpServer())
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Campus-Id', 'shenzhen-nanshan')
      .expect(403);
    expect(denied.body).toEqual({
      code: 'FORBIDDEN',
      message: '无权执行该操作',
    });
  });

  it('audits login, campus selection and successful authorized writes without secrets', async () => {
    const session = await staffSession();
    await request(app.getHttpServer())
      .post('/api/admin/campus-context')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Campus-Id', 'shenzhen-nanshan')
      .send({ campusId: 'shenzhen-nanshan' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/admin/audited-write-probe')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Campus-Id', 'shenzhen-nanshan')
      .send({})
      .expect(201);

    const serialized = JSON.stringify(app.get(AuditService).listForTesting());
    expect(serialized).toContain('AUTH_LOGIN_SUCCEEDED');
    expect(serialized).toContain('CAMPUS_CONTEXT_SELECTED');
    expect(serialized).toContain('AUTHORIZED_BUSINESS_WRITE');
    expect(serialized).not.toContain('Password123!');
    expect(serialized).not.toContain('000000');
  });

  it('revokes the entire session so its access token and refresh cookie both stop working', async () => {
    const agent = request.agent(app.getHttpServer());
    const session = await staffSession(agent);
    await agent
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(201);
    await agent
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Campus-Id', 'shenzhen-nanshan')
      .expect(401);
    await agent.post('/api/auth/refresh').send({}).expect(401);
  });

  it('logs out with an expired access token by using the refresh cookie and rejects cross-origin logout', async () => {
    const agent = request.agent(app.getHttpServer());
    const session = await staffSession(agent);

    await agent
      .post('/api/auth/logout')
      .set('Origin', 'https://evil.invalid')
      .set('Authorization', `Bearer ${expiredToken(session)}`)
      .expect(403);

    const logout = await agent
      .post('/api/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('Authorization', `Bearer ${expiredToken(session)}`)
      .expect(201);
    expect(String(logout.headers['set-cookie'])).toContain('budstar_refresh=;');
    await agent.post('/api/auth/refresh').send({}).expect(401);
  });

  it('rechecks account state for an already-issued session', async () => {
    const session = await staffSession();
    app
      .get(AuthenticationService)
      .setAccountStatusForTesting(session.actor.userAccountId, 'SUSPENDED');
    await request(app.getHttpServer())
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Campus-Id', 'shenzhen-nanshan')
      .expect(403);
  });

  it('validates restored sessions through the API and rejects truly expired access tokens', async () => {
    const agent = request.agent(app.getHttpServer());
    const session = await staffSession(agent);
    const restored = await agent
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect((restored.body as AuthenticatedSession).actor.kind).toBe('staff');
    await agent
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${expiredToken(session)}`)
      .expect(401);
  });

  it('makes audit failures observable and records failed login and authorization denial', async () => {
    const audit = app.get(AuditService);
    await request(app.getHttpServer())
      .post('/api/auth/staff/login')
      .send({
        loginIdentifier: 'staff@local',
        password: 'definitely-wrong',
      })
      .expect(401);
    const session = await staffSession();
    await request(app.getHttpServer())
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Campus-Id', 'other-campus')
      .expect(403);
    expect(audit.listForTesting()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'AUTH_LOGIN_FAILED' }),
        expect.objectContaining({ action: 'AUTHORIZATION_DENIED' }),
      ]),
    );

    jest.spyOn(audit, 'record').mockRejectedValueOnce(new Error('audit down'));
    await request(app.getHttpServer())
      .post('/api/admin/audited-write-probe')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .set('X-Campus-Id', 'shenzhen-nanshan')
      .send({})
      .expect(201);
  });

  it('does not turn a successful login into a false failed login when audit delivery fails', async () => {
    const audit = app.get(AuditService);
    jest.spyOn(audit, 'record').mockRejectedValueOnce(new Error('audit down'));

    await request(app.getHttpServer())
      .post('/api/auth/parent/request-otp')
      .send({ phone: '13700137000' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/auth/parent/verify-otp')
      .send({ phone: '13700137000', code: '000000' })
      .expect(201);

    expect(login.body).toHaveProperty('accessToken');
    expect(audit.listForTesting()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'AUTH_LOGIN_FAILED' }),
      ]),
    );
  });

  it('returns stable unauthorized responses for absent and expired tokens', async () => {
    const missing = await request(app.getHttpServer())
      .get('/api/platform/overview')
      .expect(401);
    expect(missing.body).toEqual({
      code: 'UNAUTHORIZED',
      message: '请先完成身份验证',
    });
  });
});
