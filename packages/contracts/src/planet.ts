import { z } from 'zod';

/** 星芽星球：作品 / 竞赛 / 公司文化 / 课程内容。 */
export const planetCategories = [
  'WORK',
  'COMPETITION',
  'CULTURE',
  'COURSE',
] as const;
export type PlanetCategory = (typeof planetCategories)[number];

export const planetPostStatuses = [
  'PUBLISHED',
  'PENDING_REVIEW',
  'REMOVED',
] as const;
export type PlanetPostStatus = (typeof planetPostStatuses)[number];

export const planetCommentStatuses = planetPostStatuses;
export type PlanetCommentStatus = PlanetPostStatus;

/** 孩子称呼只收一个字（汉字或字母），前台显示为“小X”。 */
const studentInitialSchema = z
  .string()
  .trim()
  .regex(/^[\u4e00-\u9fa5A-Za-z]$/, '孩子称呼只填一个字');

const imageUrlSchema = z
  .string()
  .max(300)
  .regex(/^\/media\/planet\/[0-9]{6}\/[0-9a-f-]{36}\.(jpg|png|webp)$/);

const postBaseSchema = z.object({
  title: z.string().trim().min(1).max(60),
  body: z.string().trim().max(2000).default(''),
  imageUrls: z.array(imageUrlSchema).max(9).default([]),
  studentInitial: studentInitialSchema.optional(),
  guardianConsent: z.boolean().default(false),
});

/** 家长发布：只能发作品或竞赛成果，必须勾选监护人同意。 */
export const memberCreatePlanetPostSchema = postBaseSchema
  .extend({
    category: z.enum(['WORK', 'COMPETITION']),
    guardianConsent: z.literal(true),
  })
  .refine((value) => value.imageUrls.length > 0 || value.body.length > 0, {
    message: '请至少上传一张图片或填写内容',
  });

/** 员工发布：四类均可；涉及孩子时必须勾选已取得监护人授权。 */
export const adminCreatePlanetPostSchema = postBaseSchema
  .extend({
    category: z.enum(planetCategories),
    pinned: z.boolean().default(false),
  })
  .refine((value) => !value.studentInitial || value.guardianConsent, {
    message: '涉及孩子的内容须先取得监护人授权',
    path: ['guardianConsent'],
  });

export const adminUpdatePlanetPostSchema = z.object({
  status: z.enum(planetPostStatuses).optional(),
  pinned: z.boolean().optional(),
});

export const createPlanetCommentSchema = z.object({
  body: z.string().trim().min(1).max(300),
});

export const adminUpdatePlanetCommentSchema = z.object({
  status: z.enum(planetCommentStatuses),
});

export type MemberCreatePlanetPostInput = z.infer<
  typeof memberCreatePlanetPostSchema
>;
export type AdminCreatePlanetPostInput = z.infer<
  typeof adminCreatePlanetPostSchema
>;

export type PlanetPostView = {
  id: string;
  category: PlanetCategory;
  title: string;
  body: string;
  imageUrls: string[];
  /** 例如“小星”；未涉及孩子时为 null。 */
  studentLabel: string | null;
  authorLabel: string;
  pinned: boolean;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  createdAt: string;
};

export type PlanetCommentView = {
  id: string;
  body: string;
  authorLabel: string;
  createdAt: string;
};

export type PlanetPostDetailView = PlanetPostView & {
  comments: PlanetCommentView[];
};

export type PlanetViewerState = {
  postId: string;
  liked: boolean;
  favorited: boolean;
};

export type AdminPlanetPostView = PlanetPostView & {
  status: PlanetPostStatus;
  authorKind: 'STAFF' | 'PARENT';
  reviewReason: string | null;
};

export type AdminPlanetCommentView = PlanetCommentView & {
  postId: string;
  postTitle: string;
  status: PlanetCommentStatus;
  reviewReason: string | null;
};
