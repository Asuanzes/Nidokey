-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOUSE', 'PISO', 'ATICO', 'CHALET', 'DUPLEX', 'ESTUDIO', 'LOFT', 'LOCAL', 'TERRENO', 'OTRO');

-- CreateEnum
CREATE TYPE "PropertyStatus" AS ENUM ('FOR_SALE', 'RESERVED', 'SOLD', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "EnergyRating" AS ENUM ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Portal" AS ENUM ('IDEALISTA', 'FOTOCASA', 'PISOS_COM', 'MILANUNCIOS', 'OTHER', 'MANUAL');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'PRICE_DROP', 'PRICE_UP', 'SOLD', 'REMOVED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('PHOTO', 'FLOORPLAN', 'VIDEO', 'TOUR_3D', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "MediaSource" AS ENUM ('USER_UPLOAD', 'PORTAL_SCRAPE', 'CADASTRE', 'AI_SKETCH', 'AI_RECONSTRUCTION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "PropertyType" NOT NULL,
    "status" "PropertyStatus" NOT NULL DEFAULT 'FOR_SALE',
    "currentPrice" INTEGER,
    "address" TEXT,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'España',
    "postalCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "neighborhood" TEXT,
    "environment" TEXT,
    "tags" TEXT[],
    "rooms" INTEGER,
    "bathrooms" INTEGER,
    "builtArea" INTEGER,
    "usableArea" INTEGER,
    "plotArea" INTEGER,
    "floor" TEXT,
    "hasElevator" BOOLEAN,
    "hasGarage" BOOLEAN,
    "hasStorage" BOOLEAN,
    "hasTerrace" BOOLEAN,
    "hasFireplace" BOOLEAN,
    "hasGarden" BOOLEAN,
    "hasPool" BOOLEAN,
    "yearBuilt" INTEGER,
    "energyRating" "EnergyRating" NOT NULL DEFAULT 'UNKNOWN',
    "cadastralRef" TEXT,
    "cadastralData" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "source" "MediaSource" NOT NULL DEFAULT 'USER_UPLOAD',
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "portal" "Portal" NOT NULL,
    "url" TEXT NOT NULL,
    "externalId" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastPrice" INTEGER,
    "lastSeenAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "listingId" TEXT,
    "propertyId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "status" "ListingStatus",
    "source" "Portal" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "portal" "Portal" NOT NULL,
    "url" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Property_city_province_idx" ON "Property"("city", "province");

-- CreateIndex
CREATE INDEX "Property_type_status_idx" ON "Property"("type", "status");

-- CreateIndex
CREATE INDEX "Property_currentPrice_idx" ON "Property"("currentPrice");

-- CreateIndex
CREATE INDEX "Property_cadastralRef_idx" ON "Property"("cadastralRef");

-- CreateIndex
CREATE INDEX "Media_propertyId_kind_idx" ON "Media"("propertyId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_url_key" ON "Listing"("url");

-- CreateIndex
CREATE INDEX "Listing_portal_status_idx" ON "Listing"("portal", "status");

-- CreateIndex
CREATE INDEX "PriceSnapshot_propertyId_observedAt_idx" ON "PriceSnapshot"("propertyId", "observedAt");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
