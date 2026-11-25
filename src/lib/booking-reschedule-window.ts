/** Booking Owner reschedule preflight; authoritative cutoff is checked again by RPC. */
export const BOOKING_RESCHEDULE_LEAD_MS = 2 * 60 * 60 * 1000;

/** The original scheduled check-in is the cutoff, not a previously proposed time. */
export function isBookingRescheduleWindowClosed(originalCheckIn: string | null | undefined, nowMs: number): boolean {
  const originalMs = originalCheckIn ? Date.parse(originalCheckIn) : NaN;
  return !Number.isFinite(originalMs) || !Number.isFinite(nowMs) ||
    nowMs > originalMs - BOOKING_RESCHEDULE_LEAD_MS;
}

/** A proposed slot must also be at least two hours after the current time. */
export function isNewBookingCheckInTooNear(proposedMs: number, nowMs: number): boolean {
  return !Number.isFinite(proposedMs) || !Number.isFinite(nowMs) ||
    proposedMs < nowMs + BOOKING_RESCHEDULE_LEAD_MS;
}
