import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shuffledConditions } from "@/lib/experiment";
import { createAccessToken, getCurrentParticipant, hashAccessToken, setParticipantCookie } from "@/lib/participant";
import { publicExperimentState } from "@/lib/experiment-state";

export async function GET() {
  const participant = await getCurrentParticipant();
  if (!participant) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 401 });
  return NextResponse.json(publicExperimentState(participant), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const existing = await getCurrentParticipant();
  if (existing) return NextResponse.json(publicExperimentState(existing), { headers: { "Cache-Control": "no-store" } });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }
  if (typeof body !== "object" || body === null || !("consent" in body) || body.consent !== true) {
    return NextResponse.json({ error: "É necessário confirmar o consentimento." }, { status: 400 });
  }

  const token = createAccessToken();
  const participantCode = randomBytes(5).toString("hex").toUpperCase();
  const order = shuffledConditions();
  const participant = await prisma.participant.create({
    data: {
      participantCode,
      accessTokenHash: hashAccessToken(token),
      consentedAt: new Date(),
      sessions: { create: order.map((autonomyLevel, index) => ({
        autonomyLevel,
        orderIndex: index + 1,
        runNumber: 1,
        isTestRun: false,
        startedAt: null,
      })) },
    },
    include: { sessions: { include: { actions: true, responses: true }, orderBy: { orderIndex: "asc" } } },
  });
  await setParticipantCookie(token);
  return NextResponse.json(publicExperimentState(participant), { status: 201, headers: { "Cache-Control": "no-store" } });
}
