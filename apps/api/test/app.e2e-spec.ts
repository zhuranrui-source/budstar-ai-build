import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

describe('public API (e2e)', () => {
  let app: INestApplication<App>;
  const validLead = {
    parentName: '陈女士',
    phone: '13800138000',
    childAgeOrGrade: '小学四年级',
    interestedCourse: 'Vibe Coding',
    campusId: 'shenzhen-nanshan',
    preferredContactTime: '工作日 18:00 后',
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  it('reports service health without exposing internals', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });

  it('creates a pending appointment lead from valid public input', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/appointment-leads')
      .set('Idempotency-Key', 'appointment-1')
      .send(validLead)
      .expect(201);

    const body = response.body as unknown;
    expect(body).toMatchObject({ status: 'PENDING_CONTACT' });
    expect(typeof (body as Record<string, unknown>).id).toBe('string');
    expect(typeof (body as Record<string, unknown>).createdAt).toBe('string');
    expect(JSON.stringify(body)).not.toContain('13800138000');
  });

  it('rejects malformed input without creating a lead', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/appointment-leads')
      .send({
        parentName: '',
        phone: '1234',
        childAgeOrGrade: '四年级',
        interestedCourse: 'AI 创作',
        campusId: 'shenzhen-nanshan',
        preferredContactTime: '周末',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: '请求参数不合法',
    });
  });

  it('lists public campuses without exposing internal fields', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/public/campuses')
      .expect(200);

    expect(response.body).toEqual([
      { id: 'shenzhen-nanshan', name: '深圳南山校区' },
    ]);
  });

  it('returns the same lead for a safe idempotent retry', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/public/appointment-leads')
      .set('Idempotency-Key', 'same-retry')
      .send(validLead)
      .expect(201);
    const retry = await request(app.getHttpServer())
      .post('/api/public/appointment-leads')
      .set('Idempotency-Key', 'same-retry')
      .send(validLead)
      .expect(200);

    expect(retry.body).toEqual(first.body);
  });

  it('rejects reuse of an idempotency key for different input', async () => {
    await request(app.getHttpServer())
      .post('/api/public/appointment-leads')
      .set('Idempotency-Key', 'conflicting-retry')
      .send(validLead)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/api/public/appointment-leads')
      .set('Idempotency-Key', 'conflicting-retry')
      .send({ ...validLead, interestedCourse: 'AI 体验课' })
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
  });

  it('prevents duplicate appointments even with a new retry key', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/public/appointment-leads')
      .set('Idempotency-Key', 'duplicate-1')
      .send(validLead)
      .expect(201);
    const duplicate = await request(app.getHttpServer())
      .post('/api/public/appointment-leads')
      .set('Idempotency-Key', 'duplicate-2')
      .send(validLead)
      .expect(200);

    expect(duplicate.body).toEqual(first.body);
  });

  it('enforces the configured request body limit with a stable error code', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/appointment-leads')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ padding: 'x'.repeat(40 * 1024) }))
      .expect(413);

    expect(response.body).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('maps malformed JSON to a stable validation error', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/appointment-leads')
      .set('Content-Type', 'application/json')
      .send('{"parentName":')
      .expect(400);

    expect(response.body).toEqual({
      code: 'VALIDATION_ERROR',
      message: '请求参数不合法',
    });
  });

  it('allows the idempotency header on a real POST preflight', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/public/appointment-leads')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,idempotency-key')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(
      String(response.headers['access-control-allow-headers']).toLowerCase(),
    ).toContain('idempotency-key');
  });

  it('allows configured CORS origins and rejects other origins', async () => {
    const allowed = await request(app.getHttpServer())
      .options('/api/public/campuses')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);
    const rejected = await request(app.getHttpServer())
      .options('/api/public/campuses')
      .set('Origin', 'https://attacker.example')
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('uses a forwarded client IP only when a trusted proxy hop is configured', async () => {
    const previousTrustProxy = process.env.TRUST_PROXY_HOPS;
    process.env.TRUST_PROXY_HOPS = '1';
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const proxyAwareApp: INestApplication<App> =
      moduleFixture.createNestApplication({
        bodyParser: false,
      });
    configureApp(proxyAwareApp);
    await proxyAwareApp.init();

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await request(proxyAwareApp.getHttpServer())
          .post('/api/public/appointment-leads')
          .set('X-Forwarded-For', '203.0.113.10')
          .set('Idempotency-Key', `proxy-a-${attempt}`)
          .send(validLead)
          .expect(attempt === 0 ? 201 : 200);
      }
      await request(proxyAwareApp.getHttpServer())
        .post('/api/public/appointment-leads')
        .set('X-Forwarded-For', '203.0.113.10')
        .set('Idempotency-Key', 'proxy-a-limited')
        .send(validLead)
        .expect(429);
      await request(proxyAwareApp.getHttpServer())
        .post('/api/public/appointment-leads')
        .set('X-Forwarded-For', '198.51.100.20')
        .set('Idempotency-Key', 'proxy-b-allowed')
        .send(validLead)
        .expect(200);
    } finally {
      await proxyAwareApp.close();
      if (previousTrustProxy === undefined) {
        delete process.env.TRUST_PROXY_HOPS;
      } else {
        process.env.TRUST_PROXY_HOPS = previousTrustProxy;
      }
    }
  });

  afterEach(async () => {
    await app.close();
  });
});
