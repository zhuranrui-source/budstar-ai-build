-- AlterTable
ALTER TABLE "ParentProfile" ADD COLUMN "selectedStudentProfileId" UUID;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN "familyViewCodeHash" CHAR(64);
ALTER TABLE "StudentProfile" ADD COLUMN "familyViewCodeUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "GuardianConsent" ADD COLUMN "policyVersion" VARCHAR(32) NOT NULL DEFAULT '2026-07-01';

-- CreateIndex
CREATE INDEX "StudentProfile_familyViewCodeHash_idx" ON "StudentProfile"("familyViewCodeHash");

-- CreateIndex
CREATE INDEX "GuardianConsent_studentProfileId_type_policyVersion_idx" ON "GuardianConsent"("studentProfileId", "type", "policyVersion");
