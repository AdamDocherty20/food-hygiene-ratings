-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Establishment" (
    "id" SERIAL NOT NULL,
    "fhrsId" INTEGER NOT NULL,
    "localAuthorityBusinessId" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "businessTypeId" INTEGER NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "addressLine3" TEXT,
    "addressLine4" TEXT,
    "postcode" TEXT,
    "ratingValue" TEXT NOT NULL,
    "ratingKey" TEXT NOT NULL,
    "ratingDate" TIMESTAMP(3),
    "schemeType" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "localAuthorityName" TEXT NOT NULL,
    "localAuthorityCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Establishment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Establishment_fhrsId_key" ON "Establishment"("fhrsId");

-- CreateIndex
CREATE INDEX "Establishment_postcode_idx" ON "Establishment"("postcode");

-- CreateIndex
CREATE INDEX "Establishment_latitude_longitude_idx" ON "Establishment"("latitude", "longitude");

