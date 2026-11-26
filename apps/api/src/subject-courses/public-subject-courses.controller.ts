import { Controller, Get, Param, Query } from '@nestjs/common';
import type { SubjectCourseDetail } from '@budstar/contracts';
import { Public } from '../authorization/authorization.decorators';
import { SubjectCoursesService } from './subject-courses.service';

/**
 * 小程序未登录浏览：只读已发布的学科实验室课程。
 * 课程内容不含个人数据；教师备课参考（aiContext / aiGuidePrompt）不对外返回。
 */
@Public()
@Controller('public/subject-courses')
export class PublicSubjectCoursesController {
  constructor(private readonly subjectCourses: SubjectCoursesService) {}

  @Get()
  list(
    @Query('subject') subject?: string,
    @Query('gradeBand') gradeBand?: string,
  ) {
    return this.subjectCourses.listPublished({ subject, gradeBand });
  }

  @Get(':id')
  async get(@Param('id') id: string): Promise<SubjectCourseDetail> {
    const course = await this.subjectCourses.getPublished(id);
    return {
      ...course,
      chapters: course.chapters.map((chapter) => ({
        ...chapter,
        aiGuidePrompt: null,
        aiContext: null,
      })),
    };
  }
}
