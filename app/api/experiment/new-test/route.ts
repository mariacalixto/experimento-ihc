import { NextResponse } from "next/server";
import { SessionStatus } from "@/app/generated/prisma/enums";
import { conditionOrder } from "@/lib/experiment";
import { publicExperimentState } from "@/lib/experiment-state";
import { getCurrentParticipant } from "@/lib/participant";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const participant = await getCurrentParticipant();
    if (!participant) return NextResponse.json({ error: "Sessão não encontrada. Atualize a página e tente iniciar uma nova participação." }, { status: 401 });

    await prisma.$transaction(async (transaction) => {
      // Serialize repeated clicks for this participant, including requests from another tab.
      await transaction.$queryRaw`WITH lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${participant.id}))) SELECT 1 FROM lock`;
      const sessions = await transaction.experimentalSession.findMany({
        where: { participantId: participant.id },
        orderBy: [{ runNumber: "desc" }, { orderIndex: "asc" }],
        select: { runNumber: true, status: true },
      });
      if (sessions.length === 0) throw new Error("participant_has_no_runs");

      const latestRun = sessions[0].runNumber;
      if (sessions.some((session) => session.runNumber === latestRun && session.status === SessionStatus.IN_PROGRESS)) {
        return latestRun;
      }

      const nextRun = latestRun + 1;
      await transaction.experimentalSession.createMany({
        data: conditionOrder.map((autonomyLevel, index) => ({
          participantId: participant.id,
          autonomyLevel,
          orderIndex: index + 1,
          runNumber: nextRun,
          isTestRun: true,
          startedAt: null,
        })),
      });
      return nextRun;
    });

    const refreshed = await getCurrentParticipant();
    if (!refreshed || refreshed.sessions.length === 0) {
      return NextResponse.json({ error: "Não foi possível recuperar a nova execução." }, { status: 500 });
    }
    const currentRun = Math.max(...refreshed.sessions.map((session) => session.runNumber));
    return NextResponse.json(publicExperimentState(refreshed, currentRun), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to start a new test run", error);
    return NextResponse.json({ error: "Não foi possível iniciar um novo teste. Tente novamente." }, { status: 500 });
  }
}
