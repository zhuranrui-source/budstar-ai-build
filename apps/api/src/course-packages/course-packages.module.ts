import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AdminCoursePackagesController } from './admin-course-packages.controller';
import { CoursePackagesController } from './course-packages.controller';
import { PartnerContentController } from './partner-content.controller';
import {
  CoursePackagesService,
  InMemoryCoursePackageStore,
  type CoursePackageStore,
} from './course-packages.service';
import { PrismaCoursePackageStore } from './prisma-course-package.store';
import { PrismaService } from '../database/prisma.service';

export const COURSE_PACKAGE_STORE = Symbol('COURSE_PACKAGE_STORE');

@Module({
  imports: [DatabaseModule],
  controllers: [
    CoursePackagesController,
    AdminCoursePackagesController,
    PartnerContentController,
  ],
  providers: [
    {
      provide: COURSE_PACKAGE_STORE,
      useFactory: (prisma: PrismaService): CoursePackageStore => {
        if (process.env.COURSE_PACKAGE_STORE === 'memory') {
          return new InMemoryCoursePackageStore();
        }
        if (!process.env.DATABASE_URL) {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'DATABASE_URL is required for course package persistence in production',
            );
          }
          return new InMemoryCoursePackageStore();
        }
        return new PrismaCoursePackageStore(prisma);
      },
      inject: [PrismaService],
    },
    {
      provide: CoursePackagesService,
      useFactory: (store: CoursePackageStore) =>
        new CoursePackagesService(store),
      inject: [COURSE_PACKAGE_STORE],
    },
  ],
  exports: [CoursePackagesService, COURSE_PACKAGE_STORE],
})
export class CoursePackagesModule {}
