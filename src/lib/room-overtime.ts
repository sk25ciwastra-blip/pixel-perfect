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

/** Read-only room filter: the newest active stay matches the card's TRX selection.
 * Housekeeping results are deliberately not inputs to this overtime filter.
 */
export function overtimeRoomIds(
  rooms: ReadonlyArray<{ id: string; active: boolean; status: string }>,
  stays: ReadonlyArray<{ room_id: string; status: string; ends_at: string | null; created_at: string }>,
  nowMs: number,
) {
  const latest = new Map<string, (typeof stays)[number]>();
  for (const stay of stays) {
    if (stay.status !== 'check_in') continue;
    const current = latest.get(stay.room_id);
    if (!current || Date.parse(stay.created_at) > Date.parse(current.created_at)) {
      latest.set(stay.room_id, stay);
    }
  }
  return new Set(rooms.filter(room => {
    const stay = latest.get(room.id);
    return room.active && room.status === 'occupied' && stay
      && roomOvertimeIndicator(stay, nowMs).needsAction;
  }).map(room => room.id));
}
