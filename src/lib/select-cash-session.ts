/** Local context selection only: backend remains authoritative for identity and RLS. */
export function selectCashSession<T extends { id: string; status: string; opened_by: string }>(
  sessions: readonly T[],
  userId: string,
  helperAllowed: boolean,
  selectedSessionId: string,
  trainingSessionId: string | null,
  isTraining: boolean,
) {
  const open = sessions.filter((session) => session.status === "OPEN");
  if (isTraining) {
    return open.find((session) => session.id === trainingSessionId);
  }
  const own = open.find((session) => session.opened_by === userId);
  if (helperAllowed && selectedSessionId) {
    // Explicit choice is fail-closed: CLOSED/missing assistance never switches drawers.
    return open.find((session) => session.id === selectedSessionId);
  }
  return own ?? (helperAllowed && open.length === 1 ? open[0] : undefined);
}
