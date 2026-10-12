import { Body, Controller, Get, HttpStatus, Param, Post } from '@nestjs/common';
import {
  createCoursePackageVersionSchema,
  reviseCoursePackageVersionSchema,
} from '@budstar/contracts';
import {
  AuditBusinessWrite,
  RequirePlatformCapability,
} from '../authorization/authorization.decorators';
import { ApiException } from '../http/api-error';
import { CoursePackagesService } from './course-packages.service';

@Controller('platform/course-packages')
@RequirePlatformCapability('PLATFORM_COURSE_VERSION_GOVERN')
export class CoursePackagesController {
  constructor(private readonly coursePackages: CoursePackagesService) {}

  @Get()
  list() {
    return this.coursePackages.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.coursePackages.get(id);
  }

  @Post()
  @AuditBusinessWrite('course-package-version')
  create(@Body() body: unknown) {
    const parsed = createCoursePackageVersionSchema.safeParse(body);
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
    return this.coursePackages.createDraft(parsed.data);
  }

  @Post(':id/publish')
  @AuditBusinessWrite('course-package-version')
  publish(@Param('id') id: string) {
    return this.coursePackages.publish(id);
  }

  @Post(':id/revise')
  @AuditBusinessWrite('course-package-version')
  revise(@Param('id') id: string, @Body() body: unknown) {
    const parsed = reviseCoursePackageVersionSchema.safeParse(body);
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
    return this.coursePackages.revise(id, parsed.data);
  }
}
