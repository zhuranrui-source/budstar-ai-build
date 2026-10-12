import { describe, expect, it } from 'vitest';
import {
  aigcSubmissionPayloadSchema,
  canTransitionWorkSubmissionStatus,
  isStudentInitiatedSubmissionTransition,
  isTeacherInitiatedSubmissionTransition,
  joinClassByCodeSchema,
  validateSubmissionPayloadForTrack,
  vibeCodingSubmissionPayloadSchema,
} from './submission';

describe('submission contract', () => {
  it('allows only the declared submission status machine', () => {
    expect(canTransitionWorkSubmissionStatus('DRAFT', 'SUBMITTED')).toBe(true);
    expect(
      canTransitionWorkSubmissionStatus('SUBMITTED', 'NEEDS_REVISION'),
    ).toBe(true);
    expect(
      canTransitionWorkSubmissionStatus('NEEDS_REVISION', 'RESUBMITTED'),
    ).toBe(true);
    expect(canTransitionWorkSubmissionStatus('RESUBMITTED', 'COMPLETED')).toBe(
      true,
    );
    expect(canTransitionWorkSubmissionStatus('DRAFT', 'COMPLETED')).toBe(false);
    expect(
      canTransitionWorkSubmissionStatus('COMPLETED', 'NEEDS_REVISION'),
    ).toBe(false);
  });

  it('distinguishes student and teacher transitions', () => {
    expect(isStudentInitiatedSubmissionTransition('DRAFT', 'SUBMITTED')).toBe(
      true,
    );
    expect(
      isStudentInitiatedSubmissionTransition('NEEDS_REVISION', 'RESUBMITTED'),
    ).toBe(true);
    expect(
      isTeacherInitiatedSubmissionTransition('SUBMITTED', 'NEEDS_REVISION'),
    ).toBe(true);
    expect(
      isTeacherInitiatedSubmissionTransition('RESUBMITTED', 'COMPLETED'),
    ).toBe(true);
    expect(isTeacherInitiatedSubmissionTransition('DRAFT', 'COMPLETED')).toBe(
      false,
    );
  });

  it('requires AIGC title and description', () => {
    expect(
      aigcSubmissionPayloadSchema.safeParse({
        title: '我的海报',
        description: '用 AI 生成校园主题海报',
        imageUrls: ['https://cdn.example.com/a.png'],
        workUrl: 'https://example.com/work',
      }).success,
    ).toBe(true);
    expect(
      aigcSubmissionPayloadSchema.safeParse({
        title: '',
        description: '缺标题',
      }).success,
    ).toBe(false);
  });

  it('requires Vibe Coding GitHub, demo link and description', () => {
    expect(
      vibeCodingSubmissionPayloadSchema.safeParse({
        title: '校园助手',
        description: 'README 与演示说明',
        githubUrl: 'https://github.com/example/campus-helper',
        demoUrl: 'https://demo.example.com/app',
      }).success,
    ).toBe(true);
    expect(
      vibeCodingSubmissionPayloadSchema.safeParse({
        title: '校园助手',
        description: '说明',
        githubUrl: 'https://gitlab.com/example/repo',
        demoUrl: 'https://demo.example.com/app',
      }).success,
    ).toBe(false);
    expect(
      validateSubmissionPayloadForTrack('VIBE_CODING', {
        title: '校园助手',
        description: '说明',
        githubUrl: 'https://github.com/example/repo',
      }).success,
    ).toBe(false);
  });

  it('accepts class join codes', () => {
    expect(
      joinClassByCodeSchema.safeParse({ classCode: 'BSAB12CD' }).success,
    ).toBe(true);
    expect(joinClassByCodeSchema.safeParse({ classCode: 'ab12' }).success).toBe(
      false,
    );
  });
});
