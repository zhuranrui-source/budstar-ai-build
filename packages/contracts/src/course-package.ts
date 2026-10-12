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
