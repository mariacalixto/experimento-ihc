import { NextResponse } from "next/server";
import { SessionStatus } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { clearParticipantCookie, getCurrentParticipant } from "@/lib/participant";

export async function POST() {
  const participant = await getCurrentParticipant();
  if (!participant) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
  await prisma.experimentalSession.updateMany({
    where: { participantId: participant.id, status: SessionStatus.IN_PROGRESS },
    data: { status: SessionStatus.ABANDONED, finishedAt: new Date() },
  });
  await clearParticipantCookie();
  return NextResponse.json({ withdrawn: true });
}
