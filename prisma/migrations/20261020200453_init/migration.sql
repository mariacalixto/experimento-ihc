-- CreateEnum
CREATE TYPE "AutonomyLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED');

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "participantCode" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentalSession" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "autonomyLevel" "AutonomyLevel" NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ExperimentalSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAction" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AgentAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireResponse" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "questionCode" TEXT NOT NULL,
    "likertValue" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionnaireResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Participant_participantCode_key" ON "Participant"("participantCode");

-- CreateIndex
CREATE INDEX "ExperimentalSession_autonomyLevel_idx" ON "ExperimentalSession"("autonomyLevel");

-- CreateIndex
CREATE UNIQUE INDEX "ExperimentalSession_participantId_orderIndex_key" ON "ExperimentalSession"("participantId", "orderIndex");

-- CreateIndex
CREATE INDEX "AgentAction_sessionId_createdAt_idx" ON "AgentAction"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_sessionId_idx" ON "QuestionnaireResponse"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireResponse_sessionId_questionCode_key" ON "QuestionnaireResponse"("sessionId", "questionCode");

-- AddForeignKey
ALTER TABLE "ExperimentalSession" ADD CONSTRAINT "ExperimentalSession_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAction" ADD CONSTRAINT "AgentAction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExperimentalSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExperimentalSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
