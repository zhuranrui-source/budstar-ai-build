import { describe, expect, it } from 'vitest';
import {
  assessCommunityRisk,
  canTransitionCommunityContent,
  createCommunityPostSchema,
  initialCommunityStatusForRisk,
} from './community';

describe('community contracts', () => {
  it('grades risk and routes medium/high to human review', () => {
    expect(assessCommunityRisk('今天作品完成了')).toBe('LOW');
    expect(initialCommunityStatusForRisk('LOW')).toBe('PUBLISHED');
    expect(assessCommunityRisk('加我微信私下转账')).toBe('MEDIUM');
    expect(initialCommunityStatusForRisk('MEDIUM')).toBe('PENDING_REVIEW');
    expect(assessCommunityRisk('涉及暴力血腥内容')).toBe('HIGH');
    expect(initialCommunityStatusForRisk('HIGH')).toBe('HIDDEN');
  });

  it('requires classId for class/campus visibility', () => {
    const parsed = createCommunityPostSchema.safeParse({
      studentProfileId: '11111111-1111-1111-1111-111111111111',
      title: '作品分享',
      body: '看我的作品',
      visibilityScope: 'CLASS',
    });
    expect(parsed.success).toBe(false);
  });

  it('blocks illegal community transitions', () => {
    expect(canTransitionCommunityContent('PUBLISHED', 'REJECTED')).toBe(false);
    expect(canTransitionCommunityContent('PENDING_REVIEW', 'PUBLISHED')).toBe(
      true,
    );
  });
});
