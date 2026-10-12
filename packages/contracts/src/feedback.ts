import { z } from 'zod';

/** ADR-0004: AI outcomes are drafts only; never auto-publish teaching conclusions. */

export const aiFeedbackDraftStatuses = [
  'NOT_GENERATED',
  'GENERATING',
  'GENERATED',
  'FAILED',
  'ADOPTED',
  'DISCARDED',
] as const;
export const aiFeedbackDraftStatusSchema = z.enum(aiFeedbackDraftStatuses);
export type AiFeedbackDraftStatus = z.infer<typeof aiFeedbackDraftStatusSchema>;

export const formalFeedbackStatuses = ['DRAFT', 'PUBLISHED'] as const;
export const formalFeedbackStatusSchema = z.enum(formalFeedbackStatuses);
export type FormalFeedbackStatus = z.infer<typeof formalFeedbackStatusSchema>;

export const growthDimensionKeys = [
  'PROBLEM_DISCOVERY',
  'AI_COLLABORATION',
  'CREATIVE_EXPRESSION',
  'TECHNICAL_IMPLEMENTATION',
  'ITERATIVE_REFLECTION',
] as const;
export const growthDimensionKeySchema = z.enum(growthDimensionKeys);
export type GrowthDimensionKey = z.infer<typeof growthDimensionKeySchema>;

export const GROWTH_DIMENSION_LABELS: Record<GrowthDimensionKey, string> = {
  PROBLEM_DISCOVERY: '问题发现',
  AI_COLLABORATION: 'AI 协作',
  CREATIVE_EXPRESSION: '创意表达',
  TECHNICAL_IMPLEMENTATION: '技术实现',
  ITERATIVE_REFLECTION: '迭代反思',
};

export const GROWTH_DIMENSION_BADGE_LABELS: Record<GrowthDimensionKey, string> =
  {
    PROBLEM_DISCOVERY: '善于发现问题',
    AI_COLLABORATION: '善于与 AI 协作',
    CREATIVE_EXPRESSION: '创意表达力',
    TECHNICAL_IMPLEMENTATION: '技术落地力',
    ITERATIVE_REFLECTION: '持续迭代',
  };

export const fiveDimEvaluationStatuses = [
  'PENDING_GENERATION',
  'GENERATED',
  'PENDING_REVIEW',
  'CONFIRMED',
] as const;
export const fiveDimEvaluationStatusSchema = z.enum(fiveDimEvaluationStatuses);
export type FiveDimEvaluationStatus = z.infer<
  typeof fiveDimEvaluationStatusSchema
>;

export const growthReportStatuses = [
  'NOT_READY',
  'DRAFT_GENERATING',
  'PENDING_REVIEW',
  'PUBLISHED',
] as const;
export const growthReportStatusSchema = z.enum(growthReportStatuses);
export type GrowthReportStatus = z.infer<typeof growthReportStatusSchema>;

export const GROWTH_REPORT_MILESTONES = [4, 8, 12, 16] as const;
export type GrowthReportMilestone = (typeof GROWTH_REPORT_MILESTONES)[number];

export function isGrowthReportMilestone(
  sequence: number,
): sequence is GrowthReportMilestone {
  return (GROWTH_REPORT_MILESTONES as readonly number[]).includes(sequence);
}

export const growthDimensionScoreSchema = z
  .object({
    dimension: growthDimensionKeySchema,
    level: z.number().int().min(1).max(5),
    rationale: z.string().trim().min(1).max(500),
  })
  .strict();

export type GrowthDimensionScore = z.infer<typeof growthDimensionScoreSchema>;

export function canTransitionAiFeedbackDraft(
  from: AiFeedbackDraftStatus,
  to: AiFeedbackDraftStatus,
): boolean {
  const allowed: Record<
    AiFeedbackDraftStatus,
    readonly AiFeedbackDraftStatus[]
  > = {
    NOT_GENERATED: ['GENERATING'],
    GENERATING: ['GENERATED', 'FAILED'],
    GENERATED: ['ADOPTED', 'DISCARDED', 'GENERATING'],
    FAILED: ['GENERATING', 'DISCARDED'],
    ADOPTED: [],
    DISCARDED: ['GENERATING'],
  };
  return allowed[from].includes(to);
}

/** Formal feedback may only move DRAFT → PUBLISHED; never auto. */
export function canPublishFormalFeedback(
  status: FormalFeedbackStatus,
): boolean {
  return status === 'DRAFT';
}

export function canTransitionFiveDimEvaluation(
  from: FiveDimEvaluationStatus,
  to: FiveDimEvaluationStatus,
): boolean {
  const allowed: Record<
    FiveDimEvaluationStatus,
    readonly FiveDimEvaluationStatus[]
  > = {
    PENDING_GENERATION: ['GENERATED'],
    GENERATED: ['PENDING_REVIEW', 'CONFIRMED'],
    PENDING_REVIEW: ['CONFIRMED', 'GENERATED'],
    CONFIRMED: [],
  };
  return allowed[from].includes(to);
}

export function canTransitionGrowthReport(
  from: GrowthReportStatus,
  to: GrowthReportStatus,
): boolean {
  const allowed: Record<GrowthReportStatus, readonly GrowthReportStatus[]> = {
    NOT_READY: ['DRAFT_GENERATING'],
    DRAFT_GENERATING: ['PENDING_REVIEW', 'NOT_READY'],
    PENDING_REVIEW: ['PUBLISHED', 'DRAFT_GENERATING'],
    PUBLISHED: [],
  };
  return allowed[from].includes(to);
}

export const generateAiFeedbackDraftSchema = z
  .object({
    workSubmissionId: z.string().uuid(),
  })
  .strict();

export type GenerateAiFeedbackDraftInput = z.infer<
  typeof generateAiFeedbackDraftSchema
>;

export const saveFormalFeedbackDraftSchema = z
  .object({
    workSubmissionId: z.string().uuid(),
    body: z.string().trim().min(1).max(4000),
    highlights: z.array(z.string().trim().min(1).max(200)).max(8).default([]),
    nextSteps: z.array(z.string().trim().min(1).max(200)).max(8).default([]),
    aiDraftId: z.string().uuid().optional(),
  })
  .strict();

export type SaveFormalFeedbackDraftInput = z.infer<
  typeof saveFormalFeedbackDraftSchema
>;

export const publishFormalFeedbackSchema = z
  .object({
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type PublishFormalFeedbackInput = z.infer<
  typeof publishFormalFeedbackSchema
>;

export const generateFiveDimEvaluationSchema = z
  .object({
    workSubmissionId: z.string().uuid(),
  })
  .strict();

export type GenerateFiveDimEvaluationInput = z.infer<
  typeof generateFiveDimEvaluationSchema
>;

export const reviewFiveDimEvaluationSchema = z
  .object({
    action: z.enum(['mark_review', 'confirm']),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type ReviewFiveDimEvaluationInput = z.infer<
  typeof reviewFiveDimEvaluationSchema
>;

export const generateGrowthReportSchema = z
  .object({
    studentProfileId: z.string().uuid(),
    classId: z.string().uuid(),
    milestone: z.union([
      z.literal(4),
      z.literal(8),
      z.literal(12),
      z.literal(16),
    ]),
  })
  .strict();

export type GenerateGrowthReportInput = z.infer<
  typeof generateGrowthReportSchema
>;

export const publishGrowthReportSchema = z
  .object({
    teacherObservation: z.string().trim().min(1).max(2000).optional(),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type PublishGrowthReportInput = z.infer<
  typeof publishGrowthReportSchema
>;

export const aiFeedbackDraftSchema = z
  .object({
    id: z.string().uuid(),
    campusId: z.string(),
    workSubmissionId: z.string().uuid(),
    status: aiFeedbackDraftStatusSchema,
    content: z.string(),
    modelRoute: z.enum(['primary', 'fallback', 'mock', 'manual']),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type AiFeedbackDraft = z.infer<typeof aiFeedbackDraftSchema>;

export const formalFeedbackSchema = z
  .object({
    id: z.string().uuid(),
    campusId: z.string(),
    workSubmissionId: z.string().uuid(),
    studentProfileId: z.string().uuid(),
    classId: z.string().uuid(),
    mainLessonId: z.string().uuid(),
    lessonSequence: z.number().int().positive(),
    lessonTitle: z.string(),
    status: formalFeedbackStatusSchema,
    version: z.number().int().positive(),
    body: z.string(),
    highlights: z.array(z.string()),
    nextSteps: z.array(z.string()),
    publishedAt: z.string().datetime().nullable(),
    publishedByAccountId: z.string().uuid().nullable(),
    sourceAiDraftId: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type FormalFeedback = z.infer<typeof formalFeedbackSchema>;

export const fiveDimEvaluationSchema = z
  .object({
    id: z.string().uuid(),
    campusId: z.string(),
    workSubmissionId: z.string().uuid(),
    studentProfileId: z.string().uuid(),
    status: fiveDimEvaluationStatusSchema,
    scores: z.array(growthDimensionScoreSchema).length(5),
    needsReview: z.boolean(),
    confirmedAt: z.string().datetime().nullable(),
    confirmedByAccountId: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type FiveDimEvaluation = z.infer<typeof fiveDimEvaluationSchema>;

/** Student-facing view: badges/labels only, never numeric levels. */
export const studentGrowthViewSchema = z
  .object({
    studentProfileId: z.string().uuid(),
    badges: z.array(
      z
        .object({
          dimension: growthDimensionKeySchema,
          label: z.string(),
          rationale: z.string(),
        })
        .strict(),
    ),
    publishedFeedback: z.array(
      z
        .object({
          id: z.string().uuid(),
          lessonTitle: z.string(),
          lessonSequence: z.number().int().positive(),
          body: z.string(),
          highlights: z.array(z.string()),
          nextSteps: z.array(z.string()),
          publishedAt: z.string().datetime(),
        })
        .strict(),
    ),
  })
  .strict();

export type StudentGrowthView = z.infer<typeof studentGrowthViewSchema>;

export const parentGrowthViewSchema = z
  .object({
    studentProfileId: z.string().uuid(),
    publishedFeedback: z.array(formalFeedbackSchema),
    confirmedEvaluations: z.array(fiveDimEvaluationSchema),
    publishedReports: z.array(
      z
        .object({
          id: z.string().uuid(),
          milestone: z.union([
            z.literal(4),
            z.literal(8),
            z.literal(12),
            z.literal(16),
          ]),
          summary: z.string(),
          teacherObservation: z.string().nullable(),
          scores: z.array(growthDimensionScoreSchema),
          publishedAt: z.string().datetime(),
        })
        .strict(),
    ),
  })
  .strict();

export type ParentGrowthView = z.infer<typeof parentGrowthViewSchema>;

export const growthReportSchema = z
  .object({
    id: z.string().uuid(),
    campusId: z.string(),
    classId: z.string().uuid(),
    studentProfileId: z.string().uuid(),
    milestone: z.union([
      z.literal(4),
      z.literal(8),
      z.literal(12),
      z.literal(16),
    ]),
    status: growthReportStatusSchema,
    summary: z.string(),
    teacherObservation: z.string().nullable(),
    scores: z.array(growthDimensionScoreSchema),
    publishedAt: z.string().datetime().nullable(),
    publishedByAccountId: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type GrowthReport = z.infer<typeof growthReportSchema>;

export const lessonReportCopySchema = z
  .object({
    formalFeedbackId: z.string().uuid(),
    structured: z
      .object({
        lessonTitle: z.string(),
        body: z.string(),
        highlights: z.array(z.string()),
        nextSteps: z.array(z.string()),
      })
      .strict(),
    wechatCopy: z.string().min(1).max(2000),
  })
  .strict();

export type LessonReportCopy = z.infer<typeof lessonReportCopySchema>;

export function buildWechatLessonReportCopy(input: {
  studentDisplayName: string;
  lessonTitle: string;
  lessonSequence: number;
  body: string;
  highlights: string[];
  nextSteps: string[];
}): string {
  const highlightLines =
    input.highlights.length > 0
      ? input.highlights.map((item) => `· ${item}`).join('\n')
      : '· 本节作品已完成';
  const nextLines =
    input.nextSteps.length > 0
      ? input.nextSteps.map((item) => `· ${item}`).join('\n')
      : '· 继续巩固本节方法，欢迎课后练习';
  return [
    `【星芽每课一报】第${input.lessonSequence}节 ${input.lessonTitle}`,
    `同学：${input.studentDisplayName}`,
    '',
    '老师点评：',
    input.body,
    '',
    '亮点：',
    highlightLines,
    '',
    '下一步：',
    nextLines,
    '',
    '（此文案可复制到微信；不自动发送）',
  ].join('\n');
}

export function toStudentBadges(
  scores: GrowthDimensionScore[],
): Array<{ dimension: GrowthDimensionKey; label: string; rationale: string }> {
  return scores
    .filter((score) => score.level >= 3)
    .map((score) => ({
      dimension: score.dimension,
      label: GROWTH_DIMENSION_BADGE_LABELS[score.dimension],
      rationale: score.rationale,
    }));
}

/** Guarantees student payloads never include numeric levels. */
export function assertNoNumericLevelsForStudent(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  if (/"level"\s*:/.test(serialized)) {
    throw new Error('Student growth view must not include numeric levels');
  }
}
