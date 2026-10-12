import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  createPresignedUploadSchema,
  type CreatePresignedUploadInput,
  type ObjectStorageReadiness,
  type PresignedUpload,
} from '@budstar/contracts';
import { ApiException } from '../http/api-error';
import type { ObjectStorageAdapter } from './object-storage.boundaries';
import { OBJECT_STORAGE_ADAPTER } from './object-storage.tokens';

@Injectable()
export class ObjectStorageService {
  constructor(
    @Inject(OBJECT_STORAGE_ADAPTER)
    private readonly adapter: ObjectStorageAdapter,
  ) {}

  readiness(): ObjectStorageReadiness {
    return this.adapter.readiness();
  }

  async createPresignedUpload(
    actorAccountId: string,
    campusId: string | undefined,
    body: unknown,
  ): Promise<PresignedUpload> {
    const readiness = this.adapter.readiness();
    if (!readiness.ready) {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SERVICE_UNAVAILABLE',
        '对象存储暂不可用，请稍后重试',
        readiness.degradedReasons.map((reason) => ({ reason })),
      );
    }

    const parsed = createPresignedUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
        parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }

    try {
      return await this.adapter.createPresignedUpload({
        ...parsed.data,
        actorAccountId,
        campusId,
      });
    } catch {
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'SERVICE_UNAVAILABLE',
        '预签名上传失败，可安全重试',
      );
    }
  }

  parseInput(body: unknown): CreatePresignedUploadInput {
    const parsed = createPresignedUploadSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return parsed.data;
  }
}
