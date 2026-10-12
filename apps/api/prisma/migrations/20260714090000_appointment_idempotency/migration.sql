ALTER TABLE "AppointmentLead"
ADD COLUMN "idempotencyKey" VARCHAR(128),
ADD COLUMN "inputFingerprint" CHAR(64);

UPDATE "AppointmentLead"
SET
  "idempotencyKey" = 'legacy-' || "id"::text,
  "inputFingerprint" =
    md5("campusId" || ':' || "phone" || ':' || "interestedCourse" || ':' || "createdAt"::text)
    || md5('legacy:' || "id"::text);

ALTER TABLE "AppointmentLead"
ALTER COLUMN "idempotencyKey" SET NOT NULL,
ALTER COLUMN "inputFingerprint" SET NOT NULL;

CREATE UNIQUE INDEX "AppointmentLead_idempotencyKey_key"
ON "AppointmentLead"("idempotencyKey");

CREATE INDEX "AppointmentLead_inputFingerprint_createdAt_idx"
ON "AppointmentLead"("inputFingerprint", "createdAt");
