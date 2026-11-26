-- 官网客户账号：平台统一分配账号名 + 密码（密码存 credentialHash）
ALTER TABLE "UserAccount" ADD COLUMN "username" VARCHAR(32);
CREATE UNIQUE INDEX "UserAccount_username_key" ON "UserAccount"("username");
