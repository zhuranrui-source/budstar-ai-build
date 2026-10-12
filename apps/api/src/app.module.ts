import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppointmentLeadsModule } from './appointment-leads/appointment-leads.module';
import { AuthenticationModule } from './auth/authentication.module';
import { AuthorizationModule } from './authorization/authorization.module';
import { AiTeacherModule } from './ai-teacher/ai-teacher.module';
import { CampusesModule } from './campuses/campuses.module';
import { ClassesModule } from './classes/classes.module';
import { CoursePackagesModule } from './course-packages/course-packages.module';
import { CrmModule } from './crm/crm.module';
import { FamilyModule } from './family/family.module';
import { FeedbackModule } from './feedback/feedback.module';
import { CommunityModule } from './community/community.module';
import { PlatformModule } from './platform/platform.module';
import { ObjectStorageModule } from './object-storage/object-storage.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { SubjectCoursesModule } from './subject-courses/subject-courses.module';

@Module({
  imports: [
    CampusesModule,
    AppointmentLeadsModule,
    AuthenticationModule,
    AuthorizationModule,
    CoursePackagesModule,
    ClassesModule,
    CrmModule,
    FamilyModule,
    FeedbackModule,
    CommunityModule,
    PlatformModule,
    ObjectStorageModule,
    SubmissionsModule,
    SubjectCoursesModule,
    AiTeacherModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
