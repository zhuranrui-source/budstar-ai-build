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
    const service = new CommunityService(store);

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
