import { describe, expect, it } from 'vitest';
import {
  getTransitionStatus,
  hasReachedSubmissionStatus,
  validateDraft,
  type DraftForm,
} from './submission';

const draft: DraftForm = {
  title: '我的作品',
  description: '作品说明',
  workUrl: '',
  githubUrl: '',
  demoUrl: '',
};

describe('submission flow', () => {
  it('uses RESUBMITTED after teacher revision feedback', () => {
    expect(getTransitionStatus('NEEDS_REVISION')).toBe('RESUBMITTED');
    expect(getTransitionStatus('DRAFT')).toBe('SUBMITTED');
    expect(getTransitionStatus(null)).toBe('SUBMITTED');
  });

  it('recognizes a successful target state after an uncertain response', () => {
    expect(hasReachedSubmissionStatus('SUBMITTED', 'SUBMITTED')).toBe(true);
    expect(hasReachedSubmissionStatus('RESUBMITTED', 'RESUBMITTED')).toBe(true);
    expect(hasReachedSubmissionStatus('DRAFT', 'SUBMITTED')).toBe(false);
  });

  it('validates optional AIGC work links', () => {
    expect(validateDraft('AIGC', draft)).toBeNull();
    expect(validateDraft('AIGC', { ...draft, workUrl: 'not-a-url' })).toBe(
      '作品链接须以 http 或 https 开头',
    );
  });

  it('requires GitHub and demo links for Vibe Coding work', () => {
    expect(validateDraft('VIBE_CODING', draft)).toBe(
      '请填写有效的 GitHub 仓库地址',
    );
    expect(
      validateDraft('VIBE_CODING', {
        ...draft,
        githubUrl: 'https://github.com/budstar/project',
        demoUrl: 'https://demo.example.com',
      }),
    ).toBeNull();
  });
});
