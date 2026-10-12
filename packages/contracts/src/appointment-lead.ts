import { z } from 'zod';

export const appointmentLeadStatuses = [
  'PENDING_CONTACT',
  'CONTACTED',
  'APPOINTMENT_SCHEDULED',
  'VISITED',
  'ENROLLED',
  'CLOSED',
] as const;

export const appointmentLeadStatusSchema = z.enum(appointmentLeadStatuses);

export type AppointmentLeadStatus = z.infer<typeof appointmentLeadStatusSchema>;

const appointmentLeadTransitions: Record<
  AppointmentLeadStatus,
  readonly AppointmentLeadStatus[]
> = {
  PENDING_CONTACT: ['CONTACTED', 'CLOSED'],
  CONTACTED: ['APPOINTMENT_SCHEDULED', 'CLOSED'],
  APPOINTMENT_SCHEDULED: ['VISITED', 'CLOSED'],
  VISITED: ['ENROLLED', 'CLOSED'],
  ENROLLED: [],
  // 已关闭可重开到任一未报名跟进状态，须由服务端强制记录原因
  CLOSED: ['PENDING_CONTACT', 'CONTACTED', 'APPOINTMENT_SCHEDULED', 'VISITED'],
};

export function canTransitionAppointmentLead(
  from: AppointmentLeadStatus,
  to: AppointmentLeadStatus,
): boolean {
  return appointmentLeadTransitions[from].includes(to);
}

export const createAppointmentLeadSchema = z
  .object({
    parentName: z.string().trim().min(1).max(50),
    phone: z
      .string()
      .trim()
      .regex(/^1[3-9]\d{9}$/, '请输入有效的中国大陆手机号'),
    childAgeOrGrade: z.string().trim().min(1).max(30),
    interestedCourse: z.string().trim().min(1).max(100),
    campusId: z.string().trim().min(1).max(64),
    preferredContactTime: z.string().trim().min(1).max(100),
  })
  .strict();

export type CreateAppointmentLeadInput = z.infer<
  typeof createAppointmentLeadSchema
>;

export const appointmentLeadCreatedSchema = z.object({
  id: z.string(),
  status: z.literal('PENDING_CONTACT'),
  createdAt: z.string().datetime(),
});

export type AppointmentLeadCreated = z.infer<
  typeof appointmentLeadCreatedSchema
>;

export const publicCampusSchema = z
  .object({
    id: z.string().trim().min(1).max(64),
    name: z.string().trim().min(1).max(100),
  })
  .strict();

export const publicCampusListSchema = z.array(publicCampusSchema);

export type PublicCampus = z.infer<typeof publicCampusSchema>;
