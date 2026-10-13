import { randomUUID } from 'node:crypto';
import { CommunityService, InMemoryCommunityStore } from './community.service';

describe('CommunityService', () => {
  it('auto-publishes low risk family posts and queues medium/high risk', async () => {
    const store = new InMemoryCommunityStore();
    const campusId = 'shenzhen-nanshan';
    const studentId = randomUUID();
    const classId = randomUUID();
    store.seedStudent({
      id: studentId,
      campusId,
      displayName: '小明',
      classIds: [classId],
    });
    const service = new CommunityService(store, {
      getWorkDisplayEligibility: () =>
        Promise.resolve({
          studentProfileId: 'any',
          canDisplayPublicly: true,
          reason: 'DISPLAY_SWITCH_GRANTED',
          policyVersion: null,
        }),
    });

    const low = await service.createPost(campusId, randomUUID(), {
      studentProfileId: studentId,
      title: '本周作品',
      body: '完成了提示词练习',
      visibilityScope: 'FAMILY',
    });
    expect(low.status).toBe('PUBLISHED');
    expect(low.riskLevel).toBe('LOW');

    const medium = await service.createPost(campusId, randomUUID(), {
      studentProfileId: studentId,
      classId,
      title: '班级分享',
      body: '加我微信私下转账看完整版',
      visibilityScope: 'CLASS',
    });
    expect(medium.status).toBe('PENDING_REVIEW');

    const high = await service.createPost(campusId, randomUUID(), {
      studentProfileId: studentId,
      classId,
      title: '危险',
      body: '涉及暴力血腥内容',
      visibilityScope: 'CAMPUS',
    });
    expect(high.status).toBe('HIDDEN');

    const approved = await service.reviewPost(
      campusId,
      medium.id,
      randomUUID(),
      { action: 'approve' },
    );
    expect(approved.status).toBe('PUBLISHED');

    const parentFeed = await service.listParentFeed([studentId]);
    expect(parentFeed.some((item) => item.id === low.id)).toBe(true);
    expect(parentFeed.some((item) => item.id === approved.id)).toBe(true);
    expect(parentFeed.some((item) => item.id === high.id)).toBe(false);

    const outsiderFeed = await service.listParentFeed([randomUUID()]);
    expect(outsiderFeed).toHaveLength(0);
  });
});

describe('CommunityService work display consent gate (ADR-0008/I5-01)', () => {
  const campusId = 'shenzhen-nanshan';

  function setup(canDisplay: boolean) {
    const store = new InMemoryCommunityStore();
    const studentId = randomUUID();
    store.seedStudent({
      id: studentId,
      campusId,
      displayName: '小红',
      classIds: [randomUUID()],
    });
    const service = new CommunityService(store, {
      getWorkDisplayEligibility: (id: string) =>
        Promise.resolve({
          studentProfileId: id,
          canDisplayPublicly: canDisplay,
          reason: canDisplay
            ? 'DISPLAY_SWITCH_GRANTED'
            : 'WORK_DISPLAY_MISSING',
          policyVersion: null,
        }),
    });
    return { service, studentId };
  }

  it('rejects CLASS/CAMPUS posts when the display switch is off', async () => {
    const { service, studentId } = setup(false);
    await expect(
      service.createPost(campusId, randomUUID(), {
        studentProfileId: studentId,
        title: '班级作品',
        body: '分享我的动画',
        visibilityScope: 'CLASS',
      }),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
    await expect(
      service.createPost(campusId, randomUUID(), {
        studentProfileId: studentId,
        title: '校区作品',
        body: '分享我的动画',
        visibilityScope: 'CAMPUS',
      }),
    ).rejects.toMatchObject({ response: { code: 'FORBIDDEN' } });
  });

  it('allows FAMILY posts regardless of the display switch', async () => {
    const { service, studentId } = setup(false);
    const post = await service.createPost(campusId, randomUUID(), {
      studentProfileId: studentId,
      title: '家庭记录',
      body: '只给家人看',
      visibilityScope: 'FAMILY',
    });
    expect(post.status).toBe('PUBLISHED');
  });

  it('allows public posts once the display switch is granted', async () => {
    const { service, studentId } = setup(true);
    const allowed = await service.createPost(campusId, randomUUID(), {
      studentProfileId: studentId,
      title: '班级作品',
      body: '分享我的动画',
      visibilityScope: 'CLASS',
    });
    expect(allowed.riskLevel).toBe('LOW');
  });
});
