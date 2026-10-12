-- 学科内容库：小学/初中各学科 HTML 章节内容（平台级，不可变发布）
CREATE TYPE "SubjectCourseStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "SubjectCourse" (
    "id" UUID NOT NULL,
    "subject" VARCHAR(32) NOT NULL,
    "gradeBand" VARCHAR(16) NOT NULL,
    "gradeLevel" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "status" "SubjectCourseStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubjectCourse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubjectChapter" (
    "id" UUID NOT NULL,
    "subjectCourseId" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "aiGuidePrompt" VARCHAR(1000),

    CONSTRAINT "SubjectChapter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubjectCourse_subject_gradeBand_gradeLevel_status_idx" ON "SubjectCourse"("subject", "gradeBand", "gradeLevel", "status");
CREATE UNIQUE INDEX "SubjectChapter_subjectCourseId_sequence_key" ON "SubjectChapter"("subjectCourseId", "sequence");

ALTER TABLE "SubjectChapter" ADD CONSTRAINT "SubjectChapter_subjectCourseId_fkey" FOREIGN KEY ("subjectCourseId") REFERENCES "SubjectCourse"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
