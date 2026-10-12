import { z } from 'zod';

export const communityVisibilityScopes = ['FAMILY', 'CLASS', 'CAMPUS'] as const;
export const communityVisibilityScopeSchema = z.enum(communityVisibilityScopes);
export type CommunityVisibilityScope = z.infer<
  typeof communityVisibilityScopeSchema
>;

export const communityRiskLevels = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const communityRiskLevelSchema = z.enum(communityRiskLevels);
export type CommunityRiskLevel = z.infer<typeof communityRiskLevelSchema>;

export const communityContentStatuses = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'HIDDEN',
] as const;
export const communityContentStatusSchema = z.enum(communityContentStatuses);
export type CommunityContentStatus = z.infer<
  typeof communityContentStatusSchema
>;

export function assessCommunityRisk(text: string): CommunityRiskLevel {
  const normalized = text.toLowerCase();
  if (
    /自杀|自残|色情|裸体|暴力血腥|仇恨|毒品/.test(normalized) ||
    /suicide|porn|nude|extremist/.test(normalized)
  ) {
    return 'HIGH';
  }
  if (/联系方式|微信加我|私下转账|外链下载/.test(normalized)) {
    return 'MEDIUM';
  }
  return 'LOW';
}

export function initialCommunityStatusForRisk(
  risk: CommunityRiskLevel,
): CommunityContentStatus {
  if (risk === 'LOW') return 'PUBLISHED';
  if (risk === 'MEDIUM') return 'PENDING_REVIEW';
  return 'HIDDEN';
}

export function canTransitionCommunityContent(
  from: CommunityContentStatus,
  to: CommunityContentStatus,
): boolean {
  const allowed: Record<
    CommunityContentStatus,
    readonly CommunityContentStatus[]
  > = {
    DRAFT: ['PENDING_REVIEW', 'PUBLISHED', 'HIDDEN'],
    PENDING_REVIEW: ['PUBLISHED', 'REJECTED', 'HIDDEN'],
    PUBLISHED: ['HIDDEN'],
    REJECTED: ['PENDING_REVIEW', 'HIDDEN'],
    HIDDEN: ['PENDING_REVIEW', 'PUBLISHED', 'REJECTED'],
  };
  return allowed[from].includes(to);
}

export const createCommunityPostSchema = z
  .object({
    studentProfileId: z.string().uuid(),
    classId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(4000),
    visibilityScope: communityVisibilityScopeSchema,
    workSubmissionId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      (value.visibilityScope === 'CLASS' ||
        value.visibilityScope === 'CAMPUS') &&
      !value.classId
    ) {
      ctx.addIssue({
        code: 'custom',
        message: '班级/校区可见内容必须指定班级',
        path: ['classId'],
      });
    }
  });

export type CreateCommunityPostInput = z.infer<
  typeof createCommunityPostSchema
>;

export const reviewCommunityPostSchema = z
  .object({
    action: z.enum(['approve', 'reject', 'hide']),
    note: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export type ReviewCommunityPostInput = z.infer<
  typeof reviewCommunityPostSchema
>;

export const communityPostSchema = z
  .object({
    id: z.string().uuid(),
    campusId: z.string(),
    classId: z.string().uuid().nullable(),
    studentProfileId: z.string().uuid(),
    studentDisplayName: z.string(),
    title: z.string(),
    body: z.string(),
    visibilityScope: communityVisibilityScopeSchema,
    riskLevel: communityRiskLevelSchema,
    status: communityContentStatusSchema,
    publishedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type CommunityPost = z.infer<typeof communityPostSchema>;

export const listCommunityFeedQuerySchema = z
  .object({
    studentProfileId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
  })
  .strict();

export type ListCommunityFeedQuery = z.infer<
  typeof listCommunityFeedQuerySchema
>;
