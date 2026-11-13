/** Dashboard Booking visibility is tied to the arrival calendar day in WIB,
 * not interval overlap with the scheduled checkout day.
 * Uses explicit Asia/Jakarta regardless of the browser's own timezone.
 */
export function isBookingArrivalDay(
  booking: { status: string; scheduled_check_in: string | null },
  nowMs: number,
): boolean {
  if (booking.status !== "booking" || !Number.isFinite(nowMs) || !booking.scheduled_check_in) return false;
  const arrival = Date.parse(booking.scheduled_check_in);
  if (!Number.isFinite(arrival)) return false;
  const format = (value: number) => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
  return format(arrival) === format(nowMs);
}
