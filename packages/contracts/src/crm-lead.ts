import { z } from 'zod';
import {
  appointmentLeadStatusSchema,
  type AppointmentLeadStatus,
} from './appointment-lead';

export const leadSourceOptions = [
  'OFFICIAL_SITE',
  'REFERRAL',
  'OFFLINE',
  'PARTNER',
  'OTHER',
] as const;
export const leadSourceSchema = z.enum(leadSourceOptions);
export const listAppointmentLeadsQuerySchema = z.object({
  status: appointmentLeadStatusSchema.optional(),
  assigneeAccountId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(100).optional(),
  source: leadSourceSchema.optional(),
  overdue: z.enum(['true', 'false']).optional(),
});

export type ListAppointmentLeadsQuery = z.infer<
  typeof listAppointmentLeadsQuerySchema
>;

export const transitionAppointmentLeadSchema = z
  .object({
    toStatus: appointmentLeadStatusSchema,
    note: z.string().trim().min(1).max(500).optional(),
    reopenReason: z.string().trim().min(1).max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.toStatus === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: '目标状态必填',
        path: ['toStatus'],
      });
    }
  });

export type TransitionAppointmentLeadInput = z.infer<
  typeof transitionAppointmentLeadSchema
>;

export const updateAppointmentLeadSchema = z
  .object({
    assigneeAccountId: z.string().uuid().nullable().optional(),
    note: z.string().trim().max(2000).nullable().optional(),
    source: leadSourceSchema.optional(),
    nextContactAt: z.string().datetime().nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.assigneeAccountId !== undefined ||
      value.note !== undefined ||
      value.source !== undefined ||
      value.nextContactAt !== undefined,
    { message: '至少提供一个可更新字段' },
  );

export type UpdateAppointmentLeadInput = z.infer<
  typeof updateAppointmentLeadSchema
>;

export const createEnrollmentRecordSchema = z
  .object({
    classId: z.string().uuid().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export type CreateEnrollmentRecordInput = z.infer<
  typeof createEnrollmentRecordSchema
>;

export const appointmentLeadListItemSchema = z
  .object({
    id: z.string().uuid(),
    campusId: z.string(),
    parentName: z.string(),
    phoneMasked: z.string(),
    childAgeOrGrade: z.string(),
    interestedCourse: z.string(),
    preferredContactTime: z.string(),
    status: appointmentLeadStatusSchema,
    assigneeAccountId: z.string().uuid().nullable(),
    note: z.string().nullable(),
    source: leadSourceSchema.nullable(),
    nextContactAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type AppointmentLeadListItem = z.infer<
  typeof appointmentLeadListItemSchema
>;

export const appointmentLeadStatusHistoryItemSchema = z
  .object({
    id: z.string().uuid(),
    fromStatus: appointmentLeadStatusSchema.nullable(),
    toStatus: appointmentLeadStatusSchema,
    changedByAccountId: z.string().uuid().nullable(),
    changedAt: z.string().datetime(),
    note: z.string().nullable(),
  })
  .strict();

export type AppointmentLeadStatusHistoryItem = z.infer<
  typeof appointmentLeadStatusHistoryItemSchema
>;

export const enrollmentRecordSchema = z
  .object({
    id: z.string().uuid(),
    appointmentLeadId: z.string().uuid(),
    campusId: z.string(),
    classId: z.string().uuid().nullable(),
    enrolledAt: z.string().datetime(),
    note: z.string().nullable(),
    createdByAccountId: z.string().uuid().nullable(),
  })
  .strict();

export type EnrollmentRecord = z.infer<typeof enrollmentRecordSchema>;

export function requiresReopenReason(
  from: AppointmentLeadStatus,
  to: AppointmentLeadStatus,
): boolean {
  return from === 'CLOSED' && to !== 'CLOSED' && to !== 'ENROLLED';
}
