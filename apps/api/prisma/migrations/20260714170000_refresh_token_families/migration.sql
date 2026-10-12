ALTER TABLE "AuthenticationSession"
ADD COLUMN "sessionId" UUID,
ADD COLUMN "familyId" UUID;

UPDATE "AuthenticationSession"
SET "sessionId" = "id", "familyId" = "id";

ALTER TABLE "AuthenticationSession"
ALTER COLUMN "sessionId" SET NOT NULL,
ALTER COLUMN "familyId" SET NOT NULL;

CREATE INDEX "AuthenticationSession_sessionId_revokedAt_expiresAt_idx"
ON "AuthenticationSession"("sessionId", "revokedAt", "expiresAt");

CREATE INDEX "AuthenticationSession_familyId_revokedAt_idx"
ON "AuthenticationSession"("familyId", "revokedAt");
