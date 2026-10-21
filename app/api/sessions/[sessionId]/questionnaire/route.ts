import { NextResponse } from "next/server";
import { SessionStatus } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { allActionsResolved, questionnaireQuestions, taskActions } from "@/lib/experiment";
import { getCurrentParticipant } from "@/lib/participant";

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const participant = await getCurrentParticipant();
  if (!participant) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
  const { sessionId } = await context.params;
  const session = participant.sessions.find((item) => item.id === sessionId);
  if (!session) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  if (session.status === SessionStatus.COMPLETED) return NextResponse.json({ completed: true });
  if (session.status !== SessionStatus.IN_PROGRESS || !session.startedAt || session.actions.length !== taskActions.length || !allActionsResolved(session.actions)) {
    return NextResponse.json({ error: "Conclua as ações antes de responder." }, { status: 409 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }
  const answers = typeof body === "object" && body !== null && "answers" in body ? body.answers : null;
  const comment = typeof body === "object" && body !== null && "comment" in body ? body.comment : "";
  const answerCodes = Array.isArray(answers) ? answers.map((answer) => typeof answer === "object" && answer !== null && "questionCode" in answer ? answer.questionCode : null) : [];
  if (!Array.isArray(answers) || answers.length !== questionnaireQuestions.length || new Set(answerCodes).size !== questionnaireQuestions.length ||
      !questionnaireQuestions.every((question) => answers.some((answer) => typeof answer === "object" && answer !== null && "questionCode" in answer && answer.questionCode === question.code && "likertValue" in answer && Number.isInteger(answer.likertValue) && Number(answer.likertValue) >= 1 && Number(answer.likertValue) <= 5))) {
    return NextResponse.json({ error: "Responda todas as afirmações usando uma escala de 1 a 5." }, { status: 400 });
  }
  if (typeof comment !== "string" || comment.length > 1500) return NextResponse.json({ error: "O comentário deve ter até 1.500 caracteres." }, { status: 400 });

  try {
    await prisma.$transaction([
      prisma.questionnaireResponse.createMany({ data: answers.map((answer) => ({
        sessionId,
        questionCode: String(answer.questionCode),
        likertValue: Number(answer.likertValue),
        comment: String(answer.questionCode) === questionnaireQuestions[0].code && comment.trim() ? comment.trim() : null,
      })) }),
      prisma.experimentalSession.updateMany({
        where: { id: sessionId, participantId: participant.id, status: SessionStatus.IN_PROGRESS },
        data: { status: SessionStatus.COMPLETED, finishedAt: new Date() },
      }),
    ]);
  } catch {
    return NextResponse.json({ error: "As respostas desta sessão já foram registradas." }, { status: 409 });
  }
  return NextResponse.json({ completed: true });
}
