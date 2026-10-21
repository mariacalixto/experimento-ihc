import { NextResponse } from "next/server";
import { SessionStatus } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/participant";
import { requiresConfirmation, taskActions } from "@/lib/experiment";

export async function POST(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const participant = await getCurrentParticipant();
  if (!participant) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
  const { sessionId } = await context.params;
  const session = participant.sessions.find((item) => item.id === sessionId);
  if (!session || session.status !== SessionStatus.IN_PROGRESS) return NextResponse.json({ error: "Esta sessão não está disponível." }, { status: 404 });

  try {
    await prisma.$transaction(async (transaction) => {
      const owned = await transaction.experimentalSession.findFirst({ where: { id: sessionId, participantId: participant.id, status: SessionStatus.IN_PROGRESS } });
      if (!owned) throw new Error("session_unavailable");
      if (!owned.startedAt) {
        await transaction.experimentalSession.updateMany({
          where: { id: sessionId, participantId: participant.id, status: SessionStatus.IN_PROGRESS, startedAt: null },
          data: { startedAt: new Date() },
        });
      }
      await transaction.agentAction.createMany({
        data: taskActions.map((action) => ({
          sessionId,
          actionType: action.type,
          description: action.description,
          requiresConfirmation: requiresConfirmation(session.autonomyLevel, action.key)!,
        })),
        skipDuplicates: true,
      });
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível iniciar a tarefa." }, { status: 409 });
  }
  return NextResponse.json({ started: true });
}
