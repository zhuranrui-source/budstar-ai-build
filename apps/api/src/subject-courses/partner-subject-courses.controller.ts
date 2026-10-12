import { Controller, Get, HttpStatus, Param, Query, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import { ApiException } from '../http/api-error';
import { SubjectCoursesService } from './subject-courses.service';

/**
 * 合作方/家庭只读的学科内容目录（ADR-0009）：
 * 仅已发布内容；合作方门户与家庭视图共用此读取面。
 */
@Controller('partner/content/subject-courses')
export class PartnerSubjectCoursesController {
  constructor(private readonly subjectCourses: SubjectCoursesService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query('subject') subject?: string,
    @Query('gradeBand') gradeBand?: string,
    @Query('gradeLevel') gradeLevel?: string,
  ) {
    this.assertPartner(request);
    return this.subjectCourses.listPublished({
      subject,
      gradeBand,
      gradeLevel: gradeLevel ? Number(gradeLevel) : undefined,
    });
  }

  @Get(':id')
  get(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    this.assertPartner(request);
    return this.subjectCourses.getPublished(id);
  }

  private assertPartner(request: AuthenticatedRequest): void {
    if (request.authorizationActor?.kind !== 'partner') {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN',
        '仅合作方身份可访问内容门户',
      );
    }
  }
}
