-- CreateTable
CREATE TABLE "RatingHistory" (
    "id" SERIAL NOT NULL,
    "fhrsId" INTEGER NOT NULL,
    "ratingValue" TEXT NOT NULL,
    "schemeType" TEXT NOT NULL,
    "ratingDate" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RatingHistory_fhrsId_recordedAt_idx" ON "RatingHistory"("fhrsId", "recordedAt");
