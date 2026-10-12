import { Controller, Get, HttpStatus, Param, Req } from '@nestjs/common';
import type { AuthenticatedRequest } from '../authorization/authenticated-request';
import { ApiException } from '../http/api-error';
import { CoursePackagesService } from './course-packages.service';

/**
 * ADR-0009：合作方内容门户——仅已发布课程包与活动内容，
 * 不含学生数据、预约线索和校区运营数据。
 */
@Controller('partner/content')
export class PartnerContentController {
  constructor(private readonly coursePackages: CoursePackagesService) {}

  @Get('courses')
  listCourses(@Req() request: AuthenticatedRequest) {
    this.assertPartner(request);
    return this.coursePackages.listPublished();
  }

  @Get('courses/:id')
  getCourse(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    this.assertPartner(request);
    return this.coursePackages.getPublished(id);
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
