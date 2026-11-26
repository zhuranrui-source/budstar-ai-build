-- CreateEnum
CREATE TYPE "PlanetCategory" AS ENUM ('WORK', 'COMPETITION', 'CULTURE', 'COURSE');

-- CreateEnum
CREATE TYPE "PlanetContentStatus" AS ENUM ('PUBLISHED', 'PENDING_REVIEW', 'REMOVED');

-- CreateEnum
CREATE TYPE "PlanetAuthorKind" AS ENUM ('STAFF', 'PARENT');

-- CreateTable
CREATE TABLE "PlanetPost" (
    "id" UUID NOT NULL,
    "category" "PlanetCategory" NOT NULL,
    "title" VARCHAR(60) NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrls" TEXT[],
    "studentInitial" VARCHAR(1),
    "guardianConsent" BOOLEAN NOT NULL DEFAULT false,
    "authorAccountId" UUID NOT NULL,
    "authorKind" "PlanetAuthorKind" NOT NULL,
    "status" "PlanetContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "reviewReason" VARCHAR(200),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanetPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanetPostLike" (
    "postId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanetPostLike_pkey" PRIMARY KEY ("postId","accountId")
);

-- CreateTable
CREATE TABLE "PlanetPostFavorite" (
    "postId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanetPostFavorite_pkey" PRIMARY KEY ("postId","accountId")
);

-- CreateTable
CREATE TABLE "PlanetComment" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "authorAccountId" UUID NOT NULL,
    "body" VARCHAR(300) NOT NULL,
    "status" "PlanetContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "reviewReason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanetComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanetPost_status_pinned_createdAt_idx" ON "PlanetPost"("status", "pinned", "createdAt");

-- CreateIndex
CREATE INDEX "PlanetPost_category_status_createdAt_idx" ON "PlanetPost"("category", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PlanetPost_authorAccountId_createdAt_idx" ON "PlanetPost"("authorAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "PlanetPostLike_accountId_idx" ON "PlanetPostLike"("accountId");

-- CreateIndex
CREATE INDEX "PlanetPostFavorite_accountId_createdAt_idx" ON "PlanetPostFavorite"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "PlanetComment_postId_status_createdAt_idx" ON "PlanetComment"("postId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PlanetComment_status_createdAt_idx" ON "PlanetComment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PlanetComment_authorAccountId_createdAt_idx" ON "PlanetComment"("authorAccountId", "createdAt");

-- AddForeignKey
ALTER TABLE "PlanetPost" ADD CONSTRAINT "PlanetPost_authorAccountId_fkey" FOREIGN KEY ("authorAccountId") REFERENCES "UserAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanetPostLike" ADD CONSTRAINT "PlanetPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "PlanetPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanetPostLike" ADD CONSTRAINT "PlanetPostLike_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanetPostFavorite" ADD CONSTRAINT "PlanetPostFavorite_postId_fkey" FOREIGN KEY ("postId") REFERENCES "PlanetPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanetPostFavorite" ADD CONSTRAINT "PlanetPostFavorite_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanetComment" ADD CONSTRAINT "PlanetComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "PlanetPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanetComment" ADD CONSTRAINT "PlanetComment_authorAccountId_fkey" FOREIGN KEY ("authorAccountId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

