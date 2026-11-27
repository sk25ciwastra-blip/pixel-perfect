/**
 * Labels and timestamps shown in Detail Tamu history tabs.
 * Booking uses the planned schedule, transaction uses its recorded date,
 * and visit uses the real check-in time. Never infer actual check-in/out
 * from a proposed booking or a transaction creation timestamp.
 */
export type GuestHistoryTab = 'kunjungan' | 'transaksi' | 'booking';
type HistoryTimes = {
  created_at: string;
  started_at: string | null;
  checked_out_at: string | null;
  scheduled_check_in: string | null;
  scheduled_check_out: string | null;
};

export function guestHistoryDateHeading(tab: GuestHistoryTab): string {
  if (tab === 'booking') return 'Jadwal Check-in';
  if (tab === 'transaksi') return 'Tgl Transaksi';
  return 'Tgl Kunjungan';
}

export function guestHistoryInHeading(tab: GuestHistoryTab): string {
  return tab === 'booking' ? 'Jam Rencana CI' : 'Check-in';
}

export function guestHistoryOutHeading(tab: GuestHistoryTab): string {
  return tab === 'booking' ? 'Jam Rencana CO' : 'Check-out';
}

export function guestHistoryDate(tab: GuestHistoryTab, item: HistoryTimes): string | null {
  if (tab === 'booking') return item.scheduled_check_in;
  if (tab === 'transaksi') return item.created_at;
  return item.started_at;
}

export function guestHistoryInAt(tab: GuestHistoryTab, item: HistoryTimes): string | null {
  return tab === 'booking' ? item.scheduled_check_in : item.started_at;
}

export function guestHistoryOutAt(tab: GuestHistoryTab, item: HistoryTimes): string | null {
  return tab === 'booking' ? item.scheduled_check_out : item.checked_out_at;
}

export function guestHistoryEmptyText(tab: GuestHistoryTab): string {
  if (tab === 'booking') return 'Belum ada riwayat booking';
  if (tab === 'transaksi') return 'Belum ada riwayat transaksi';
  return 'Belum ada riwayat kunjungan';
}

export function guestHistoryLoadError(tab: GuestHistoryTab): string {
  if (tab === 'booking') return 'Riwayat booking belum dapat dimuat.';
  if (tab === 'transaksi') return 'Riwayat transaksi belum dapat dimuat.';
  return 'Riwayat kunjungan belum dapat dimuat.';
}
