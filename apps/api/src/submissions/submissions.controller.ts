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
  joinClassByCodeSchema,
  listWorkSubmissionsQuerySchema,
  saveWorkSubmissionDraftSchema,
  transitionWorkSubmissionSchema,
} from '@budstar/contracts';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import {
  AuditBusinessWrite,
  RequireCampusCapability,
} from '../authorization/authorization.decorators';
import { ApiException } from '../http/api-error';
import { SubmissionsService } from './submissions.service';

@Controller('student')
export class StudentLearningController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Post('classes/join')
  @AuditBusinessWrite('class-membership')
  join(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const student = this.requireStudent(request);
    const parsed = joinClassByCodeSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.submissions.joinClass(student.studentProfileId, parsed.data);
  }

  @Get('classes')
  listClasses(@Req() request: AuthenticatedRequest) {
    const student = this.requireStudent(request);
    return this.submissions.listMemberships(student.studentProfileId);
  }

  @Get('classes/:classId/lessons')
  curriculum(
    @Req() request: AuthenticatedRequest,
    @Param('classId') classId: string,
  ) {
    const student = this.requireStudent(request);
    return this.submissions.getCurriculum(student.studentProfileId, classId);
  }

  @Put('submissions/draft')
  @AuditBusinessWrite('work-submission')
  saveDraft(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const student = this.requireStudent(request);
    const parsed = saveWorkSubmissionDraftSchema.safeParse(body);
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
    return this.submissions.saveDraft(student.studentProfileId, parsed.data);
  }

  @Post('submissions/:id/transitions')
  @AuditBusinessWrite('work-submission')
  transition(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const student = this.requireStudent(request);
    const parsed = transitionWorkSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.submissions.transitionOwn(
      student.studentProfileId,
      id,
      parsed.data,
      student.userAccountId,
    );
  }

  private requireStudent(request: AuthenticatedRequest): {
    userAccountId: string;
    studentProfileId: string;
  } {
    const actor = request.authorizationActor;
    if (!actor || actor.kind !== 'student') {
      throw new ApiException(HttpStatus.FORBIDDEN, 'FORBIDDEN', '仅学生可访问');
    }
    return {
      userAccountId: actor.userAccountId,
      studentProfileId: actor.studentProfileId,
    };
  }
}

@Controller('admin/submissions')
@RequireCampusCapability('SUBMISSION_REVIEW')
export class AdminSubmissionsController {
  constructor(private readonly submissions: SubmissionsService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('classId') classId?: string,
  ) {
    const parsed = listWorkSubmissionsQuerySchema.safeParse({
      ...(status ? { status } : {}),
      ...(classId ? { classId } : {}),
    });
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.submissions.listCampusQueue(request.campusId!, parsed.data);
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.submissions.getCampusSubmission(request.campusId!, id);
  }

  @Post(':id/transitions')
  @AuditBusinessWrite('work-submission')
  transition(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = transitionWorkSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.submissions.transitionCampus(
      request.campusId!,
      id,
      parsed.data,
      request.authorizationActor!.userAccountId,
    );
  }
}
