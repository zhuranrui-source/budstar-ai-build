import { describe, expect, it } from 'vitest';
import {
  GROWTH_DIMENSION_LABELS,
  assertNoNumericLevelsForStudent,
  buildWechatLessonReportCopy,
  canPublishFormalFeedback,
  canTransitionAiFeedbackDraft,
  canTransitionFiveDimEvaluation,
  canTransitionGrowthReport,
  growthDimensionKeys,
  isGrowthReportMilestone,
  toStudentBadges,
} from './feedback';

describe('feedback contracts', () => {
  it('keeps five fixed dimension labels', () => {
    expect(growthDimensionKeys).toHaveLength(5);
    expect(GROWTH_DIMENSION_LABELS.PROBLEM_DISCOVERY).toBe('问题发现');
    expect(GROWTH_DIMENSION_LABELS.ITERATIVE_REFLECTION).toBe('迭代反思');
  });

  it('never allows publishing non-draft formal feedback', () => {
    expect(canPublishFormalFeedback('DRAFT')).toBe(true);
    expect(canPublishFormalFeedback('PUBLISHED')).toBe(false);
  });

  it('blocks illegal AI draft and five-dim transitions', () => {
    expect(canTransitionAiFeedbackDraft('NOT_GENERATED', 'GENERATED')).toBe(
      false,
    );
    expect(canTransitionAiFeedbackDraft('GENERATING', 'GENERATED')).toBe(true);
    expect(canTransitionAiFeedbackDraft('ADOPTED', 'DISCARDED')).toBe(false);
    expect(
      canTransitionFiveDimEvaluation('PENDING_GENERATION', 'CONFIRMED'),
    ).toBe(false);
    expect(canTransitionFiveDimEvaluation('GENERATED', 'CONFIRMED')).toBe(true);
    expect(canTransitionGrowthReport('PENDING_REVIEW', 'PUBLISHED')).toBe(true);
    expect(canTransitionGrowthReport('PUBLISHED', 'PENDING_REVIEW')).toBe(
      false,
    );
  });

  it('only allows milestone reports at 4/8/12/16', () => {
    expect(isGrowthReportMilestone(4)).toBe(true);
    expect(isGrowthReportMilestone(5)).toBe(false);
  });

  it('builds copyable wechat lesson report without auto-send', () => {
    const copy = buildWechatLessonReportCopy({
      studentDisplayName: '小明',
      lessonTitle: '提示词初体验',
      lessonSequence: 1,
      body: '作品目标清晰，继续打磨细节。',
      highlights: ['构图有想法'],
      nextSteps: ['补充迭代说明'],
    });
    expect(copy).toContain('【星芽每课一报】');
    expect(copy).toContain('小明');
    expect(copy).toContain('不自动发送');
  });

  it('maps student badges without exposing numeric levels', () => {
    const badges = toStudentBadges([
      {
        dimension: 'PROBLEM_DISCOVERY',
        level: 4,
        rationale: '能拆解任务',
      },
      {
        dimension: 'AI_COLLABORATION',
        level: 2,
        rationale: '仍需引导',
      },
    ]);
    expect(badges).toHaveLength(1);
    expect(badges[0]?.label).toBe('善于发现问题');
    expect(JSON.stringify(badges)).not.toMatch(/"level"/);
    expect(() => assertNoNumericLevelsForStudent(badges)).not.toThrow();
    expect(() => assertNoNumericLevelsForStudent({ level: 3 })).toThrow(
      /must not include numeric levels/,
    );
  });
});
