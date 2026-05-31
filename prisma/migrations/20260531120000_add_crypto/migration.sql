-- Registros de tipo CRIPTO (primer tipo nuevo del framework de records).
-- Migración ADITIVA: crea tablas nuevas, no toca las existentes.
--
-- NOTA: escrita a mano (sin DB local en desarrollo). Aplicar con
-- `prisma migrate deploy` tras revisión. No ejecutada aún en producción.

-- CreateTable
CREATE TABLE "CryptoHolding" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "recordType" TEXT NOT NULL DEFAULT 'crypto',
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "status" TEXT,
    "symbol" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "quantity" DECIMAL(36,18),
    "currentValue" INTEGER,
    "currency" TEXT DEFAULT 'EUR',
    "imageUrl" TEXT,
    "source" TEXT,
    "externalId" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoSnapshot" (
    "id" TEXT NOT NULL,
    "holdingId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "CryptoSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CryptoHolding_ownerId_symbol_quoteCurrency_source_key" ON "CryptoHolding"("ownerId", "symbol", "quoteCurrency", "source");

-- CreateIndex
CREATE INDEX "CryptoHolding_recordType_idx" ON "CryptoHolding"("recordType");

-- CreateIndex
CREATE INDEX "CryptoHolding_lastCheckedAt_idx" ON "CryptoHolding"("lastCheckedAt");

-- CreateIndex
CREATE INDEX "CryptoSnapshot_holdingId_observedAt_idx" ON "CryptoSnapshot"("holdingId", "observedAt");

-- AddForeignKey
ALTER TABLE "CryptoHolding" ADD CONSTRAINT "CryptoHolding_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoSnapshot" ADD CONSTRAINT "CryptoSnapshot_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "CryptoHolding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
