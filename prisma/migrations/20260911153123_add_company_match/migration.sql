-- CreateTable
CREATE TABLE "CompanyMatch" (
    "id" SERIAL NOT NULL,
    "fhrsId" INTEGER NOT NULL,
    "companyNumber" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "incorporationDate" TIMESTAMP(3),
    "companyStatus" TEXT,
    "sicCodes" TEXT[],
    "matchConfidence" TEXT NOT NULL,
    "publishable" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "licence" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMatch_fhrsId_key" ON "CompanyMatch"("fhrsId");

-- CreateIndex
CREATE INDEX "CompanyMatch_matchConfidence_idx" ON "CompanyMatch"("matchConfidence");
