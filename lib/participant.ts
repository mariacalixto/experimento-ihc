import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const cookieName = "experiment_session";

export function hashAccessToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createAccessToken() {
  return randomBytes(32).toString("base64url");
}

export async function getCurrentParticipant() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || token.length > 100) return null;
  return prisma.participant.findUnique({
    where: { accessTokenHash: hashAccessToken(token) },
    include: { sessions: { include: { actions: true, responses: true }, orderBy: { orderIndex: "asc" } } },
  });
}

export function setParticipantCookie(token: string) {
  return cookies().then((jar) => jar.set(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  }));
}

export function clearParticipantCookie() {
  return cookies().then((jar) => jar.set(cookieName, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 }));
}
