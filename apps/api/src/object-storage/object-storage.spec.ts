import {
  CosObjectStorageAdapter,
  DegradedObjectStorageAdapter,
  LocalObjectStorageAdapter,
} from './object-storage.adapters';
import { resolveObjectStorageAdapter } from './object-storage.boundaries';
import { ObjectStorageService } from './object-storage.service';
import { OBJECT_STORAGE_ADAPTER } from './object-storage.tokens';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('object storage', () => {
  it('issues local presigned uploads without leaking secrets', async () => {
    const root = mkdtempSync(join(tmpdir(), 'budstar-os-'));
    try {
      const adapter = new LocalObjectStorageAdapter(
        root,
        'http://localhost:3001/api/object-storage',
      );
      const upload = await adapter.createPresignedUpload({
        fileName: 'work.png',
        contentType: 'image/png',
        contentLength: 2048,
        purpose: 'submission',
        actorAccountId: 'account-1',
        campusId: 'campus-a',
      });
      expect(upload.retryable).toBe(true);
      expect(upload.uploadUrl).toContain('/local-upload?');
      expect(upload.uploadUrl).not.toMatch(/SecretKey|SecretId|sk=/i);
      expect(upload.accessUrl).not.toMatch(/SecretKey|SecretId|sk=/i);
      expect(adapter.readiness().ready).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fail-closes production COS when config is missing', () => {
    expect(() =>
      resolveObjectStorageAdapter(
        {
          nodeEnv: 'production',
          provider: 'cos',
          cos: {},
        },
        {
          createLocal: () => {
            throw new Error('unused');
          },
          createCos: () => {
            throw new Error('unused');
          },
          createDegraded: (reasons) =>
            new DegradedObjectStorageAdapter(reasons),
        },
      ),
    ).toThrow(/fail-closed/);
  });

  it('degrades non-production COS without config', async () => {
    const adapter = resolveObjectStorageAdapter(
      {
        nodeEnv: 'test',
        provider: 'cos',
        cos: {},
      },
      {
        createLocal: () => {
          throw new Error('unused');
        },
        createCos: () => {
          throw new Error('unused');
        },
        createDegraded: (reasons) => new DegradedObjectStorageAdapter(reasons),
      },
    );
    expect(adapter.readiness()).toMatchObject({
      ready: false,
      provider: 'degraded',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: OBJECT_STORAGE_ADAPTER, useValue: adapter },
        ObjectStorageService,
      ],
    }).compile();
    const service = moduleRef.get(ObjectStorageService);
    await expect(
      service.createPresignedUpload('a1', 'campus', {
        fileName: 'a.png',
        contentType: 'image/png',
        contentLength: 10,
      }),
    ).rejects.toMatchObject({ response: { code: 'SERVICE_UNAVAILABLE' } });
  });

  it('COS adapter returns opaque signed URLs', async () => {
    const adapter = new CosObjectStorageAdapter({
      secretId: 'AKIDtest',
      secretKey: 'super-secret-key',
      bucket: 'budstar-dev',
      region: 'ap-guangzhou',
      publicBaseUrl: 'https://cdn.example.com',
    });
    const upload = await adapter.createPresignedUpload({
      fileName: 'clip.mp4',
      contentType: 'video/mp4',
      contentLength: 1000,
      purpose: 'submission',
      actorAccountId: 'acct',
    });
    expect(upload.uploadUrl).not.toContain('super-secret-key');
    expect(upload.uploadUrl).not.toContain('SecretKey');
    expect(upload.accessUrl).toContain('https://cdn.example.com/');
  });
});
