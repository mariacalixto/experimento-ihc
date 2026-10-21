ALTER TABLE "ExperimentalSession" ALTER COLUMN "startedAt" DROP NOT NULL;
CREATE UNIQUE INDEX "AgentAction_sessionId_actionType_key" ON "AgentAction"("sessionId", "actionType");
