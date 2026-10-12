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
