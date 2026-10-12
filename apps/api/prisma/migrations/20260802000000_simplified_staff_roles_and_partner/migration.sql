-- ADR-0009: 校区内员工仅保留教师；新增合作方账号类型
UPDATE "CampusMembership" SET roles = ARRAY['TEACHER']::"StaffRoleKind"[];

CREATE TYPE "StaffRoleKind_new" AS ENUM ('TEACHER');
ALTER TABLE "CampusMembership" ALTER COLUMN "roles" TYPE "StaffRoleKind_new"[] USING ARRAY['TEACHER']::"StaffRoleKind_new"[];
DROP TYPE "StaffRoleKind";
ALTER TYPE "StaffRoleKind_new" RENAME TO "StaffRoleKind";

ALTER TYPE "UserAccountKind" ADD VALUE 'PARTNER';
