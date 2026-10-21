import { ActionStatus, AutonomyLevel } from "@/app/generated/prisma/enums";

export const conditionOrder = [
  AutonomyLevel.LOW,
  AutonomyLevel.MEDIUM,
  AutonomyLevel.HIGH,
] as const;

export const taskActions = [
  {
    key: "add_focus_block",
    type: "add_appointment",
    description: "Adicionar um bloco de foco das 9h às 9h30.",
    requiresConfirmationAtMedium: false,
    appointmentId: "focus",
    startTime: "09:00",
    endTime: "09:30",
  },
  {
    key: "move_lunch",
    type: "move_appointment",
    description: "Mover o almoço das 12h para as 13h.",
    requiresConfirmationAtMedium: false,
    appointmentId: "lunch",
    startTime: "13:00",
    endTime: "14:00",
  },
  {
    key: "resolve_conflict",
    type: "resolve_conflict",
    description: "Mover a revisão de projeto para 11h30 e resolver o conflito com a ligação de cliente.",
    requiresConfirmationAtMedium: true,
    appointmentId: "review",
    startTime: "11:30",
    endTime: "12:30",
  },
] as const;

export const questionnaireQuestions = [
  { code: "control", text: "Senti que mantive o controle durante a tarefa." },
  { code: "understanding", text: "Entendi o que o agente estava fazendo." },
  { code: "trust", text: "Confiei nas ações realizadas pelo agente." },
  { code: "agency", text: "Pude influenciar o resultado da tarefa." },
  { code: "comfort", text: "Fiquei confortável com o nível de autonomia do agente." },
] as const;

export function requiresConfirmation(level: string, actionKey: string) {
  const action = taskActions.find((item) => item.key === actionKey);
  if (!action) return null;
  if (level === AutonomyLevel.LOW) return true;
  if (level === AutonomyLevel.MEDIUM) return action.requiresConfirmationAtMedium;
  return false;
}

export function allActionsResolved(actions: { status: string }[]) {
  return actions.every((action) => action.status !== ActionStatus.PENDING);
}

export function shuffledConditions(random = Math.random) {
  const result = [...conditionOrder];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
