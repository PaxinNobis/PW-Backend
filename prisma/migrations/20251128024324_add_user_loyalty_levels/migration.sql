-- CreateTable
CREATE TABLE "user_loyalty_levels" (
    "userId" TEXT NOT NULL,
    "streamerId" TEXT NOT NULL,
    "loyaltyLevelId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_loyalty_levels_pkey" PRIMARY KEY ("userId","streamerId")
);

-- CreateIndex
CREATE INDEX "user_loyalty_levels_userId_idx" ON "user_loyalty_levels"("userId");

-- CreateIndex
CREATE INDEX "user_loyalty_levels_streamerId_idx" ON "user_loyalty_levels"("streamerId");

-- AddForeignKey
ALTER TABLE "user_loyalty_levels" ADD CONSTRAINT "user_loyalty_levels_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_loyalty_levels" ADD CONSTRAINT "user_loyalty_levels_streamerId_fkey" FOREIGN KEY ("streamerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_loyalty_levels" ADD CONSTRAINT "user_loyalty_levels_loyaltyLevelId_fkey" FOREIGN KEY ("loyaltyLevelId") REFERENCES "loyalty_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
