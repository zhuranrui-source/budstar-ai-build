CREATE TYPE "UserAccountKind" AS ENUM ('PARENT', 'STUDENT', 'STAFF', 'PLATFORM_ADMIN');

ALTER TABLE "UserAccount"
ADD COLUMN "kind" "UserAccountKind",
ADD COLUMN "credentialHash" VARCHAR(255),
ADD COLUMN "secondFactorSubject" VARCHAR(255);

UPDATE "UserAccount"
SET "kind" = CASE
  WHEN "platformRole" IS NOT NULL THEN 'PLATFORM_ADMIN'::"UserAccountKind"
  WHEN EXISTS (
    SELECT 1 FROM "CampusMembership"
    WHERE "CampusMembership"."userAccountId" = "UserAccount"."id"
  ) THEN 'STAFF'::"UserAccountKind"
  WHEN EXISTS (
    SELECT 1 FROM "ParentProfile"
    WHERE "ParentProfile"."userAccountId" = "UserAccount"."id"
  ) THEN 'PARENT'::"UserAccountKind"
  ELSE 'STUDENT'::"UserAccountKind"
END;

ALTER TABLE "UserAccount" ALTER COLUMN "kind" SET NOT NULL;

CREATE TABLE "AuthenticationSession" (
  "id" UUID NOT NULL,
  "userAccountId" UUID NOT NULL,
  "refreshTokenHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "replacedById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthenticationSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditEvent" (
  "id" UUID NOT NULL,
  "actorAccountId" UUID,
  "action" VARCHAR(64) NOT NULL,
  "campusId" VARCHAR(64),
  "resourceType" VARCHAR(100),
  "resourceId" VARCHAR(100),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthenticationSession_refreshTokenHash_key"
ON "AuthenticationSession"("refreshTokenHash");
CREATE INDEX "AuthenticationSession_userAccountId_revokedAt_expiresAt_idx"
ON "AuthenticationSession"("userAccountId", "revokedAt", "expiresAt");
CREATE INDEX "AuditEvent_actorAccountId_occurredAt_idx"
ON "AuditEvent"("actorAccountId", "occurredAt");
CREATE INDEX "AuditEvent_campusId_action_occurredAt_idx"
ON "AuditEvent"("campusId", "action", "occurredAt");

ALTER TABLE "AuthenticationSession"
ADD CONSTRAINT "AuthenticationSession_userAccountId_fkey"
FOREIGN KEY ("userAccountId") REFERENCES "UserAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditEvent"
ADD CONSTRAINT "AuditEvent_actorAccountId_fkey"
FOREIGN KEY ("actorAccountId") REFERENCES "UserAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
