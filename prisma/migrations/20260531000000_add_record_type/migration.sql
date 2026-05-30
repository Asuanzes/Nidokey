-- Discriminador de tipo de registro (records unificados).
-- Migración ADITIVA y no destructiva: añade una columna con default, así que
-- todas las filas existentes quedan marcadas como "property" automáticamente.
--
-- NOTA: generada a mano (sin DB local en el entorno de desarrollo). Antes de
-- desplegar, verificar con `prisma migrate status` y aplicar con
-- `prisma migrate deploy`. No se ha ejecutado todavía contra producción.

-- AlterTable
ALTER TABLE "Property" ADD COLUMN "recordType" TEXT NOT NULL DEFAULT 'property';

-- CreateIndex
CREATE INDEX "Property_recordType_idx" ON "Property"("recordType");
