-- CreateEnum
CREATE TYPE "WorkSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_REVISION', 'RESUBMITTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "WorkSubmission" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "classId" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "mainLessonId" UUID NOT NULL,
    "assignmentTemplateId" UUID NOT NULL,
    "track" "MainLessonTrack" NOT NULL,
    "status" "WorkSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(200) NOT NULL,
    "contentJson" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSubmissionStatusHistory" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "workSubmissionId" UUID NOT NULL,
    "fromStatus" "WorkSubmissionStatus",
    "toStatus" "WorkSubmissionStatus" NOT NULL,
    "changedByAccountId" UUID,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" VARCHAR(500),
    CONSTRAINT "WorkSubmissionStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiConversation" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "classId" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "mainLessonId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "content" VARCHAR(800) NOT NULL,
    "refusedHomework" BOOLEAN NOT NULL DEFAULT false,
    "modelRoute" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkSubmission_classId_studentProfileId_mainLessonId_key" ON "WorkSubmission"("classId", "studentProfileId", "mainLessonId");

-- CreateIndex
CREATE INDEX "WorkSubmission_campusId_status_updatedAt_idx" ON "WorkSubmission"("campusId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkSubmission_studentProfileId_updatedAt_idx" ON "WorkSubmission"("studentProfileId", "updatedAt");

-- CreateIndex
CREATE INDEX "WorkSubmissionStatusHistory_workSubmissionId_changedAt_idx" ON "WorkSubmissionStatusHistory"("workSubmissionId", "changedAt");

-- CreateIndex
CREATE INDEX "WorkSubmissionStatusHistory_campusId_changedAt_idx" ON "WorkSubmissionStatusHistory"("campusId", "changedAt");

-- CreateIndex
CREATE INDEX "AiConversation_studentProfileId_mainLessonId_updatedAt_idx" ON "AiConversation"("studentProfileId", "mainLessonId", "updatedAt");

-- CreateIndex
CREATE INDEX "AiConversation_campusId_updatedAt_idx" ON "AiConversation"("campusId", "updatedAt");

-- CreateIndex
CREATE INDEX "AiMessage_conversationId_createdAt_idx" ON "AiMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkSubmission" ADD CONSTRAINT "WorkSubmission_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSubmission" ADD CONSTRAINT "WorkSubmission_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSubmission" ADD CONSTRAINT "WorkSubmission_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSubmission" ADD CONSTRAINT "WorkSubmission_mainLessonId_fkey" FOREIGN KEY ("mainLessonId") REFERENCES "MainLesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSubmission" ADD CONSTRAINT "WorkSubmission_assignmentTemplateId_fkey" FOREIGN KEY ("assignmentTemplateId") REFERENCES "LessonAssignmentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSubmissionStatusHistory" ADD CONSTRAINT "WorkSubmissionStatusHistory_workSubmissionId_fkey" FOREIGN KEY ("workSubmissionId") REFERENCES "WorkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_mainLessonId_fkey" FOREIGN KEY ("mainLessonId") REFERENCES "MainLesson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
