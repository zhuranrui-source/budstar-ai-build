CREATE TABLE "PublicRateLimitBucket" (
    "keyHash" CHAR(64) NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicRateLimitBucket_pkey" PRIMARY KEY ("keyHash")
);

CREATE INDEX "PublicRateLimitBucket_resetAt_idx"
ON "PublicRateLimitBucket"("resetAt");
