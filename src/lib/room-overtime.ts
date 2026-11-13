/** Presentation data only. The pending database trigger is the security boundary.
 * Uses the active transaction's authoritative ends_at, never scheduled checkout.
 * Caller supplies its live clock; this helper performs no reads or mutations.
 */
export function roomOvertimeIndicator(
  stay: { status: string; ends_at: string | null },
  nowMs: number,
) {
  const deadline = stay.ends_at === null ? NaN : Date.parse(stay.ends_at);
  const needsAction = stay.status === 'check_in'
    && Number.isFinite(nowMs) && Number.isFinite(deadline)
    && nowMs - deadline > 120 * 60_000;
  return {
    needsAction,
    area: needsAction ? 'PERLU TINDAKAN' : null,
    cardIndicator: needsAction ? 'red' : null,
    excludeFromRoomStatus: needsAction,
    // Unknown deadlines must not be presented as proof a room is available.
    deadlineKnown: Number.isFinite(deadline),
  } as const;
}
