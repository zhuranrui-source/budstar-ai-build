import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

type Post = {
  id: string;
  title: string;
  status?: string;
  studentLabel: string | null;
  authorLabel: string;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  comments?: Array<{ id: string; body: string }>;
};

describe('星芽星球 (e2e)', () => {
  let app: INestApplication<App>;
  let mediaRoot: string;

  beforeEach(async () => {
    mediaRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'planet-media-'));
    process.env.PLANET_MEDIA_ROOT = mediaRoot;
    process.env.PLANET_STORE = 'memory';
    process.env.AUTH_TOKEN_SECRET = 'planet-test-secret';
    process.env.LOCAL_VERIFICATION_CODE = '000000';
    process.env.LOCAL_SECOND_FACTOR_CODE = '000000';
    process.env.LOCAL_AUTH_ACCOUNTS_JSON = JSON.stringify([
      {
        id: 'staff-local',
        kind: 'staff',
        loginIdentifier: 'staff',
        password: 'Password123!',
        displayName: '本地老师',
        status: 'ACTIVE',
        memberships: [
          {
            campusId: 'shenzhen-nanshan',
            campusName: '深圳南山校区',
            roles: ['TEACHER'],
          },
        ],
      },
    ]);
    const fixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    fs.rmSync(mediaRoot, { recursive: true, force: true });
  });

  const http = () => request(app.getHttpServer());

  async function staffToken(): Promise<string> {
    const res = await http()
      .post('/api/auth/admin/login')
      .send({ loginIdentifier: 'staff', password: 'Password123!' })
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  }

  async function parentToken(phone = '13800138000'): Promise<string> {
    await http()
      .post('/api/auth/parent/request-otp')
      .send({ phone })
      .expect(201);
    const res = await http()
      .post('/api/auth/parent/verify-otp')
      .send({ phone, code: '000000' })
      .expect(201);
    return (res.body as { accessToken: string }).accessToken;
  }

  async function upload(token: string): Promise<string> {
    const res = await http()
      .post('/api/planet/images')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'image/png')
      .send(PNG)
      .expect(201);
    return (res.body as { url: string }).url;
  }

  it('staff publishes, anyone browses, parents like / favorite / comment', async () => {
    const staff = await staffToken();
    const imageUrl = await upload(staff);
    expect(imageUrl).toMatch(/^\/media\/planet\/\d{6}\/[0-9a-f-]{36}\.png$/);

    await http()
      .post('/api/admin/planet/posts')
      .set('Authorization', `Bearer ${staff}`)
      .send({
        category: 'COMPETITION',
        title: '机器人竞赛一等奖',
        imageUrls: [imageUrl],
        studentInitial: '星',
      })
      .expect(400);
    const created = await http()
      .post('/api/admin/planet/posts')
      .set('Authorization', `Bearer ${staff}`)
      .send({
        category: 'COMPETITION',
        title: '机器人竞赛一等奖',
        body: '恭喜小星！',
        imageUrls: [imageUrl],
        studentInitial: '星',
        guardianConsent: true,
      })
      .expect(201);
    const postId = (created.body as Post).id;

    const feed = await http().get('/api/public/planet/posts').expect(200);
    const [first] = feed.body as Post[];
    expect(first).toMatchObject({
      id: postId,
      studentLabel: '小星',
      authorLabel: '星芽老师',
    });
    expect(JSON.stringify(feed.body)).not.toContain('guardianConsent');

    await http().post(`/api/planet/posts/${postId}/like`).expect(401);

    const parent = await parentToken();
    const auth = { Authorization: `Bearer ${parent}` };
    const liked = await http()
      .post(`/api/planet/posts/${postId}/like`)
      .set(auth)
      .expect(201);
    expect(liked.body).toEqual({ liked: true, likeCount: 1 });
    const unliked = await http()
      .post(`/api/planet/posts/${postId}/like`)
      .set(auth)
      .expect(201);
    expect(unliked.body).toEqual({ liked: false, likeCount: 0 });

    await http()
      .post(`/api/planet/posts/${postId}/favorite`)
      .set(auth)
      .expect(201);
    const favorites = await http()
      .get('/api/planet/favorites')
      .set(auth)
      .expect(200);
    expect((favorites.body as Post[]).map((p) => p.id)).toEqual([postId]);
    const states = await http()
      .get(`/api/planet/states?ids=${postId}`)
      .set(auth)
      .expect(200);
    expect(states.body).toEqual([{ postId, liked: false, favorited: true }]);

    const ok = await http()
      .post(`/api/planet/posts/${postId}/comments`)
      .set(auth)
      .send({ body: '太棒了，继续加油！' })
      .expect(201);
    expect(ok.body).toMatchObject({ status: 'PUBLISHED' });
    const flagged = await http()
      .post(`/api/planet/posts/${postId}/comments`)
      .set(auth)
      .send({ body: '有课程问题加我 13912345678' })
      .expect(201);
    expect(flagged.body).toMatchObject({ status: 'PENDING_REVIEW' });

    let detail = await http()
      .get(`/api/public/planet/posts/${postId}`)
      .expect(200);
    expect((detail.body as Post).commentCount).toBe(1);
    expect((detail.body as Post).comments?.map((c) => c.body)).toEqual([
      '太棒了，继续加油！',
    ]);

    await http()
      .get('/api/admin/planet/comments?status=PENDING_REVIEW')
      .set(auth)
      .expect(403);
    const pending = await http()
      .get('/api/admin/planet/comments?status=PENDING_REVIEW')
      .set('Authorization', `Bearer ${staff}`)
      .expect(200);
    const [pendingComment] = pending.body as Array<{
      id: string;
      reviewReason: string;
    }>;
    expect(pendingComment.reviewReason).toBe('包含手机号');
    await http()
      .patch(`/api/admin/planet/comments/${pendingComment.id}`)
      .set('Authorization', `Bearer ${staff}`)
      .send({ status: 'REMOVED' })
      .expect(200);

    await http()
      .patch(`/api/admin/planet/posts/${postId}`)
      .set('Authorization', `Bearer ${staff}`)
      .send({ status: 'REMOVED' })
      .expect(200);
    await http().get(`/api/public/planet/posts/${postId}`).expect(404);
    detail = await http().get('/api/public/planet/posts').expect(200);
    expect(detail.body).toEqual([]);
  });

  it('parents share their own child’s work only with guardian consent', async () => {
    const parent = await parentToken('13700137000');
    const auth = { Authorization: `Bearer ${parent}` };
    const imageUrl = await upload(parent);

    await http()
      .post('/api/planet/posts')
      .set(auth)
      .send({ category: 'WORK', title: '我的画', imageUrls: [imageUrl] })
      .expect(400);
    await http()
      .post('/api/planet/posts')
      .set(auth)
      .send({
        category: 'CULTURE',
        title: '冒充公司文化',
        imageUrls: [imageUrl],
        guardianConsent: true,
      })
      .expect(400);
    const shared = await http()
      .post('/api/planet/posts')
      .set(auth)
      .send({
        category: 'WORK',
        title: 'AI 绘画打卡第 1 天',
        imageUrls: [imageUrl],
        studentInitial: '新',
        guardianConsent: true,
      })
      .expect(201);
    expect(shared.body).toMatchObject({
      status: 'PUBLISHED',
      studentLabel: '小新',
    });

    const flagged = await http()
      .post('/api/planet/posts')
      .set(auth)
      .send({
        category: 'WORK',
        title: '想交流的加微信 abc12345',
        imageUrls: [imageUrl],
        guardianConsent: true,
      })
      .expect(201);
    expect(flagged.body).toMatchObject({ status: 'PENDING_REVIEW' });

    const feed = await http().get('/api/public/planet/posts').expect(200);
    expect((feed.body as Post[]).map((p) => p.title)).toEqual([
      'AI 绘画打卡第 1 天',
    ]);
    const mine = await http().get('/api/planet/mine').set(auth).expect(200);
    expect((mine.body as Post[]).map((p) => p.status).sort()).toEqual([
      'PENDING_REVIEW',
      'PUBLISHED',
    ]);

    await http()
      .post('/api/planet/posts')
      .set(auth)
      .send({
        category: 'WORK',
        title: '引用别人的图片',
        imageUrls: [
          '/media/planet/202601/00000000-0000-4000-8000-000000000000.png',
        ],
        guardianConsent: true,
      })
      .expect(400);
    await http()
      .post('/api/planet/images')
      .set(auth)
      .set('Content-Type', 'image/png')
      .send(Buffer.from('not an image at all'))
      .expect(400);
    await http()
      .post('/api/admin/planet/posts')
      .set(auth)
      .send({ category: 'CULTURE', title: 'x' })
      .expect(403);
  });
});
