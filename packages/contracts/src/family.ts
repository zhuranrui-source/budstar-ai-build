import { z } from 'zod';

export const guardianBindingStatuses = [
  'PENDING',
  'ACTIVE',
  'REVOKED',
] as const;
export const guardianBindingStatusSchema = z.enum(guardianBindingStatuses);
export type GuardianBindingStatus = z.infer<typeof guardianBindingStatusSchema>;

export const guardianConsentTypes = [
  'MINOR_DATA_PROCESSING',
  'WORK_DISPLAY',
  'DISPLAY_SWITCH',
  'ACTIVITY_PARTICIPATION',
] as const;
export const guardianConsentTypeSchema = z.enum(guardianConsentTypes);
export type GuardianConsentType = z.infer<typeof guardianConsentTypeSchema>;

const bindingTransitions: Record<
  GuardianBindingStatus,
  readonly GuardianBindingStatus[]
> = {
  PENDING: ['ACTIVE', 'REVOKED'],
  ACTIVE: ['REVOKED'],
  REVOKED: ['PENDING', 'ACTIVE'],
};

export function canTransitionGuardianBindingStatus(
  from: GuardianBindingStatus,
  to: GuardianBindingStatus,
): boolean {
  return bindingTransitions[from].includes(to);
}

export const CURRENT_GUARDIAN_CONSENT_POLICY_VERSION = '2026-07-01';

export const createStudentProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100),
  })
  .strict();

export type CreateStudentProfileInput = z.infer<
  typeof createStudentProfileSchema
>;

export const bindFamilyViewCodeSchema = z
  .object({
    familyViewCode: z
      .string()
      .trim()
      .regex(/^[A-Z0-9]{8}$/, '家庭查看码须为 8 位大写字母或数字'),
    displaySwitchGranted: z.boolean().optional(),
  })
  .strict();

export type BindFamilyViewCodeInput = z.infer<typeof bindFamilyViewCodeSchema>;

export const selectActiveStudentSchema = z
  .object({
    studentProfileId: z.string().uuid(),
  })
  .strict();

export type SelectActiveStudentInput = z.infer<
  typeof selectActiveStudentSchema
>;

export const recordGuardianConsentSchema = z
  .object({
    studentProfileId: z.string().uuid(),
    type: guardianConsentTypeSchema,
    granted: z.boolean(),
    policyVersion: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .default(CURRENT_GUARDIAN_CONSENT_POLICY_VERSION),
  })
  .strict();

export type RecordGuardianConsentInput = z.infer<
  typeof recordGuardianConsentSchema
>;

export const familyBindingSummarySchema = z
  .object({
    id: z.string().uuid(),
    campusId: z.string(),
    parentProfileId: z.string().uuid(),
    studentProfileId: z.string().uuid(),
    studentDisplayName: z.string(),
    status: guardianBindingStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type FamilyBindingSummary = z.infer<typeof familyBindingSummarySchema>;

export const studentProfileSummarySchema = z
  .object({
    id: z.string().uuid(),
    campusId: z.string(),
    displayName: z.string(),
    hasFamilyViewCode: z.boolean(),
    familyViewCodeUpdatedAt: z.string().datetime().nullable(),
    activeBindingCount: z.number().int().nonnegative(),
  })
  .strict();

export type StudentProfileSummary = z.infer<typeof studentProfileSummarySchema>;

export const familyViewCodeIssuedSchema = z
  .object({
    studentProfileId: z.string().uuid(),
    familyViewCode: z.string(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type FamilyViewCodeIssued = z.infer<typeof familyViewCodeIssuedSchema>;

export const guardianConsentRecordSchema = z
  .object({
    id: z.string().uuid(),
    campusId: z.string(),
    parentProfileId: z.string().uuid(),
    studentProfileId: z.string().uuid(),
    type: guardianConsentTypeSchema,
    policyVersion: z.string(),
    granted: z.boolean(),
    recordedAt: z.string().datetime(),
    revokedAt: z.string().datetime().nullable(),
  })
  .strict();

export type GuardianConsentRecord = z.infer<typeof guardianConsentRecordSchema>;

export const workDisplayEligibilitySchema = z
  .object({
    studentProfileId: z.string().uuid(),
    canDisplayPublicly: z.boolean(),
    reason: z.enum([
      'WORK_DISPLAY_GRANTED',
      'WORK_DISPLAY_MISSING',
      'WORK_DISPLAY_REVOKED',
      'DISPLAY_SWITCH_GRANTED',
      'DISPLAY_SWITCH_REVOKED',
      'BINDING_INACTIVE',
    ]),
    policyVersion: z.string().nullable(),
  })
  .strict();

export type WorkDisplayEligibility = z.infer<
  typeof workDisplayEligibilitySchema
>;

export const parentStudentSwitcherSchema = z
  .object({
    students: z.array(
      z
        .object({
          studentProfileId: z.string().uuid(),
          displayName: z.string(),
          campusId: z.string(),
          bindingId: z.string().uuid(),
        })
        .strict(),
    ),
    selectedStudentProfileId: z.string().uuid().nullable(),
  })
  .strict();

export type ParentStudentSwitcher = z.infer<typeof parentStudentSwitcherSchema>;
