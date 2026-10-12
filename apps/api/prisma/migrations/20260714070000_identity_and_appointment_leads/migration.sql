CREATE TYPE "UserAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');
CREATE TYPE "PlatformRole" AS ENUM ('PLATFORM_ADMIN');
CREATE TYPE "StaffRoleKind" AS ENUM ('TEACHER', 'ACADEMIC_SERVICE', 'CAMPUS_ADMIN');
CREATE TYPE "GuardianBindingStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');
CREATE TYPE "GuardianConsentType" AS ENUM ('MINOR_DATA_PROCESSING', 'WORK_DISPLAY', 'ACTIVITY_PARTICIPATION');
CREATE TYPE "AppointmentLeadStatus" AS ENUM ('PENDING_CONTACT', 'CONTACTED', 'APPOINTMENT_SCHEDULED', 'VISITED', 'ENROLLED', 'CLOSED');

CREATE TABLE "Campus" (
    "id" VARCHAR(64) NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserAccount" (
    "id" UUID NOT NULL,
    "status" "UserAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "loginIdentifier" VARCHAR(255) NOT NULL,
    "platformRole" "PlatformRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ParentProfile" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "userAccountId" UUID,
    "displayName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ParentProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StudentProfile" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "userAccountId" UUID,
    "displayName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuardianBinding" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "parentProfileId" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "status" "GuardianBindingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuardianBinding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuardianConsent" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "parentProfileId" UUID NOT NULL,
    "studentProfileId" UUID NOT NULL,
    "type" "GuardianConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "GuardianConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CampusMembership" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "userAccountId" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampusMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffRole" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "campusMembershipId" UUID NOT NULL,
    "role" "StaffRoleKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffRole_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppointmentLead" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "parentName" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "childAgeOrGrade" VARCHAR(30) NOT NULL,
    "interestedCourse" VARCHAR(100) NOT NULL,
    "preferredContactTime" VARCHAR(100) NOT NULL,
    "status" "AppointmentLeadStatus" NOT NULL DEFAULT 'PENDING_CONTACT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppointmentLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppointmentLeadStatusHistory" (
    "id" UUID NOT NULL,
    "campusId" VARCHAR(64) NOT NULL,
    "appointmentLeadId" UUID NOT NULL,
    "fromStatus" "AppointmentLeadStatus",
    "toStatus" "AppointmentLeadStatus" NOT NULL,
    "changedByAccountId" UUID,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" VARCHAR(500),
    CONSTRAINT "AppointmentLeadStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Campus_code_key" ON "Campus"("code");
CREATE UNIQUE INDEX "UserAccount_loginIdentifier_key" ON "UserAccount"("loginIdentifier");
CREATE INDEX "ParentProfile_campusId_idx" ON "ParentProfile"("campusId");
CREATE INDEX "ParentProfile_userAccountId_idx" ON "ParentProfile"("userAccountId");
CREATE INDEX "StudentProfile_campusId_idx" ON "StudentProfile"("campusId");
CREATE INDEX "StudentProfile_userAccountId_idx" ON "StudentProfile"("userAccountId");
CREATE INDEX "GuardianBinding_campusId_status_idx" ON "GuardianBinding"("campusId", "status");
CREATE UNIQUE INDEX "GuardianBinding_campusId_parentProfileId_studentProfileId_key" ON "GuardianBinding"("campusId", "parentProfileId", "studentProfileId");
CREATE INDEX "GuardianConsent_campusId_studentProfileId_type_idx" ON "GuardianConsent"("campusId", "studentProfileId", "type");
CREATE INDEX "CampusMembership_campusId_active_idx" ON "CampusMembership"("campusId", "active");
CREATE UNIQUE INDEX "CampusMembership_campusId_userAccountId_key" ON "CampusMembership"("campusId", "userAccountId");
CREATE INDEX "StaffRole_campusId_role_idx" ON "StaffRole"("campusId", "role");
CREATE UNIQUE INDEX "StaffRole_campusMembershipId_role_key" ON "StaffRole"("campusMembershipId", "role");
CREATE INDEX "AppointmentLead_campusId_status_createdAt_idx" ON "AppointmentLead"("campusId", "status", "createdAt");
CREATE INDEX "AppointmentLeadStatusHistory_campusId_appointmentLeadId_cha_idx" ON "AppointmentLeadStatusHistory"("campusId", "appointmentLeadId", "changedAt");

ALTER TABLE "ParentProfile" ADD CONSTRAINT "ParentProfile_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParentProfile" ADD CONSTRAINT "ParentProfile_userAccountId_fkey" FOREIGN KEY ("userAccountId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userAccountId_fkey" FOREIGN KEY ("userAccountId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GuardianBinding" ADD CONSTRAINT "GuardianBinding_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuardianBinding" ADD CONSTRAINT "GuardianBinding_parentProfileId_fkey" FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuardianBinding" ADD CONSTRAINT "GuardianBinding_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuardianConsent" ADD CONSTRAINT "GuardianConsent_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuardianConsent" ADD CONSTRAINT "GuardianConsent_parentProfileId_fkey" FOREIGN KEY ("parentProfileId") REFERENCES "ParentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuardianConsent" ADD CONSTRAINT "GuardianConsent_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampusMembership" ADD CONSTRAINT "CampusMembership_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CampusMembership" ADD CONSTRAINT "CampusMembership_userAccountId_fkey" FOREIGN KEY ("userAccountId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffRole" ADD CONSTRAINT "StaffRole_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffRole" ADD CONSTRAINT "StaffRole_campusMembershipId_fkey" FOREIGN KEY ("campusMembershipId") REFERENCES "CampusMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentLead" ADD CONSTRAINT "AppointmentLead_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppointmentLeadStatusHistory" ADD CONSTRAINT "AppointmentLeadStatusHistory_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppointmentLeadStatusHistory" ADD CONSTRAINT "AppointmentLeadStatusHistory_appointmentLeadId_fkey" FOREIGN KEY ("appointmentLeadId") REFERENCES "AppointmentLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentLeadStatusHistory" ADD CONSTRAINT "AppointmentLeadStatusHistory_changedByAccountId_fkey" FOREIGN KEY ("changedByAccountId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
