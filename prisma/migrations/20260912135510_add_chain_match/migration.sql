-- CreateTable
CREATE TABLE "ChainMatch" (
    "id" SERIAL NOT NULL,
    "fhrsId" INTEGER NOT NULL,
    "wikidataId" TEXT NOT NULL,
    "chainName" TEXT NOT NULL,
    "foundedDate" TIMESTAMP(3),
    "headquarters" TEXT,
    "website" TEXT,
    "source" TEXT NOT NULL,
    "licence" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChainMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChainMatch_fhrsId_key" ON "ChainMatch"("fhrsId");
