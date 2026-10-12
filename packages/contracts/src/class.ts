import { z } from 'zod';

export const classStatuses = ['DRAFT', 'ACTIVE', 'CLOSED'] as const;
export const classStatusSchema = z.enum(classStatuses);
export type ClassStatus = z.infer<typeof classStatusSchema>;

const classStatusTransitions: Record<ClassStatus, readonly ClassStatus[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['CLOSED'],
  CLOSED: [],
};

export function canTransitionClassStatus(
  from: ClassStatus,
  to: ClassStatus,
): boolean {
  return classStatusTransitions[from].includes(to);
}

export const createClassSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    coursePackageVersionId: z.string().uuid(),
  })
  .strict();

export type CreateClassInput = z.infer<typeof createClassSchema>;

export const updateClassSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    status: classStatusSchema.optional(),
  })
  .strict()
  .refine((value) => value.name !== undefined || value.status !== undefined, {
    message: '至少提供一个可更新字段',
  });

export type UpdateClassInput = z.infer<typeof updateClassSchema>;

export const classSummarySchema = z
  .object({
    id: z.string().uuid(),
    campusId: z.string(),
    name: z.string(),
    classCode: z.string(),
    status: classStatusSchema,
    coursePackageVersionId: z.string().uuid(),
    coursePackageTitle: z.string(),
    coursePackageVersion: z.string(),
    studentCount: z.number().int().nonnegative(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type ClassSummary = z.infer<typeof classSummarySchema>;

export const classStudentSchema = z
  .object({
    studentProfileId: z.string().uuid(),
    displayName: z.string(),
    joinedAt: z.string().datetime(),
  })
  .strict();

export type ClassStudent = z.infer<typeof classStudentSchema>;
