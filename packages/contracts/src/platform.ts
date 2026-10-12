import { z } from 'zod';

/** Controlled entity browser — never accepts arbitrary SQL. */

export const platformBrowsableEntities = [
  'campus',
  'appointment_lead',
  'teaching_class',
  'work_submission',
  'formal_feedback',
  'growth_report',
  'community_post',
] as const;

export const platformBrowsableEntitySchema = z.enum(platformBrowsableEntities);
export type PlatformBrowsableEntity = z.infer<
  typeof platformBrowsableEntitySchema
>;

export const PLATFORM_ENTITY_FIELDS: Record<
  PlatformBrowsableEntity,
  readonly string[]
> = {
  campus: ['id', 'code', 'name', 'createdAt'],
  appointment_lead: [
    'id',
    'campusId',
    'parentName',
    'phoneMasked',
    'status',
    'createdAt',
  ],
  teaching_class: [
    'id',
    'campusId',
    'name',
    'classCode',
    'status',
    'createdAt',
  ],
  work_submission: [
    'id',
    'campusId',
    'classId',
    'studentProfileId',
    'status',
    'title',
    'updatedAt',
  ],
  formal_feedback: [
    'id',
    'campusId',
    'studentProfileId',
    'status',
    'version',
    'publishedAt',
  ],
  growth_report: [
    'id',
    'campusId',
    'studentProfileId',
    'milestone',
    'status',
    'publishedAt',
  ],
  community_post: [
    'id',
    'campusId',
    'studentProfileId',
    'visibilityScope',
    'riskLevel',
    'status',
    'publishedAt',
  ],
};

export const platformDataBrowseQuerySchema = z
  .object({
    entity: platformBrowsableEntitySchema,
    campusId: z.string().min(1).max(64).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type PlatformDataBrowseQuery = z.infer<
  typeof platformDataBrowseQuerySchema
>;

export const platformDataBrowseResultSchema = z
  .object({
    entity: platformBrowsableEntitySchema,
    fields: z.array(z.string()),
    rows: z.array(z.record(z.string(), z.unknown())),
    truncated: z.boolean(),
  })
  .strict();

export type PlatformDataBrowseResult = z.infer<
  typeof platformDataBrowseResultSchema
>;

export function assertNoArbitrarySql(input: unknown): void {
  const serialized = JSON.stringify(input).toLowerCase();
  if (
    /\b(select|insert|update|delete|drop|alter|truncate|union|--|;)\b/.test(
      serialized,
    )
  ) {
    throw new Error('Arbitrary SQL is not allowed in platform data browser');
  }
}
