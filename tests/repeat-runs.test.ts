import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";
import { ActionStatus, AutonomyLevel, SessionStatus } from "@/app/generated/prisma/enums";
import { publicExperimentState } from "@/lib/experiment-state";
import { prisma } from "@/lib/prisma";

test("public state only exposes the latest run while preserving its identity", () => {
  const state = publicExperimentState({
    participantCode: "AB12CD34EF",
    sessions: [
      { id: "official", autonomyLevel: "LOW", orderIndex: 1, runNumber: 1, isTestRun: false, startedAt: null, status: "COMPLETED", actions: [], responses: [] },
      { id: "test-2", autonomyLevel: "HIGH", orderIndex: 1, runNumber: 2, isTestRun: true, startedAt: null, status: "IN_PROGRESS", actions: [], responses: [] },
    ],
  });
  assert.equal(state.participantCode, "AB12CD34EF");
  assert.equal(state.runNumber, 2);
  assert.equal(state.isTestRun, true);
  assert.deepEqual(state.sessions.map((session) => session.id), ["test-2"]);
});

test("repeated test runs have independent progress and retain prior records", async () => {
  let assertionError: unknown;
  try {
    await prisma.$transaction(async (tx) => {
      try {
        const participant = await tx.participant.create({
          data: { participantCode: randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase(), accessTokenHash: randomUUID() },
        });
        await tx.$queryRaw`WITH lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${participant.id}))) SELECT 1 FROM lock`;
        const official = await tx.experimentalSession.create({
          data: { participantId: participant.id, autonomyLevel: AutonomyLevel.LOW, orderIndex: 1, runNumber: 1, status: SessionStatus.COMPLETED, isTestRun: false, startedAt: new Date(), finishedAt: new Date() },
        });
        await tx.agentAction.create({ data: { sessionId: official.id, actionType: "test_action", description: "Ação anterior", status: ActionStatus.EXECUTED } });
        await tx.questionnaireResponse.create({ data: { sessionId: official.id, questionCode: "control", likertValue: 5, comment: "Resposta anterior" } });

        const runTwo = await tx.experimentalSession.createMany({
          data: [AutonomyLevel.LOW, AutonomyLevel.MEDIUM, AutonomyLevel.HIGH].map((autonomyLevel, index) => ({
            participantId: participant.id, autonomyLevel, orderIndex: index + 1, runNumber: 2, isTestRun: true, startedAt: null,
          })),
        });
        const latestSessions = await tx.experimentalSession.findMany({
          where: { participantId: participant.id, runNumber: 2 },
          include: { actions: true, responses: true },
          orderBy: { orderIndex: "asc" },
        });
        const prior = await tx.experimentalSession.findUnique({ where: { id: official.id }, include: { actions: true, responses: true } });
        const foreignSession = await tx.experimentalSession.findFirst({ where: { id: official.id, participantId: randomUUID() } });

        assert.equal(runTwo.count, 3);
        assert.equal(latestSessions.length, 3);
        assert.deepEqual(latestSessions.map((session) => session.autonomyLevel), [AutonomyLevel.LOW, AutonomyLevel.MEDIUM, AutonomyLevel.HIGH]);
        assert.ok(latestSessions.every((session) => session.status === SessionStatus.IN_PROGRESS && session.startedAt === null && session.actions.length === 0 && session.responses.length === 0));
        assert.equal(prior?.status, SessionStatus.COMPLETED);
        assert.equal(prior?.actions[0]?.status, ActionStatus.EXECUTED);
        assert.equal(prior?.responses[0]?.likertValue, 5);
        assert.equal(prior?.responses[0]?.comment, "Resposta anterior");
        assert.equal(foreignSession, null);

        const sameRun = await tx.experimentalSession.createMany({
          data: [AutonomyLevel.LOW, AutonomyLevel.MEDIUM, AutonomyLevel.HIGH].map((autonomyLevel, index) => ({
            participantId: participant.id, autonomyLevel, orderIndex: index + 1, runNumber: 2, isTestRun: true, startedAt: null,
          })),
          skipDuplicates: true,
        });
        assert.equal(sameRun.count, 0, "repeated requests cannot create a second set for the same run");
      } catch (error) {
        assertionError = error;
      }
      throw new Error("rollback repeat-run fixture");
    });
  } catch {
    // The fixture is intentionally rolled back so the test never leaves participant data behind.
  }
  if (assertionError) throw assertionError;
});
