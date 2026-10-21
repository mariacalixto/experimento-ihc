ALTER TABLE "ExperimentalSession"
ADD COLUMN "runNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "isTestRun" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX "ExperimentalSession_participantId_orderIndex_key";

CREATE UNIQUE INDEX "ExperimentalSession_participantId_runNumber_orderIndex_key"
ON "ExperimentalSession"("participantId", "runNumber", "orderIndex");
