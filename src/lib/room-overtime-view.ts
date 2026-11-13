import { roomOvertimeIndicator } from "./room-overtime.ts";

type Stay = { id: string; room_id: string | null; status: string; ends_at: string | null };

/** Only a real overdue active stay may mark a Booking's room as still occupied. */
export function hasOvertimeOccupant(stays: readonly Stay[], roomId: string, nowMs: number): boolean {
  return stays.some((stay) => stay.room_id === roomId && roomOvertimeIndicator(stay, nowMs).needsAction);
}

/** Never show a contradictory empty-state while unresolved stays are visible. */
export function showEmptyRoomState(
  activeLoading: boolean,
  activeError: string,
  statusRoomCount: number,
  overtimeCount: number,
): boolean {
  return !activeLoading && !activeError && statusRoomCount === 0 && overtimeCount === 0;
}
