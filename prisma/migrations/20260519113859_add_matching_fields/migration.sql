-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "phash" TEXT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "matchDismissed" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "titleSlug" VARCHAR(120);

-- CreateIndex
CREATE INDEX "Media_phash_idx" ON "Media"("phash");

-- CreateIndex
CREATE INDEX "Property_titleSlug_idx" ON "Property"("titleSlug");

-- CreateIndex
CREATE INDEX "Property_city_builtArea_idx" ON "Property"("city", "builtArea");
