-- 消费端账号持久化：微信 openid 仅存 HMAC 摘要
ALTER TABLE "UserAccount" ADD COLUMN "wechatOpenidHash" CHAR(64);
CREATE UNIQUE INDEX "UserAccount_wechatOpenidHash_key" ON "UserAccount"("wechatOpenidHash");
