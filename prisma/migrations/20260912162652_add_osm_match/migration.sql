-- CreateTable
CREATE TABLE "OsmMatch" (
    "id" SERIAL NOT NULL,
    "fhrsId" INTEGER NOT NULL,
    "osmType" TEXT NOT NULL,
    "osmId" BIGINT NOT NULL,
    "matchMethod" TEXT NOT NULL,
    "distanceMeters" DOUBLE PRECISION,
    "nameScore" INTEGER,
    "cuisine" TEXT,
    "openingHours" TEXT,
    "takeaway" TEXT,
    "delivery" TEXT,
    "outdoorSeating" TEXT,
    "wheelchair" TEXT,
    "dietVegan" TEXT,
    "dietVegetarian" TEXT,
    "dietHalal" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "source" TEXT NOT NULL,
    "licence" TEXT NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OsmMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OsmMatch_fhrsId_key" ON "OsmMatch"("fhrsId");

-- CreateIndex
CREATE INDEX "OsmMatch_matchMethod_idx" ON "OsmMatch"("matchMethod");
