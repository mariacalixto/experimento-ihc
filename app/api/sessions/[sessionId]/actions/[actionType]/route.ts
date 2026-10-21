import { NextResponse } from "next/server";
import { ActionStatus, SessionStatus } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { getCurrentParticipant } from "@/lib/participant";
import { taskActions } from "@/lib/experiment";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string; actionType: string }> }) {
  const participant = await getCurrentParticipant();
  if (!participant) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
  const { sessionId, actionType } = await context.params;
  const session = participant.sessions.find((item) => item.id === sessionId);
  if (!session || session.status !== SessionStatus.IN_PROGRESS || !session.startedAt) return NextResponse.json({ error: "Esta sessão não está disponível." }, { status: 404 });
  const definition = taskActions.find((item) => item.type === actionType);
  if (!definition) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }
  const decision = typeof body === "object" && body !== null && "decision" in body ? body.decision : null;
  const allowed = session.actions.find((item) => item.actionType === actionType);
  if (!allowed) return NextResponse.json({ error: "Ação não pertence a esta tarefa." }, { status: 404 });
  if (decision !== "execute" && decision !== "approve" && decision !== "reject") return NextResponse.json({ error: "Decisão inválida." }, { status: 400 });
  if (allowed.requiresConfirmation && decision === "execute") return NextResponse.json({ error: "Esta ação exige aprovação explícita." }, { status: 400 });
  if (!allowed.requiresConfirmation && decision !== "execute") return NextResponse.json({ error: "Esta ação é executada automaticamente nesta condição." }, { status: 400 });
  if (allowed.status !== ActionStatus.PENDING) {
    if (((decision === "execute" || decision === "approve") && allowed.status === ActionStatus.EXECUTED) || (decision === "reject" && allowed.status === ActionStatus.REJECTED)) {
      return NextResponse.json({ status: allowed.status });
    }
    return NextResponse.json({ error: "A ação já foi resolvida." }, { status: 409 });
  }
  const result = await prisma.agentAction.updateMany({
    where: { id: allowed.id, sessionId, status: ActionStatus.PENDING, session: { participantId: participant.id, status: SessionStatus.IN_PROGRESS } },
    data: { status: decision === "reject" ? ActionStatus.REJECTED : ActionStatus.EXECUTED, resolvedAt: new Date() },
  });
  if (result.count !== 1) return NextResponse.json({ error: "A ação não pôde ser atualizada." }, { status: 409 });
  return NextResponse.json({ status: decision === "reject" ? ActionStatus.REJECTED : ActionStatus.EXECUTED });
}
