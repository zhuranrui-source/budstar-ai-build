CREATE TABLE "AuthenticationVerificationCode" (
  "destination" VARCHAR(255) NOT NULL,
  "codeHash" CHAR(64) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthenticationVerificationCode_pkey" PRIMARY KEY ("destination")
);

CREATE TABLE "AuthenticationChallenge" (
  "tokenHash" CHAR(64) NOT NULL,
  "accountId" VARCHAR(255) NOT NULL,
  "intendedKind" VARCHAR(32) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthenticationChallenge_pkey" PRIMARY KEY ("tokenHash")
);

CREATE TABLE "AuthenticationRateLimitBucket" (
  "keyHash" CHAR(64) NOT NULL,
  "count" INTEGER NOT NULL,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AuthenticationRateLimitBucket_pkey" PRIMARY KEY ("keyHash")
);

CREATE INDEX "AuthenticationVerificationCode_expiresAt_idx"
ON "AuthenticationVerificationCode"("expiresAt");
CREATE INDEX "AuthenticationChallenge_expiresAt_idx"
ON "AuthenticationChallenge"("expiresAt");
CREATE INDEX "AuthenticationRateLimitBucket_resetAt_idx"
ON "AuthenticationRateLimitBucket"("resetAt");
