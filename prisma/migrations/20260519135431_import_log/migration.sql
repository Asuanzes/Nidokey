-- CreateEnum
CREATE TYPE "ImportLogKind" AS ENUM ('HASH', 'CATASTRO', 'GEOCODE', 'MATCH', 'MERGE_AUTO', 'MERGE_MANUAL', 'BORROW_FIELDS', 'RECHECK');

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT,
    "kind" "ImportLogKind" NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "message" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportLog_propertyId_createdAt_idx" ON "ImportLog"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportLog_kind_createdAt_idx" ON "ImportLog"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "ImportLog_createdAt_idx" ON "ImportLog"("createdAt");
