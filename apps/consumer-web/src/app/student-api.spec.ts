import { describe, expect, it, vi } from 'vitest';
import {
  chatWithAiTeacher,
  getStudentCurriculum,
  joinClassByCode,
} from './student-api';

describe('student-api', () => {
  it('joins class by code through the shared contract', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        classId: '11111111-1111-4111-8111-111111111111',
        className: '南山一班',
        classCode: 'BSAB12CD',
        campusId: 'campus-a',
        status: 'ACTIVE',
        coursePackageTitle: 'AI 星芽种子实验班',
        joinedAt: '2026-07-14T00:00:00.000Z',
      }),
    );
    const result = await joinClassByCode(
      'token',
      { classCode: 'BSAB12CD' },
      fetcher,
    );
    expect(result.classCode).toBe('BSAB12CD');
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/student/classes/join'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('loads curriculum for a joined class', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        classId: '11111111-1111-4111-8111-111111111111',
        className: '南山一班',
        campusId: 'campus-a',
        coursePackageVersionId: '22222222-2222-4222-8222-222222222222',
        coursePackageTitle: 'AI 星芽种子实验班',
        coursePackageVersion: '1.0.0',
        lessons: [
          {
            mainLessonId: '33333333-3333-4333-8333-333333333333',
            sequence: 1,
            track: 'AIGC',
            title: '第 1 课',
            theme: '提示词',
            coreDeliverable: '海报',
            learningGoals: '学会提示词',
            assignment: {
              id: '44444444-4444-4444-8444-444444444444',
              title: '提示词作品',
              requirements: '提交标题说明',
              submissionKinds: ['image'],
            },
            submission: null,
          },
        ],
      }),
    );
    const result = await getStudentCurriculum(
      'token',
      '11111111-1111-4111-8111-111111111111',
      fetcher,
    );
    expect(result.lessons).toHaveLength(1);
  });

  it('chats with Xingya AI teacher', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        conversationId: '55555555-5555-4555-8555-555555555555',
        messageId: '66666666-6666-4666-8666-666666666666',
        role: 'assistant',
        content: '我们一步步来拆解任务。',
        refusedHomework: false,
        modelRoute: 'mock',
        degraded: false,
        createdAt: '2026-07-14T00:00:00.000Z',
      }),
    );
    const result = await chatWithAiTeacher(
      'token',
      {
        classId: '11111111-1111-4111-8111-111111111111',
        mainLessonId: '33333333-3333-4333-8333-333333333333',
        message: '怎样拆解任务？',
      },
      fetcher,
    );
    expect(result.refusedHomework).toBe(false);
  });
});
