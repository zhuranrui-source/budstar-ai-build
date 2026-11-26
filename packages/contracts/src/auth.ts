import { z } from 'zod';

export const accountKinds = [
  'parent',
  'student',
  'staff',
  'partner',
  'platform-admin',
] as const;
export const staffRoles = ['TEACHER'] as const;
export const consumerIdentities = ['parent', 'student'] as const;

export const parentOtpRequestSchema = z.object({
  phone: z.string().regex(/^1\d{10}$/),
});

export const parentOtpVerifySchema = parentOtpRequestSchema.extend({
  code: z.string().regex(/^\d{6}$/),
});

/** 官网客户登录密码：8-64 位，需同时包含字母和数字。 */
const consumerPasswordSchema = z
  .string()
  .min(8)
  .max(64)
  .regex(/[A-Za-z]/)
  .regex(/\d/);

const consumerUsernameSchema = z.string().regex(/^[A-Za-z0-9_]{4,20}$/);

export const parentPasswordLoginSchema = z.object({
  username: z.string().min(1).max(32),
  password: z.string().min(1).max(128),
});

/** 平台为官网客户统一分配账号密码（按手机号关联到同一客户）。 */
export const consumerCredentialAssignSchema = z.object({
  phone: z.string().regex(/^1\d{10}$/),
  username: consumerUsernameSchema,
  password: consumerPasswordSchema,
});

export const passwordLoginSchema = z.object({
  loginIdentifier: z.string().min(3).max(255),
  password: z.string().min(8).max(128),
});

export const secondFactorSchema = z.object({
  challengeToken: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});

export const switchConsumerIdentitySchema = z.object({
  identity: z.enum(consumerIdentities),
});

export const wechatCodeLoginSchema = z.object({
  code: z.string().min(1).max(512),
});

export const wechatBindPhoneSchema = z.object({
  code: z.string().min(1).max(512),
});

export const campusContextSchema = z.object({
  campusId: z.string().min(1).max(64),
});

export type AccountKind = (typeof accountKinds)[number];
export type StaffRole = (typeof staffRoles)[number];
export type ConsumerIdentity = (typeof consumerIdentities)[number];

export type AuthenticatedSession = {
  accessToken: string;
  accessTokenExpiresAt: string;
  actor: {
    kind: AccountKind;
    userAccountId: string;
    displayName: string;
  };
  availableIdentities?: ConsumerIdentity[];
  activeIdentity?: ConsumerIdentity;
  campuses: Array<{
    id: string;
    name: string;
    roles: StaffRole[];
  }>;
};

export type AuthenticationChallenge = {
  challengeToken: string;
  secondFactorRequired: true;
};
