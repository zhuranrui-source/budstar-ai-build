import { z } from 'zod';
import { mainLessonTrackSchema } from './course-package';

export const workSubmissionStatuses = [
  'DRAFT',
  'SUBMITTED',
  'NEEDS_REVISION',
  'RESUBMITTED',
  'COMPLETED',
] as const;
export const workSubmissionStatusSchema = z.enum(workSubmissionStatuses);
export type WorkSubmissionStatus = z.infer<typeof workSubmissionStatusSchema>;

const submissionStatusTransitions: Record<
  WorkSubmissionStatus,
  readonly WorkSubmissionStatus[]
> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['NEEDS_REVISION', 'COMPLETED'],
  NEEDS_REVISION: ['RESUBMITTED'],
  RESUBMITTED: ['NEEDS_REVISION', 'COMPLETED'],
  COMPLETED: [],
};

export function canTransitionWorkSubmissionStatus(
  from: WorkSubmissionStatus,
  to: WorkSubmissionStatus,
): boolean {
  return submissionStatusTransitions[from].includes(to);
}

export const studentInitiatedSubmissionStatuses = [
  'SUBMITTED',
  'RESUBMITTED',
] as const;

export function isStudentInitiatedSubmissionTransition(
  from: WorkSubmissionStatus,
  to: WorkSubmissionStatus,
): boolean {
  if (to === 'SUBMITTED') return from === 'DRAFT';
  if (to === 'RESUBMITTED') return from === 'NEEDS_REVISION';
  return false;
}

export function isTeacherInitiatedSubmissionTransition(
  from: WorkSubmissionStatus,
  to: WorkSubmissionStatus,
): boolean {
  return (
    (to === 'NEEDS_REVISION' || to === 'COMPLETED') &&
    (from === 'SUBMITTED' || from === 'RESUBMITTED')
  );
}

const httpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((value) => /^https?:\/\//i.test(value), {
    message: '链接须以 http 或 https 开头',
  });

const githubUrlSchema = httpUrlSchema.refine(
  (value) => /github\.com/i.test(value),
  { message: '须为 GitHub 仓库地址' },
);

export const aigcSubmissionPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2000),
    imageUrls: z.array(httpUrlSchema).max(8).default([]),
    workUrl: httpUrlSchema.optional(),
  })
  .strict();

export type AigcSubmissionPayload = z.infer<typeof aigcSubmissionPayloadSchema>;

export const vibeCodingSubmissionPayloadSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(2000),
    githubUrl: githubUrlSchema,
    demoUrl: httpUrlSchema,
  })
  .strict();

export type VibeCodingSubmissionPayload = z.infer<
  typeof vibeCodingSubmissionPayloadSchema
>;

export const workSubmissionPayloadSchema = z.discriminatedUnion('track', [
  z
    .object({
      track: z.literal('AIGC'),
      content: aigcSubmissionPayloadSchema,
    })
    .strict(),
  z
    .object({
      track: z.literal('VIBE_CODING'),
      content: vibeCodingSubmissionPayloadSchema,
    })
    .strict(),
]);

export type WorkSubmissionPayload = z.infer<typeof workSubmissionPayloadSchema>;

export function validateSubmissionPayloadForTrack(
  track: 'AIGC' | 'VIBE_CODING',
  content: unknown,
):
  | { success: true; data: WorkSubmissionPayload }
  | { success: false; error: z.ZodError } {
  if (track === 'AIGC') {
    const parsed = aigcSubmissionPayloadSchema.safeParse(content);
    if (!parsed.success) return parsed;
    return {
      success: true,
      data: { track: 'AIGC', content: parsed.data },
    };
  }
  const parsed = vibeCodingSubmissionPayloadSchema.safeParse(content);
  if (!parsed.success) return parsed;
  return {
    success: true,
    data: { track: 'VIBE_CODING', content: parsed.data },
  };
}

export const joinClassByCodeSchema = z
  .object({
    classCode: z
      .string()
      .trim()
      .regex(/^BS[A-Z0-9]{6}$/, '班级码格式不正确'),
  })
  .strict();

export type JoinClassByCodeInput = z.infer<typeof joinClassByCodeSchema>;

export const saveWorkSubmissionDraftSchema = z
  .object({
    classId: z.string().uuid(),
    mainLessonId: z.string().uuid(),
    content: z.record(z.string(), z.unknown()),
  })
  .strict();

export type SaveWorkSubmissionDraftInput = z.infer<
  typeof saveWorkSubmissionDraftSchema
>;

export const transitionWorkSubmissionSchema = z
  .object({
    toStatus: workSubmissionStatusSchema,
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type TransitionWorkSubmissionInput = z.infer<
  typeof transitionWorkSubmissionSchema
>;

export const listWorkSubmissionsQuerySchema = z
  .object({
    status: workSubmissionStatusSchema.optional(),
    classId: z.string().uuid().optional(),
  })
  .strict();

export type ListWorkSubmissionsQuery = z.infer<
  typeof listWorkSubmissionsQuerySchema
>;

export const studentLessonSchema = z
  .object({
    mainLessonId: z.string().uuid(),
    sequence: z.number().int().positive(),
    track: mainLessonTrackSchema,
    title: z.string(),
    theme: z.string(),
    coreDeliverable: z.string(),
    learningGoals: z.string(),
    assignment: z
      .object({
        id: z.string().uuid(),
        title: z.string(),
        requirements: z.string(),
        submissionKinds: z.array(z.string()),
      })
      .strict()
      .nullable(),
    submission: z
      .object({
        id: z.string().uuid(),
        status: workSubmissionStatusSchema,
        updatedAt: z.string().datetime(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type StudentLesson = z.infer<typeof studentLessonSchema>;

export const studentClassCurriculumSchema = z
  .object({
    classId: z.string().uuid(),
    className: z.string(),
    campusId: z.string(),
    coursePackageVersionId: z.string().uuid(),
    coursePackageTitle: z.string(),
    coursePackageVersion: z.string(),
    lessons: z.array(studentLessonSchema),
  })
  .strict();

export type StudentClassCurriculum = z.infer<
  typeof studentClassCurriculumSchema
>;

export const workSubmissionSummarySchema = z
  .object({
    id: z.string().uuid(),
    campusId: z.string(),
    classId: z.string().uuid(),
    className: z.string(),
    studentProfileId: z.string().uuid(),
    studentDisplayName: z.string(),
    mainLessonId: z.string().uuid(),
    lessonSequence: z.number().int().positive(),
    lessonTitle: z.string(),
    track: mainLessonTrackSchema,
    status: workSubmissionStatusSchema,
    title: z.string(),
    updatedAt: z.string().datetime(),
    submittedAt: z.string().datetime().nullable(),
  })
  .strict();

export type WorkSubmissionSummary = z.infer<typeof workSubmissionSummarySchema>;

export const workSubmissionDetailSchema = workSubmissionSummarySchema
  .extend({
    content: z.record(z.string(), z.unknown()),
    assignmentTemplateId: z.string().uuid(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type WorkSubmissionDetail = z.infer<typeof workSubmissionDetailSchema>;

export const classMembershipSchema = z
  .object({
    classId: z.string().uuid(),
    className: z.string(),
    classCode: z.string(),
    campusId: z.string(),
    status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']),
    coursePackageTitle: z.string(),
    joinedAt: z.string().datetime(),
  })
  .strict();

export type ClassMembership = z.infer<typeof classMembershipSchema>;
