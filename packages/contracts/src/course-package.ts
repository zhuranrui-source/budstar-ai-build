import { z } from 'zod';

export const coursePackageVersionStatuses = ['DRAFT', 'PUBLISHED'] as const;
export const coursePackageVersionStatusSchema = z.enum(
  coursePackageVersionStatuses,
);
export type CoursePackageVersionStatus = z.infer<
  typeof coursePackageVersionStatusSchema
>;

export const mainLessonTracks = ['AIGC', 'VIBE_CODING'] as const;
export const mainLessonTrackSchema = z.enum(mainLessonTracks);
export type MainLessonTrack = z.infer<typeof mainLessonTrackSchema>;

export const rubricDimensionSchema = z
  .object({
    key: z.string().trim().min(1).max(64),
    label: z.string().trim().min(1).max(100),
    minLevel: z.literal(1),
    maxLevel: z.literal(5),
  })
  .strict();

export const lessonAssignmentTemplateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    requirements: z.string().trim().min(1).max(2000),
    submissionKinds: z.array(z.string().trim().min(1).max(32)).min(1).max(8),
  })
  .strict();

export const mainLessonDraftSchema = z
  .object({
    sequence: z.number().int().min(1).max(16),
    track: mainLessonTrackSchema,
    title: z.string().trim().min(1).max(200),
    theme: z.string().trim().min(1).max(200),
    coreDeliverable: z.string().trim().min(1).max(500),
    learningGoals: z.string().trim().min(1).max(1000),
    assignment: lessonAssignmentTemplateSchema,
  })
  .strict();

export const onlineQaSessionDraftSchema = z
  .object({
    sequence: z.number().int().min(1).max(8),
    afterLessonSequence: z.number().int().min(1).max(16),
    title: z.string().trim().min(1).max(200),
    topic: z.string().trim().min(1).max(500),
  })
  .strict();

export const rubricDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    mainLessonSequence: z.number().int().min(1).max(16).optional(),
    dimensions: z.array(rubricDimensionSchema).min(1).max(8),
  })
  .strict();

export const createCoursePackageVersionSchema = z
  .object({
    packageKey: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]+$/)
      .min(2)
      .max(64),
    version: z
      .string()
      .trim()
      .regex(/^\d+\.\d+\.\d+$/)
      .max(32),
    title: z.string().trim().min(1).max(200),
    mainLessons: z.array(mainLessonDraftSchema).length(16),
    onlineQaSessions: z.array(onlineQaSessionDraftSchema).length(8),
    rubrics: z.array(rubricDraftSchema).min(1).max(20),
  })
  .strict();

export type CreateCoursePackageVersionInput = z.infer<
  typeof createCoursePackageVersionSchema
>;

export const reviseCoursePackageVersionSchema = z
  .object({
    newVersion: z
      .string()
      .trim()
      .regex(/^\d+\.\d+\.\d+$/)
      .max(32),
    title: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export type ReviseCoursePackageVersionInput = z.infer<
  typeof reviseCoursePackageVersionSchema
>;

export const coursePackageVersionSummarySchema = z
  .object({
    id: z.string().uuid(),
    packageKey: z.string(),
    version: z.string(),
    title: z.string(),
    status: coursePackageVersionStatusSchema,
    publishedAt: z.string().datetime().nullable(),
    mainLessonCount: z.number().int(),
    onlineQaSessionCount: z.number().int(),
  })
  .strict();

export type CoursePackageVersionSummary = z.infer<
  typeof coursePackageVersionSummarySchema
>;

// ===== 学科内容库（ADR-0003 不可变精神：DRAFT 可编辑，PUBLISHED 单向不可改） =====

export const subjectOptions = [
  'MATH',
  'CHINESE',
  'ENGLISH',
  'PHYSICS',
  'CHEMISTRY',
  'BIOLOGY',
  'HISTORY',
  'GEOGRAPHY',
  'POLITICS',
  'OTHER',
] as const;
export const subjectSchema = z.enum(subjectOptions);

export const gradeBandOptions = [
  'PRIMARY',
  'JUNIOR_HIGH',
  'SENIOR_HIGH',
  'GENERAL',
] as const;
export const gradeBandSchema = z.enum(gradeBandOptions);

export const subjectCourseStatuses = ['DRAFT', 'PUBLISHED'] as const;
export const subjectCourseStatusSchema = z.enum(subjectCourseStatuses);

export const subjectChapterDraftSchema = z
  .object({
    sequence: z.number().int().min(1).max(200),
    title: z.string().trim().min(1).max(200),
    contentHtml: z.string().max(500_000),
    contentUrl: z.string().trim().max(1000).optional(),
    aiGuidePrompt: z.string().trim().max(1000).optional(),
  })
  .strict();

export const createSubjectCourseSchema = z
  .object({
    subject: subjectSchema,
    gradeBand: gradeBandSchema,
    gradeLevel: z.number().int().min(1).max(12).nullable().optional(),
    title: z.string().trim().min(1).max(200),
    chapters: z.array(subjectChapterDraftSchema).min(1).max(200),
  })
  .strict();

export const subjectChapterViewSchema = z
  .object({
    id: z.string().uuid(),
    sequence: z.number().int(),
    title: z.string(),
    contentHtml: z.string(),
    contentUrl: z.string().nullable(),
    aiGuidePrompt: z.string().nullable(),
  })
  .strict();

export const subjectCourseSummarySchema = z
  .object({
    id: z.string().uuid(),
    subject: subjectSchema,
    gradeBand: gradeBandSchema,
    gradeLevel: z.number().int().nullable(),
    title: z.string(),
    status: subjectCourseStatusSchema,
    publishedAt: z.string().datetime().nullable(),
    chapterCount: z.number().int(),
  })
  .strict();

export const subjectCourseDetailSchema = subjectCourseSummarySchema.extend({
  chapters: z.array(subjectChapterViewSchema),
});

export type Subject = z.infer<typeof subjectSchema>;
export type GradeBand = z.infer<typeof gradeBandSchema>;
export type SubjectCourseStatus = z.infer<typeof subjectCourseStatusSchema>;
export type SubjectChapterDraft = z.infer<typeof subjectChapterDraftSchema>;
export type CreateSubjectCourseInput = z.infer<
  typeof createSubjectCourseSchema
>;
export type SubjectCourseSummary = z.infer<typeof subjectCourseSummarySchema>;
export type SubjectCourseDetail = z.infer<typeof subjectCourseDetailSchema>;
