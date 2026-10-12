-- CreateEnum
CREATE TYPE "AiFeedbackDraftStatus" AS ENUM ('NOT_GENERATED', 'GENERATING', 'GENERATED', 'FAILED', 'ADOPTED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "FormalFeedbackStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "FiveDimEvaluationStatus" AS ENUM ('PENDING_GENERATION', 'GENERATED', 'PENDING_REVIEW', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "GrowthReportStatus" AS ENUM ('NOT_READY', 'DRAFT_GENERATING', 'PENDING_REVIEW', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "CommunityVisibilityScope" AS ENUM ('FAMILY', 'CLASS', 'CAMPUS');

-- CreateEnum
CREATE TYPE "CommunityRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "CommunityContentStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'HIDDEN');

-- CreateTable
CREATE TABLE "AiFeedbackDraft" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "workSubmissionId" UUID NOT NULL,
    "status" "AiFeedbackDraftStatus" NOT NULL DEFAULT 'NOT_GENERATED',
    "content" TEXT NOT NULL,
    "modelRoute" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiFeedbackDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormalFeedback" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "workSubmissionId" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "classId" UUID NOT NULL,
    "mainLessonId" UUID NOT NULL,
    "lessonSequence" INTEGER NOT NULL,
    "lessonTitle" VARCHAR(200) NOT NULL,
    "status" "FormalFeedbackStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "body" TEXT NOT NULL,
    "highlightsJson" TEXT NOT NULL,
    "nextStepsJson" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "publishedByAccountId" UUID,
    "sourceAiDraftId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormalFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiveDimEvaluation" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "workSubmissionId" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "status" "FiveDimEvaluationStatus" NOT NULL DEFAULT 'PENDING_GENERATION',
    "scoresJson" TEXT NOT NULL,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedByAccountId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiveDimEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthReport" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "classId" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "milestone" INTEGER NOT NULL,
    "status" "GrowthReportStatus" NOT NULL DEFAULT 'NOT_READY',
    "summary" TEXT NOT NULL,
    "teacherObservation" TEXT,
    "scoresJson" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "publishedByAccountId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "classId" UUID,
    "studentProfileId" UUID NOT NULL,
    "authorAccountId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "visibilityScope" "CommunityVisibilityScope" NOT NULL,
    "riskLevel" "CommunityRiskLevel" NOT NULL DEFAULT 'LOW',
    "status" "CommunityContentStatus" NOT NULL DEFAULT 'DRAFT',
    "workSubmissionId" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAccountId" UUID,
    "reviewNote" VARCHAR(500),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiFeedbackDraft_campusId_workSubmissionId_updatedAt_idx" ON "AiFeedbackDraft"("campusId", "workSubmissionId", "updatedAt");

-- CreateIndex
CREATE INDEX "AiFeedbackDraft_workSubmissionId_status_idx" ON "AiFeedbackDraft"("workSubmissionId", "status");

-- CreateIndex
CREATE INDEX "FormalFeedback_campusId_status_updatedAt_idx" ON "FormalFeedback"("campusId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "FormalFeedback_studentProfileId_status_publishedAt_idx" ON "FormalFeedback"("studentProfileId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "FormalFeedback_workSubmissionId_version_idx" ON "FormalFeedback"("workSubmissionId", "version");

-- CreateIndex
CREATE INDEX "FiveDimEvaluation_campusId_status_updatedAt_idx" ON "FiveDimEvaluation"("campusId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "FiveDimEvaluation_studentProfileId_status_idx" ON "FiveDimEvaluation"("studentProfileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FiveDimEvaluation_workSubmissionId_key" ON "FiveDimEvaluation"("workSubmissionId");

-- CreateIndex
CREATE INDEX "GrowthReport_campusId_status_updatedAt_idx" ON "GrowthReport"("campusId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "GrowthReport_studentProfileId_status_publishedAt_idx" ON "GrowthReport"("studentProfileId", "status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthReport_classId_studentProfileId_milestone_key" ON "GrowthReport"("classId", "studentProfileId", "milestone");

-- CreateIndex
CREATE INDEX "CommunityPost_campusId_status_visibilityScope_idx" ON "CommunityPost"("campusId", "status", "visibilityScope");

-- CreateIndex
CREATE INDEX "CommunityPost_studentProfileId_status_idx" ON "CommunityPost"("studentProfileId", "status");

-- CreateIndex
CREATE INDEX "CommunityPost_classId_status_idx" ON "CommunityPost"("classId", "status");

-- AddForeignKey
ALTER TABLE "AiFeedbackDraft" ADD CONSTRAINT "AiFeedbackDraft_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiFeedbackDraft" ADD CONSTRAINT "AiFeedbackDraft_workSubmissionId_fkey" FOREIGN KEY ("workSubmissionId") REFERENCES "WorkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormalFeedback" ADD CONSTRAINT "FormalFeedback_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormalFeedback" ADD CONSTRAINT "FormalFeedback_workSubmissionId_fkey" FOREIGN KEY ("workSubmissionId") REFERENCES "WorkSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormalFeedback" ADD CONSTRAINT "FormalFeedback_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormalFeedback" ADD CONSTRAINT "FormalFeedback_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormalFeedback" ADD CONSTRAINT "FormalFeedback_sourceAiDraftId_fkey" FOREIGN KEY ("sourceAiDraftId") REFERENCES "AiFeedbackDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiveDimEvaluation" ADD CONSTRAINT "FiveDimEvaluation_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiveDimEvaluation" ADD CONSTRAINT "FiveDimEvaluation_workSubmissionId_fkey" FOREIGN KEY ("workSubmissionId") REFERENCES "WorkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiveDimEvaluation" ADD CONSTRAINT "FiveDimEvaluation_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthReport" ADD CONSTRAINT "GrowthReport_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthReport" ADD CONSTRAINT "GrowthReport_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthReport" ADD CONSTRAINT "GrowthReport_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPost" ADD CONSTRAINT "CommunityPost_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
