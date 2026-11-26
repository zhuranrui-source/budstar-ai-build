import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AiTeacherModule } from '../ai-teacher/ai-teacher.module';
import { PrismaService } from '../database/prisma.service';
import { PrismaSubjectCourseStore } from './prisma-subject-courses.store';
import { PartnerSubjectCoursesController } from './partner-subject-courses.controller';
import { FamilySubjectCoursesController } from './family-subject-courses.controller';
import { PlatformSubjectCoursesController } from './platform-subject-courses.controller';
import { SubjectCourseStaticController } from './subject-course-static.controller';
import { PublicSubjectCoursesController } from './public-subject-courses.controller';
import {
  InMemorySubjectCourseStore,
  SubjectCoursesService,
  type SubjectCourseStore,
} from './subject-courses.service';

export const SUBJECT_COURSE_STORE = Symbol('SUBJECT_COURSE_STORE');

@Module({
  imports: [DatabaseModule, AiTeacherModule],
  controllers: [
    PlatformSubjectCoursesController,
    PartnerSubjectCoursesController,
    FamilySubjectCoursesController,
    SubjectCourseStaticController,
    PublicSubjectCoursesController,
  ],
  providers: [
    {
      provide: SUBJECT_COURSE_STORE,
      useFactory: (prisma: PrismaService): SubjectCourseStore => {
        if (process.env.SUBJECT_COURSE_STORE === 'memory') {
          return new InMemorySubjectCourseStore();
        }
        if (!process.env.DATABASE_URL) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'DATABASE_URL is required for subject course persistence in production',
            );
          }
          return new InMemorySubjectCourseStore();
        }
        return new PrismaSubjectCourseStore(prisma);
      },
      inject: [PrismaService],
    },
    {
      provide: SubjectCoursesService,
      useFactory: (store: SubjectCourseStore) =>
        new SubjectCoursesService(store),
      inject: [SUBJECT_COURSE_STORE],
    },
  ],
  exports: [SubjectCoursesService, SUBJECT_COURSE_STORE],
})
export class SubjectCoursesModule {}
