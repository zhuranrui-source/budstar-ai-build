import { createHmac, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  OBJECT_STORAGE_MAX_BYTES,
  type ObjectStorageReadiness,
  type PresignedUpload,
} from '@budstar/contracts';
import type {
  ObjectStorageAdapter,
  ObjectStoragePresignRequest,
} from './object-storage.boundaries';

export class LocalObjectStorageAdapter implements ObjectStorageAdapter {
  readonly provider = 'local' as const;

  constructor(
    private readonly rootDir: string,
    private readonly publicBaseUrl: string,
    private readonly signingSecret = process.env.AUTH_TOKEN_SECRET ??
      'local-object-storage-secret',
  ) {
    mkdirSync(this.rootDir, { recursive: true });
  }

  createPresignedUpload(
    input: ObjectStoragePresignRequest,
  ): Promise<PresignedUpload> {
    const objectKey = [
      input.purpose,
      input.campusId ?? 'shared',
      input.actorAccountId,
      `${randomUUID()}-${sanitizeFileName(input.fileName)}`,
    ].join('/');
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    const signature = this.sign(objectKey, expiresAt.toISOString());
    const uploadUrl = `${this.publicBaseUrl}/local-upload?key=${encodeURIComponent(objectKey)}&expires=${encodeURIComponent(expiresAt.toISOString())}&sig=${signature}`;
    const accessUrl = `${this.publicBaseUrl}/objects/${encodeURIComponent(objectKey)}`;

    // Ensure parent directory exists for subsequent local PUT handlers.
    mkdirSync(join(this.rootDir, objectKey, '..'), { recursive: true });

    return Promise.resolve({
      uploadUrl,
      objectKey,
      accessUrl,
      expiresAt: expiresAt.toISOString(),
      maxBytes: Math.min(input.contentLength, OBJECT_STORAGE_MAX_BYTES),
      contentType: input.contentType,
      retryable: true,
    });
  }

  readiness(): ObjectStorageReadiness {
    return {
      ready: true,
      provider: 'local',
      degradedReasons: [],
    };
  }

  verifyUploadSignature(
    objectKey: string,
    expiresAt: string,
    signature: string,
  ): boolean {
    if (new Date(expiresAt).getTime() <= Date.now()) return false;
    const expected = this.sign(objectKey, expiresAt);
    return expected === signature;
  }

  private sign(objectKey: string, expiresAt: string): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${objectKey}:${expiresAt}`)
      .digest('hex');
  }
}

export class CosObjectStorageAdapter implements ObjectStorageAdapter {
  readonly provider = 'cos' as const;

  constructor(
    private readonly config: {
      secretId: string;
      secretKey: string;
      bucket: string;
      region: string;
      publicBaseUrl: string;
    },
  ) {}

  createPresignedUpload(
    input: ObjectStoragePresignRequest,
  ): Promise<PresignedUpload> {
    const objectKey = [
      input.purpose,
      input.campusId ?? 'shared',
      input.actorAccountId,
      `${randomUUID()}-${sanitizeFileName(input.fileName)}`,
    ].join('/');
    const expiresAt = new Date(Date.now() + 15 * 60_000);
    // Production COS signing would use the official SDK. The seam returns a
    // opaque signed path that never embeds SecretId/SecretKey query params.
    const token = createHmac('sha256', this.config.secretKey)
      .update(
        `${this.config.secretId}:${this.config.bucket}:${objectKey}:${expiresAt.toISOString()}`,
      )
      .digest('hex');
    const uploadUrl = `https://${this.config.bucket}.cos.${this.config.region}.myqcloud.com/${objectKey}?x-cos-security-token=${token}&expires=${encodeURIComponent(expiresAt.toISOString())}`;
    const accessUrl = `${this.config.publicBaseUrl.replace(/\/$/, '')}/${objectKey}`;
    return Promise.resolve({
      uploadUrl,
      objectKey,
      accessUrl,
      expiresAt: expiresAt.toISOString(),
      maxBytes: Math.min(input.contentLength, OBJECT_STORAGE_MAX_BYTES),
      contentType: input.contentType,
      retryable: true,
    });
  }

  readiness(): ObjectStorageReadiness {
    return {
      ready: true,
      provider: 'cos',
      degradedReasons: [],
    };
  }
}

export class DegradedObjectStorageAdapter implements ObjectStorageAdapter {
  readonly provider = 'local' as const;

  constructor(private readonly reasons: string[]) {}

  createPresignedUpload(): Promise<PresignedUpload> {
    return Promise.reject(
      Object.assign(new Error('Object storage is degraded'), {
        code: 'SERVICE_UNAVAILABLE',
      }),
    );
  }

  readiness(): ObjectStorageReadiness {
    return {
      ready: false,
      provider: 'degraded',
      degradedReasons: this.reasons,
    };
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}
