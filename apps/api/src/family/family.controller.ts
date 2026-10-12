import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  bindFamilyViewCodeSchema,
  recordGuardianConsentSchema,
  saveWorkSubmissionDraftSchema,
  selectActiveStudentSchema,
  transitionWorkSubmissionSchema,
} from '@budstar/contracts';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import { AuditBusinessWrite } from '../authorization/authorization.decorators';
import { ApiException } from '../http/api-error';
import { SubmissionsService } from '../submissions/submissions.service';
import { FamilyService } from './family.service';

@Controller('family')
export class FamilyController {
  constructor(
    private readonly family: FamilyService,
    private readonly submissions: SubmissionsService,
  ) {}

  /**
   * ADR-0007：家庭视图学习代理——家长以受绑定约束的方式
   * 访问学生的课节与作品数据；学生是档案，不是登录身份。
   */
  @Get('students/:studentProfileId/classes')
  async listStudentClasses(
    @Req() request: AuthenticatedRequest,
    @Param('studentProfileId') studentProfileId: string,
  ) {
    const parent = this.requireParent(request);
    await this.family.assertParentStudentAccess(
      parent.parentProfileId,
      studentProfileId,
    );
    return this.submissions.listMemberships(studentProfileId);
  }

  @Put('students/:studentProfileId/submissions/draft')
  @AuditBusinessWrite('work-submission')
  async saveStudentSubmissionDraft(
    @Req() request: AuthenticatedRequest,
    @Param('studentProfileId') studentProfileId: string,
    @Body() body: unknown,
  ) {
    const parent = this.requireParent(request);
    await this.family.assertParentStudentAccess(
      parent.parentProfileId,
      studentProfileId,
    );
    const parsed = saveWorkSubmissionDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    // 家长作为协助者操作；作品归属路由指定的学生档案（绑定已校验）
    return this.submissions.saveDraft(studentProfileId, parsed.data);
  }

  @Post('students/:studentProfileId/submissions/:submissionId/transitions')
  @AuditBusinessWrite('work-submission')
  async transitionStudentSubmission(
    @Req() request: AuthenticatedRequest,
    @Param('studentProfileId') studentProfileId: string,
    @Param('submissionId') submissionId: string,
    @Body() body: unknown,
  ) {
    const parent = this.requireParent(request);
    await this.family.assertParentStudentAccess(
      parent.parentProfileId,
      studentProfileId,
    );
    const parsed = transitionWorkSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    // 协助者账号记录进状态历史（changedByAccountId = 家长账号）
    return this.submissions.transitionOwn(
      studentProfileId,
      submissionId,
      parsed.data,
      parent.userAccountId,
    );
  }

  @Get('students/:studentProfileId/classes/:classId/lessons')
  async getStudentCurriculum(
    @Req() request: AuthenticatedRequest,
    @Param('studentProfileId') studentProfileId: string,
    @Param('classId') classId: string,
  ) {
    const parent = this.requireParent(request);
    await this.family.assertParentStudentAccess(
      parent.parentProfileId,
      studentProfileId,
    );
    return this.submissions.getCurriculum(studentProfileId, classId);
  }

  @Post('bindings')
  @AuditBusinessWrite('guardian-binding')
  async bind(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const parent = this.requireParent(request);
    const parsed = bindFamilyViewCodeSchema.safeParse(body);
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
    return this.family.bindWithViewCode(parent, parsed.data);
  }

  @Get('bindings')
  listBindings(@Req() request: AuthenticatedRequest) {
    const parent = this.requireParent(request);
    return this.family.listParentBindings(parent.parentProfileId);
  }

  @Post('bindings/:id/revoke')
  @AuditBusinessWrite('guardian-binding')
  revokeBinding(
    @Req() request: AuthenticatedRequest,
    @Param('id') bindingId: string,
  ) {
    const parent = this.requireParent(request);
    return this.family.revokeOwnBinding(parent.parentProfileId, bindingId);
  }

  @Get('students')
  listStudents(@Req() request: AuthenticatedRequest) {
    const parent = this.requireParent(request);
    return this.family.getStudentSwitcher(parent.parentProfileId);
  }

  @Post('active-student')
  @AuditBusinessWrite('guardian-binding')
  selectStudent(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const parent = this.requireParent(request);
    const parsed = selectActiveStudentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.family.selectActiveStudent(parent.parentProfileId, parsed.data);
  }

  @Post('consents')
  @AuditBusinessWrite('guardian-consent')
  recordConsent(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const parent = this.requireParent(request);
    const parsed = recordGuardianConsentSchema.safeParse(body);
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
    return this.family.recordConsent(parent, parsed.data);
  }

  @Get('consents')
  listConsents(
    @Req() request: AuthenticatedRequest,
    @Query('studentProfileId') studentProfileId: string | undefined,
  ) {
    const parent = this.requireParent(request);
    if (!studentProfileId) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '缺少 studentProfileId',
      );
    }
    return this.family.listConsents(parent.parentProfileId, studentProfileId);
  }

  @Get('work-display/:studentProfileId')
  workDisplay(
    @Req() request: AuthenticatedRequest,
    @Param('studentProfileId') studentProfileId: string,
  ) {
    const parent = this.requireParent(request);
    return this.family.getWorkDisplayEligibility(studentProfileId, {
      parentProfileId: parent.parentProfileId,
    });
  }

  private requireParent(request: AuthenticatedRequest): {
    userAccountId: string;
    parentProfileId: string;
    displayName: string;
  } {
    const actor = request.authorizationActor;
    if (!actor || actor.kind !== 'parent') {
      throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', '仅家长可访问');
    }
    return {
      userAccountId: actor.userAccountId,
      parentProfileId: actor.parentProfileId,
      displayName: '家长用户',
    };
  }
}
