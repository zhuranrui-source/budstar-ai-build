import { describe, expect, it } from 'vitest';
import {
  createCoursePackageVersionSchema,
  reviseCoursePackageVersionSchema,
} from './course-package';

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

function buildValidDraft() {
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
        submissionKinds: sequence <= 8 ? ['IMAGE', 'LINK'] : ['GITHUB', 'LINK'],
      },
    };
  });
  const onlineQaSessions = Array.from({ length: 8 }, (_, index) => ({
    sequence: index + 1,
    afterLessonSequence: (index + 1) * 2,
    title: `答疑 ${index + 1}`,
    topic: `答疑主题 ${index + 1}`,
  }));
  return {
    packageKey: 'ai-xingya-seed',
    version: '1.0.0',
    title: 'AI 星芽种子实验班',
    mainLessons,
    onlineQaSessions,
    rubrics: [{ name: '五维成长评价', dimensions: fiveDimensions }],
  };
}

describe('course package contract', () => {
  it('accepts a complete 16+8 immutable package draft', () => {
    expect(
      createCoursePackageVersionSchema.safeParse(buildValidDraft()).success,
    ).toBe(true);
  });

  it('rejects incomplete lesson skeletons', () => {
    const draft = buildValidDraft();
    draft.mainLessons = draft.mainLessons.slice(0, 15);
    expect(createCoursePackageVersionSchema.safeParse(draft).success).toBe(
      false,
    );
  });

  it('requires semantic version on revise', () => {
    expect(
      reviseCoursePackageVersionSchema.safeParse({ newVersion: '1.0.1' })
        .success,
    ).toBe(true);
    expect(
      reviseCoursePackageVersionSchema.safeParse({ newVersion: 'next' })
        .success,
    ).toBe(false);
  });
});
