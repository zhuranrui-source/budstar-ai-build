import { createCoursePackageVersionSchema } from '@budstar/contracts';
import {
  CoursePackagesService,
  InMemoryCoursePackageStore,
} from './course-packages.service';

const fiveDimensions = [
  {
    key: 'problem_discovery',
    label: '问题发现',
    minLevel: 1 as const,
    maxLevel: 5 as const,
  },
  {
    key: 'ai_collaboration',
    label: 'AI 协作',
    minLevel: 1 as const,
    maxLevel: 5 as const,
  },
  {
    key: 'creative_expression',
    label: '创意表达',
    minLevel: 1 as const,
    maxLevel: 5 as const,
  },
  {
    key: 'technical_implementation',
    label: '技术实现',
    minLevel: 1 as const,
    maxLevel: 5 as const,
  },
  {
    key: 'iterative_reflection',
    label: '迭代反思',
    minLevel: 1 as const,
    maxLevel: 5 as const,
  },
];

function buildDraft(version = '1.0.0') {
  const mainLessons = Array.from({ length: 16 }, (_, index) => {
    const sequence = index + 1;
    return {
      sequence,
      track: sequence <= 8 ? ('AIGC' as const) : ('VIBE_CODING' as const),
      title: `第 ${sequence} 节`,
      theme: `主题 ${sequence}`,
      coreDeliverable: `产出 ${sequence}`,
      learningGoals: `目标 ${sequence}`,
      assignment: {
        title: `作业 ${sequence}`,
        requirements: `提交要求 ${sequence}`,
        submissionKinds:
          sequence <= 8 ? ['IMAGE', 'LINK'] : ['GITHUB', 'DEMO_LINK'],
      },
    };
  });
  return createCoursePackageVersionSchema.parse({
    packageKey: 'ai-xingya-seed',
    version,
    title: 'AI 星芽种子实验班',
    mainLessons,
    onlineQaSessions: Array.from({ length: 8 }, (_, index) => ({
      sequence: index + 1,
      afterLessonSequence: Math.min(16, (index + 1) * 2),
      title: `答疑 ${index + 1}`,
      topic: `答疑主题 ${index + 1}`,
    })),
    rubrics: [{ name: '五维成长评价', dimensions: fiveDimensions }],
  });
}

describe('CoursePackagesService', () => {
  it('publishes immutable versions and forces revisions for changes', async () => {
    const store = new InMemoryCoursePackageStore();
    const service = new CoursePackagesService(store);

    const draft = await service.createDraft(buildDraft('1.0.0'));
    expect(draft.status).toBe('DRAFT');
    expect(draft.mainLessonCount).toBe(16);
    expect(draft.onlineQaSessionCount).toBe(8);

    const published = await service.publish(draft.id);
    expect(published.status).toBe('PUBLISHED');
    expect(published.publishedAt).toBeTruthy();

    await expect(service.assertMutable(published.id)).rejects.toMatchObject({
      response: { code: 'CONFLICT' },
    });

    const revised = await service.revise(published.id, {
      newVersion: '1.1.0',
      title: 'AI 星芽种子实验班（修订）',
    });
    expect(revised.status).toBe('DRAFT');
    expect(revised.version).toBe('1.1.0');
    expect(revised.id).not.toBe(published.id);
  });
});

describe('CoursePackagesService published content (ADR-0009 partner)', () => {
  it('lists only PUBLISHED versions for partner content view', async () => {
    const store = new InMemoryCoursePackageStore();
    const service = new CoursePackagesService(store);
    await service.createDraft(buildDraft('1.0.0'));
    const published = await service.createDraft(buildDraft('2.0.0'));
    await service.publish(published.id);

    const items = await service.listPublished();
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(published.id);
    expect(items[0].status).toBe('PUBLISHED');
    expect(items[0].mainLessonCount).toBe(16);
  });

  it('returns published detail without draft access', async () => {
    const store = new InMemoryCoursePackageStore();
    const service = new CoursePackagesService(store);
    const draft = await service.createDraft(buildDraft('1.0.0'));

    await expect(service.getPublished(draft.id)).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });

    await service.publish(draft.id);
    const detail = await service.getPublished(draft.id);
    expect(detail.status).toBe('PUBLISHED');
    expect(detail.mainLessons).toHaveLength(16);
  });
});
