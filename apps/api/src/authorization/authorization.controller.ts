import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { campusContextSchema } from '@budstar/contracts';
import { AuditService } from '../audit/audit.service';
import { ApiException } from '../http/api-error';
import type { AuthenticatedRequest } from './authenticated-request';
import {
  AuditBusinessWrite,
  RequireCampusCapability,
  RequirePlatformCapability,
} from './authorization.decorators';

@Controller()
export class AuthorizationController {
  constructor(private readonly audit: AuditService) {}

  @Get('admin/overview')
  @RequireCampusCapability('CAMPUS_CONTEXT_READ')
  staffOverview(@Req() request: AuthenticatedRequest) {
    const membership =
      request.authorizationActor?.kind === 'staff'
        ? request.authorizationActor.memberships.find(
            ({ campusId }) => campusId === request.campusId,
          )
        : undefined;
    return {
      campusId: request.campusId,
      roles: membership?.roles ?? [],
      modules: ['课程交付', '班级管理', '作品提交', '预约线索', '成长报告'],
    };
  }

  @Post('admin/campus-context')
  @RequireCampusCapability('CAMPUS_CONTEXT_READ')
  async selectCampus(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const result = campusContextSchema.safeParse(body);
    if (!result.success || result.data.campusId !== request.campusId) {
      throw new ApiException(403, 'FORBIDDEN', '无权执行该操作');
    }
    await this.audit.record({
      actorAccountId: request.authorizationActor?.userAccountId,
      action: 'CAMPUS_CONTEXT_SELECTED',
      campusId: request.campusId,
    });
    return { campusId: request.campusId, selected: true };
  }

  @Post('admin/audited-write-probe')
  @RequireCampusCapability('SUBMISSION_REVIEW')
  @AuditBusinessWrite('authorization-probe')
  auditedWriteProbe() {
    return { accepted: true };
  }

  @Get('platform/overview')
  @RequirePlatformCapability('PLATFORM_CAMPUS_GOVERN')
  platformOverview() {
    return { scope: 'platform', modules: ['校区治理', '课程版本治理'] };
  }
}
