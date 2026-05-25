-- CreateTable
CREATE TABLE "MatchSuggestion" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "blockedReason" TEXT,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MatchSuggestion_sourceId_dismissedAt_idx" ON "MatchSuggestion"("sourceId", "dismissedAt");

-- CreateIndex
CREATE INDEX "MatchSuggestion_score_dismissedAt_idx" ON "MatchSuggestion"("score", "dismissedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchSuggestion_sourceId_targetId_key" ON "MatchSuggestion"("sourceId", "targetId");
