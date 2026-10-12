import { Controller, Get } from '@nestjs/common';
import { RequireCampusCapability } from '../authorization/authorization.decorators';
import { CoursePackagesService } from '../course-packages/course-packages.service';

@Controller('admin/course-packages')
@RequireCampusCapability('CLASS_MANAGE')
export class AdminCoursePackagesController {
  constructor(private readonly coursePackages: CoursePackagesService) {}

  @Get('published')
  async listPublished() {
    const versions = await this.coursePackages.list();
    return versions.filter((version) => version.status === 'PUBLISHED');
  }
}
