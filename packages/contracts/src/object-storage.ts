import { z } from 'zod';

export const objectStorageAllowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'video/mp4',
] as const;

export const objectStorageAllowedMimeTypeSchema = z.enum(
  objectStorageAllowedMimeTypes,
);
export type ObjectStorageAllowedMimeType = z.infer<
  typeof objectStorageAllowedMimeTypeSchema
>;

/** Default upload size cap: 20 MiB. */
export const OBJECT_STORAGE_MAX_BYTES = 20 * 1024 * 1024;

export const createPresignedUploadSchema = z
  .object({
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[^/\\]+$/, '文件名不能包含路径分隔符'),
    contentType: objectStorageAllowedMimeTypeSchema,
    contentLength: z
      .number()
      .int()
      .positive()
      .max(OBJECT_STORAGE_MAX_BYTES, '文件超过大小限制'),
    purpose: z
      .enum(['submission', 'avatar', 'report-attachment'])
      .default('submission'),
  })
  .strict();

export type CreatePresignedUploadInput = z.infer<
  typeof createPresignedUploadSchema
>;

export const presignedUploadSchema = z
  .object({
    uploadUrl: z.string().url(),
    objectKey: z.string().min(1),
    /** Stable retrieval URL that never embeds provider secrets. */
    accessUrl: z.string().url(),
    expiresAt: z.string().datetime(),
    maxBytes: z.number().int().positive(),
    contentType: objectStorageAllowedMimeTypeSchema,
    retryable: z.literal(true),
  })
  .strict()
  .refine(
    (value) =>
      !/[?&](SecretId|SecretKey|secret|sk=|AWSAccessKeyId)=/i.test(
        value.uploadUrl,
      ) &&
      !/[?&](SecretId|SecretKey|secret|sk=|AWSAccessKeyId)=/i.test(
        value.accessUrl,
      ),
    { message: '预签名 URL 不得泄露密钥参数' },
  );

export type PresignedUpload = z.infer<typeof presignedUploadSchema>;

export const objectStorageReadinessSchema = z
  .object({
    ready: z.boolean(),
    provider: z.enum(['local', 'cos', 'degraded']),
    degradedReasons: z.array(z.string()),
  })
  .strict();

export type ObjectStorageReadiness = z.infer<
  typeof objectStorageReadinessSchema
>;
