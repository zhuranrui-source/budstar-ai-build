-- CreateEnum
CREATE TYPE "CoursePackageVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "MainLessonTrack" AS ENUM ('AIGC', 'VIBE_CODING');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- AlterTable
ALTER TABLE "AppointmentLead" ADD COLUMN "assigneeAccountId" UUID,
ADD COLUMN "note" VARCHAR(2000);

-- CreateTable
CREATE TABLE "CoursePackageVersion" (
    "id" UUID NOT NULL,
    "packageKey" VARCHAR(64) NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "status" "CoursePackageVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoursePackageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MainLesson" (
    "id" UUID NOT NULL,
    "coursePackageVersionId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "track" "MainLessonTrack" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "theme" VARCHAR(200) NOT NULL,
    "coreDeliverable" VARCHAR(500) NOT NULL,
    "learningGoals" VARCHAR(1000) NOT NULL,
    CONSTRAINT "MainLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineQASession" (
    "id" UUID NOT NULL,
    "coursePackageVersionId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "afterLessonSequence" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "topic" VARCHAR(500) NOT NULL,
    CONSTRAINT "OnlineQASession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonAssignmentTemplate" (
    "id" UUID NOT NULL,
    "mainLessonId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "requirements" VARCHAR(2000) NOT NULL,
    "submissionKinds" VARCHAR(200) NOT NULL,
    CONSTRAINT "LessonAssignmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rubric" (
    "id" UUID NOT NULL,
    "coursePackageVersionId" UUID NOT NULL,
    "mainLessonId" UUID,
    "name" VARCHAR(200) NOT NULL,
    "dimensionsJson" TEXT NOT NULL,
    CONSTRAINT "Rubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Class" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "coursePackageVersionId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "classCode" VARCHAR(16) NOT NULL,
    "status" "ClassStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassStudent" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "classId" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClassStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnrollmentRecord" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "appointmentLeadId" UUID NOT NULL,
    "classId" UUID,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" VARCHAR(500),
    "createdByAccountId" UUID,
    CONSTRAINT "EnrollmentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoursePackageVersion_packageKey_version_key" ON "CoursePackageVersion"("packageKey", "version");
CREATE INDEX "CoursePackageVersion_packageKey_status_idx" ON "CoursePackageVersion"("packageKey", "status");
CREATE UNIQUE INDEX "MainLesson_coursePackageVersionId_sequence_key" ON "MainLesson"("coursePackageVersionId", "sequence");
CREATE INDEX "MainLesson_coursePackageVersionId_track_idx" ON "MainLesson"("coursePackageVersionId", "track");
CREATE UNIQUE INDEX "OnlineQASession_coursePackageVersionId_sequence_key" ON "OnlineQASession"("coursePackageVersionId", "sequence");
CREATE UNIQUE INDEX "LessonAssignmentTemplate_mainLessonId_key" ON "LessonAssignmentTemplate"("mainLessonId");
CREATE INDEX "Rubric_coursePackageVersionId_idx" ON "Rubric"("coursePackageVersionId");
CREATE UNIQUE INDEX "Class_classCode_key" ON "Class"("classCode");
CREATE INDEX "Class_campusId_status_idx" ON "Class"("campusId", "status");
CREATE INDEX "Class_coursePackageVersionId_idx" ON "Class"("coursePackageVersionId");
CREATE UNIQUE INDEX "ClassStudent_classId_studentProfileId_key" ON "ClassStudent"("classId", "studentProfileId");
CREATE INDEX "ClassStudent_campusId_classId_idx" ON "ClassStudent"("campusId", "classId");
CREATE UNIQUE INDEX "EnrollmentRecord_appointmentLeadId_key" ON "EnrollmentRecord"("appointmentLeadId");
CREATE INDEX "EnrollmentRecord_campusId_enrolledAt_idx" ON "EnrollmentRecord"("campusId", "enrolledAt");
CREATE INDEX "AppointmentLead_campusId_assigneeAccountId_idx" ON "AppointmentLead"("campusId", "assigneeAccountId");

-- AddForeignKey
ALTER TABLE "AppointmentLead" ADD CONSTRAINT "AppointmentLead_assigneeAccountId_fkey" FOREIGN KEY ("assigneeAccountId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MainLesson" ADD CONSTRAINT "MainLesson_coursePackageVersionId_fkey" FOREIGN KEY ("coursePackageVersionId") REFERENCES "CoursePackageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineQASession" ADD CONSTRAINT "OnlineQASession_coursePackageVersionId_fkey" FOREIGN KEY ("coursePackageVersionId") REFERENCES "CoursePackageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LessonAssignmentTemplate" ADD CONSTRAINT "LessonAssignmentTemplate_mainLessonId_fkey" FOREIGN KEY ("mainLessonId") REFERENCES "MainLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rubric" ADD CONSTRAINT "Rubric_coursePackageVersionId_fkey" FOREIGN KEY ("coursePackageVersionId") REFERENCES "CoursePackageVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rubric" ADD CONSTRAINT "Rubric_mainLessonId_fkey" FOREIGN KEY ("mainLessonId") REFERENCES "MainLesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Class" ADD CONSTRAINT "Class_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Class" ADD CONSTRAINT "Class_coursePackageVersionId_fkey" FOREIGN KEY ("coursePackageVersionId") REFERENCES "CoursePackageVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassStudent" ADD CONSTRAINT "ClassStudent_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassStudent" ADD CONSTRAINT "ClassStudent_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassStudent" ADD CONSTRAINT "ClassStudent_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentRecord" ADD CONSTRAINT "EnrollmentRecord_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentRecord" ADD CONSTRAINT "EnrollmentRecord_appointmentLeadId_fkey" FOREIGN KEY ("appointmentLeadId") REFERENCES "AppointmentLead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnrollmentRecord" ADD CONSTRAINT "EnrollmentRecord_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EnrollmentRecord" ADD CONSTRAINT "EnrollmentRecord_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
