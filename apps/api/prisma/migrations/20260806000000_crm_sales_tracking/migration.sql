-- ISSUE-09 CRM 销售追踪核心：来源渠道 + 下一步跟进时间（activity-based selling）
ALTER TABLE "AppointmentLead" ADD COLUMN "source" VARCHAR(32);
ALTER TABLE "AppointmentLead" ADD COLUMN "nextContactAt" TIMESTAMP(3);
CREATE INDEX "AppointmentLead_campusId_nextContactAt_idx" ON "AppointmentLead"("campusId", "nextContactAt");
