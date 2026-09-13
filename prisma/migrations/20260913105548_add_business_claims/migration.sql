-- CreateTable
CREATE TABLE "BusinessClaim" (
    "id" SERIAL NOT NULL,
    "fhrsId" INTEGER NOT NULL,
    "claimantName" TEXT NOT NULL,
    "claimantEmail" TEXT NOT NULL,
    "claimantPhone" TEXT,
    "relationship" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "BusinessClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessProfile" (
    "id" SERIAL NOT NULL,
    "fhrsId" INTEGER NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "photoUrls" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessClaim_fhrsId_idx" ON "BusinessClaim"("fhrsId");

-- CreateIndex
CREATE INDEX "BusinessClaim_status_idx" ON "BusinessClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessProfile_fhrsId_key" ON "BusinessProfile"("fhrsId");
