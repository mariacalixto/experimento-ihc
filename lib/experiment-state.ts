type ParticipantState = {
  participantCode: string;
  sessions: Array<{
    id: string;
    autonomyLevel: "LOW" | "MEDIUM" | "HIGH";
    orderIndex: number;
    runNumber: number;
    isTestRun: boolean;
    startedAt: Date | null;
    status: "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
    actions: Array<{ id: string; actionType: string; description: string; requiresConfirmation: boolean; status: "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED" }>;
    responses: Array<{ questionCode: string; likertValue: number | null; comment: string | null }>;
  }>;
};

export function publicExperimentState(participant: ParticipantState, requestedRun?: number) {
  const runNumber = requestedRun ?? Math.max(...participant.sessions.map((session) => session.runNumber));
  const sessions = participant.sessions
    .filter((session) => session.runNumber === runNumber)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  return {
    participantCode: participant.participantCode,
    runNumber,
    isTestRun: sessions[0]?.isTestRun ?? false,
    sessions: sessions.map(({ id, autonomyLevel, orderIndex, status, startedAt, actions, responses }) => ({
      id, autonomyLevel, orderIndex, status, startedAt,
      actions: actions.map(({ id: actionId, actionType, description, requiresConfirmation, status: actionStatus }) => ({
        id: actionId, actionType, description, requiresConfirmation, status: actionStatus,
      })),
      responses: responses.map(({ questionCode, likertValue, comment }) => ({ questionCode, likertValue, comment })),
    })),
  };
}
