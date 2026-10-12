import { Body, Controller, Get, HttpStatus, Post, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import {
  AuditBusinessWrite,
  Public,
  RequireCampusCapability,
} from '../authorization/authorization.decorators';
import { ApiException } from '../http/api-error';
import { ObjectStorageService } from './object-storage.service';

@Controller('object-storage')
export class ObjectStorageController {
  constructor(private readonly objectStorage: ObjectStorageService) {}

  @Get('readiness')
  @Public()
  readiness() {
    return this.objectStorage.readiness();
  }

  @Post('presign')
  @AuditBusinessWrite('object-storage')
  @RequireCampusCapability('CLASS_MANAGE')
  createPresignedUpload(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const actor = request.authorizationActor;
    if (!actor) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'UNAUTHORIZED',
        '请先登录',
      );
    }
    return this.objectStorage.createPresignedUpload(
      actor.userAccountId,
      request.campusId,
      body,
    );
  }
}

@Controller('family/object-storage')
export class FamilyObjectStorageController {
  constructor(private readonly objectStorage: ObjectStorageService) {}

  @Post('presign')
  @AuditBusinessWrite('object-storage')
  createPresignedUpload(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const actor = request.authorizationActor;
    if (!actor || (actor.kind !== 'parent' && actor.kind !== 'student')) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        '仅家庭成员可申请上传',
      );
    }
    return this.objectStorage.createPresignedUpload(
      actor.userAccountId,
      undefined,
      body,
    );
  }
}
