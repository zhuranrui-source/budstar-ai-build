import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  generateAiFeedbackDraftSchema,
  generateFiveDimEvaluationSchema,
  generateGrowthReportSchema,
  publishFormalFeedbackSchema,
  publishGrowthReportSchema,
  reviewFiveDimEvaluationSchema,
  saveFormalFeedbackDraftSchema,
} from '@budstar/contracts';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import {
  AuditBusinessWrite,
  RequireCampusCapability,
} from '../authorization/authorization.decorators';
import { ApiException } from '../http/api-error';
import { FeedbackService } from './feedback.service';

@Controller('admin/feedback')
@RequireCampusCapability('FEEDBACK_PUBLISH')
export class AdminFeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post('drafts/generate')
  @AuditBusinessWrite('ai-feedback-draft')
  generateDraft(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const parsed = generateAiFeedbackDraftSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.feedback.generateAiDraft(
      request.campusId!,
      parsed.data.workSubmissionId,
    );
  }

  @Get('submissions/:workSubmissionId/drafts')
  listDrafts(
    @Req() request: AuthenticatedRequest,
    @Param('workSubmissionId') workSubmissionId: string,
  ) {
    return this.feedback.listDrafts(request.campusId!, workSubmissionId);
  }

  @Put('formal')
  @AuditBusinessWrite('formal-feedback')
  saveFormal(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const parsed = saveFormalFeedbackDraftSchema.safeParse(body);
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
    return this.feedback.saveFormalDraft(
      request.campusId!,
      request.authorizationActor!.userAccountId,
      parsed.data,
    );
  }

  @Post('formal/:id/publish')
  @AuditBusinessWrite('formal-feedback')
  publishFormal(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = publishFormalFeedbackSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.feedback.publishFormal(
      request.campusId!,
      id,
      request.authorizationActor!.userAccountId,
      parsed.data,
    );
  }

  @Get('formal/:id/lesson-report')
  lessonReport(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.feedback.getLessonReportCopy(request.campusId!, id);
  }

  @Post('five-dim/generate')
  @AuditBusinessWrite('five-dim-evaluation')
  generateFiveDim(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const parsed = generateFiveDimEvaluationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.feedback.generateFiveDim(
      request.campusId!,
      parsed.data.workSubmissionId,
    );
  }

  @Post('five-dim/:id/review')
  @AuditBusinessWrite('five-dim-evaluation')
  reviewFiveDim(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = reviewFiveDimEvaluationSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.feedback.reviewFiveDim(
      request.campusId!,
      id,
      request.authorizationActor!.userAccountId,
      parsed.data,
    );
  }
}

@Controller('admin/growth')
@RequireCampusCapability('REPORT_PUBLISH')
export class AdminGrowthController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post('reports/generate')
  @AuditBusinessWrite('growth-report')
  generateReport(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const parsed = generateGrowthReportSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.feedback.generateGrowthReport(request.campusId!, parsed.data);
  }

  @Post('reports/:id/publish')
  @AuditBusinessWrite('growth-report')
  publishReport(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = publishGrowthReportSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.feedback.publishGrowthReport(
      request.campusId!,
      id,
      request.authorizationActor!.userAccountId,
      parsed.data,
    );
  }
}

@Controller('student/growth')
export class StudentGrowthController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  get(@Req() request: AuthenticatedRequest) {
    const actor = request.authorizationActor;
    if (!actor || actor.kind !== 'student') {
      throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', '仅学生可访问');
    }
    return this.feedback.getStudentGrowthView(actor.studentProfileId);
  }
}

@Controller('family/growth')
export class FamilyGrowthController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get(':studentProfileId')
  get(
    @Req() request: AuthenticatedRequest,
    @Param('studentProfileId') studentProfileId: string,
  ) {
    const actor = request.authorizationActor;
    if (!actor || actor.kind !== 'parent') {
      throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', '仅家长可访问');
    }
    if (!actor.activeStudentBindings.includes(studentProfileId)) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        '无权查看该学生成长内容',
      );
    }
    return this.feedback.getParentGrowthView(studentProfileId);
  }
}
