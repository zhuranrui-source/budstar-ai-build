import { Module } from '@nestjs/common';
import {
  CosObjectStorageAdapter,
  DegradedObjectStorageAdapter,
  LocalObjectStorageAdapter,
} from './object-storage.adapters';
import { resolveObjectStorageAdapter } from './object-storage.boundaries';
import {
  FamilyObjectStorageController,
  ObjectStorageController,
} from './object-storage.controller';
import { ObjectStorageService } from './object-storage.service';
import { OBJECT_STORAGE_ADAPTER } from './object-storage.tokens';

@Module({
  controllers: [ObjectStorageController, FamilyObjectStorageController],
  providers: [
    {
      provide: OBJECT_STORAGE_ADAPTER,
      useFactory: () =>
        resolveObjectStorageAdapter(
          {
            nodeEnv: process.env.NODE_ENV,
            provider: process.env.OBJECT_STORAGE_PROVIDER,
            localRoot: process.env.OBJECT_STORAGE_LOCAL_ROOT,
            publicBaseUrl: process.env.OBJECT_STORAGE_PUBLIC_BASE_URL,
            cos: {
              secretId: process.env.COS_SECRET_ID,
              secretKey: process.env.COS_SECRET_KEY,
              bucket: process.env.COS_BUCKET,
              region: process.env.COS_REGION,
              publicBaseUrl: process.env.COS_PUBLIC_BASE_URL,
            },
          },
          {
            createLocal: (config) =>
              new LocalObjectStorageAdapter(
                config.rootDir,
                config.publicBaseUrl,
              ),
            createCos: (config) => new CosObjectStorageAdapter(config),
            createDegraded: (reasons) =>
              new DegradedObjectStorageAdapter(reasons),
          },
        ),
    },
    ObjectStorageService,
  ],
  exports: [ObjectStorageService],
})
export class ObjectStorageModule {}
