import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import {
  createSubjectCourseSchema,
  subjectChapterDraftSchema,
} from '@budstar/contracts';
import {
  AuditBusinessWrite,
  RequirePlatformCapability,
} from '../authorization/authorization.decorators';
import { ApiException } from '../http/api-error';
import { SubjectCoursesService } from './subject-courses.service';

@Controller('platform/subject-courses')
@RequirePlatformCapability('PLATFORM_COURSE_VERSION_GOVERN')
export class PlatformSubjectCoursesController {
  constructor(private readonly subjectCourses: SubjectCoursesService) {}

  @Get()
  list() {
    return this.subjectCourses.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.subjectCourses.get(id);
  }

  @Post()
  @AuditBusinessWrite('subject-course')
  create(@Body() body: unknown) {
    const parsed = createSubjectCourseSchema.safeParse(body);
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
    return this.subjectCourses.createDraft(parsed.data);
  }

  @Put(':id/chapters')
  @AuditBusinessWrite('subject-course')
  replaceChapters(@Param('id') id: string, @Body() body: unknown) {
    const parsed = subjectChapterDraftSchema.array().safeParse(body);
    if (!parsed.success) {
      throw new ApiException(
        HttpStatus.BAD_REQUEST,
        'VALIDATION_ERROR',
        '请求参数不合法',
      );
    }
    return this.subjectCourses.replaceChapters(id, parsed.data);
  }

  @Post(':id/publish')
  @AuditBusinessWrite('subject-course')
  publish(@Param('id') id: string) {
    return this.subjectCourses.publish(id);
  }
}
