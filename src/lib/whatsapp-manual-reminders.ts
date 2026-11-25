/** Poin 4: presentation-time WhatsApp reminders, never an overtime tariff/trigger.
 * No scheduling, sending, charging, database writes, or persistence here.
 * The UI must re-read the authoritative transaction before preparing the message.
 */
export type ManualReminderKind = 'PENGINGAT_BOOKING_30_MENIT' | 'PENGINGAT_WAKTU_HABIS' | 'PEMBERITAHUAN_OVERTIME';
export type ReminderCandidate = {
  id: string;
  transaction_number: string;
  status: string;
  scheduled_check_in: string | null;
  ends_at: string | null;
  checked_out_at: string | null;
};

const MINUTE = 60_000;
export const BOOKING_REMINDER_LEAD_MS = 30 * MINUTE;
export const CHECKOUT_REMINDER_TOLERANCE_MS = 15 * MINUTE;

export function manualReminderEligibility(
  item: ReminderCandidate,
  nowMs: number,
): ManualReminderKind | null {
  if (!Number.isFinite(nowMs) || item.checked_out_at) return null;
  if (item.status === 'booking') {
    const start = item.scheduled_check_in ? Date.parse(item.scheduled_check_in) : NaN;
    return Number.isFinite(start) && nowMs >= start - BOOKING_REMINDER_LEAD_MS && nowMs < start
      ? 'PENGINGAT_BOOKING_30_MENIT' : null;
  }
  if (item.status === 'check_in') {
    const end = item.ends_at ? Date.parse(item.ends_at) : NaN;
    // Exactly 15 min of checkout-end reminder; afterwards the separate
    // Owner-requested overtime NOTICE becomes eligible. This pure function
    // never calculates charges, extends stays or sends WhatsApp.
    if (!Number.isFinite(end) || nowMs < end) return null;
    return nowMs < end + CHECKOUT_REMINDER_TOLERANCE_MS
      ? 'PENGINGAT_WAKTU_HABIS' : 'PEMBERITAHUAN_OVERTIME';
  }
  return null;
}

const wib = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'short',
  year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export function reminderTimeWib(raw: string | null): string {
  if (!raw || !Number.isFinite(Date.parse(raw))) throw new Error('Waktu resmi transaksi tidak tersedia.');
  return wib.format(new Date(raw)).replace(' pukul ', ' • ') + ' WIB';
}
