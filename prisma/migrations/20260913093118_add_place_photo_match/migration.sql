-- CreateTable
CREATE TABLE "PlacePhotoMatch" (
    "id" SERIAL NOT NULL,
    "fhrsId" INTEGER NOT NULL,
    "googlePlaceId" TEXT,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacePhotoMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlacePhotoMatch_fhrsId_key" ON "PlacePhotoMatch"("fhrsId");
