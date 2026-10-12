import { describe, expect, it } from 'vitest';
import {
  createPresignedUploadSchema,
  OBJECT_STORAGE_MAX_BYTES,
  objectStorageAllowedMimeTypes,
  presignedUploadSchema,
} from './object-storage';

describe('object storage contract', () => {
  it('rejects disallowed mime types and oversized uploads', () => {
    expect(
      createPresignedUploadSchema.safeParse({
        fileName: 'work.png',
        contentType: 'image/png',
        contentLength: 1024,
      }).success,
    ).toBe(true);
    expect(
      createPresignedUploadSchema.safeParse({
        fileName: 'evil.exe',
        contentType: 'application/octet-stream',
        contentLength: 1024,
      }).success,
    ).toBe(false);
    expect(
      createPresignedUploadSchema.safeParse({
        fileName: 'big.png',
        contentType: 'image/png',
        contentLength: OBJECT_STORAGE_MAX_BYTES + 1,
      }).success,
    ).toBe(false);
  });

  it('rejects path separators in file names', () => {
    expect(
      createPresignedUploadSchema.safeParse({
        fileName: '../escape.png',
        contentType: 'image/png',
        contentLength: 10,
      }).success,
    ).toBe(false);
  });

  it('rejects URLs that embed provider secrets', () => {
    expect(
      presignedUploadSchema.safeParse({
        uploadUrl: 'https://cos.example.com/put?SecretKey=abc',
        objectKey: 'a/b.png',
        accessUrl: 'https://cdn.example.com/a/b.png',
        expiresAt: new Date().toISOString(),
        maxBytes: 100,
        contentType: 'image/png',
        retryable: true,
      }).success,
    ).toBe(false);
  });

  it('lists allowed mime types for submissions', () => {
    expect(objectStorageAllowedMimeTypes).toContain('image/jpeg');
    expect(objectStorageAllowedMimeTypes).toContain('video/mp4');
  });
});
