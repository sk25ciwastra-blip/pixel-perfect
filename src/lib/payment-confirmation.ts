import type { Database } from '@/integrations/supabase/types';

type Tables = Database['public']['Tables'];
export type ConfirmationTransaction = Pick<Tables['transactions']['Row'],
  'id' | 'transaction_number' | 'status' | 'guest_id' | 'room_id' | 'package_id' |
  'price_snapshot' | 'base_price_snapshot' | 'extra_guest_charge' | 'extra_guest_count' |
  'extra_guest_unit_price' | 'guest_count' | 'scheduled_check_in' | 'scheduled_check_out' |
  'started_at' | 'ends_at' | 'checked_out_at' | 'updated_at'>;
export type ConfirmationPayment = Pick<Tables['payments']['Row'],
  'id' | 'transaction_id' | 'amount' | 'created_at' | 'kind' | 'method'>;
export type ConfirmationRefund = Pick<Tables['finance_refunds']['Row'],
  'id' | 'transaction_id' | 'amount' | 'created_at' | 'refund_method'>;
export type ConfirmationInput = {
  transaction: ConfirmationTransaction;
  guest: Pick<Tables['guests']['Row'], 'id' | 'full_name' | 'phone'>;
  room: Pick<Tables['rooms']['Row'], 'id' | 'room_number' | 'room_type_id'>;
  roomType: Pick<Tables['room_types']['Row'], 'id' | 'name'>;
  package: Pick<Tables['packages']['Row'], 'id' | 'name' | 'time_mode'>;
  payments: ConfirmationPayment[];
  refunds: ConfirmationRefund[];
  refundsComplete: boolean;
  canReadGuestPhone: boolean;
  business: { name: string; address: string; city: string; whatsapp: string };
  generatedAt: string;
};

export function confirmationMoney(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR',
    minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}
export function confirmationDate(value: string | null) {
  if (!value) return 'Not available';
  if (!Number.isFinite(Date.parse(value))) throw new Error('Tanggal dokumen tidak valid.');
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: '2-digit',
    month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(value)) + ' WIB';
}
function amount(value: number | null, label: string) {
  if (value === null || !Number.isFinite(value) || value < 0 ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.00001 || !Number.isSafeInteger(Math.round(value * 100))) {
    throw new Error(`${label} belum valid.`);
  }
  return Math.round(value * 100);
}
const packageCodes: Record<string, string> = {
  'Paket 2 Jam': 'P2', 'Paket 4 Jam': 'P4', 'Paket 6 Jam': 'P6', 'Paket 12 Jam': 'P12',
  'Paket 24 Jam': 'P24', 'Paket Pagi': 'PP', 'Paket Malam': 'PM', 'Paket Harian': 'PH', 'Paket Mingguan': 'PW',
};
export function buildPaymentConfirmation(input: ConfirmationInput) {
  const t = input.transaction;
  if (!input.refundsComplete) throw new Error('Histori refund lengkap belum dapat diverifikasi untuk akses ini.');
  if (!t.id || !t.transaction_number || input.guest.id !== t.guest_id || input.room.id !== t.room_id ||
    input.package.id !== t.package_id || input.roomType.id !== input.room.room_type_id) {
    throw new Error('Data transaksi belum lengkap atau tidak cocok.');
  }
  if (!input.guest.full_name || !input.business.name) throw new Error('Identitas dokumen belum tersedia.');
  for (const value of [input.generatedAt, t.scheduled_check_in, t.scheduled_check_out, t.started_at, t.ends_at, t.checked_out_at]) {
    confirmationDate(value);
  }
  if (t.status === 'check_out' && !t.checked_out_at) throw new Error('Waktu checkout aktual belum tersedia.');
  if (['check_in', 'check_out'].includes(t.status) && (!t.started_at || !t.ends_at)) {
    throw new Error('Waktu menginap aktual belum tersedia.');
  }
  const total = amount(t.price_snapshot, 'Total tagihan');
  const extra = amount(t.extra_guest_charge, 'Biaya extra guest');
  const base = t.base_price_snapshot === null ? total - extra : amount(t.base_price_snapshot, 'Harga kamar');
  if (base < 0 || base + extra !== total) throw new Error('Rincian harga tidak cocok dengan total tersimpan.');
  for (const count of [t.guest_count, t.extra_guest_count]) {
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Jumlah tamu belum valid.');
  }
  const unit = amount(t.extra_guest_unit_price, 'Tarif extra guest');
  if (unit * t.extra_guest_count !== extra) throw new Error('Rincian extra guest tidak konsisten.');
  const seen = new Set<string>();
  const entries = [
    ...input.payments.map(p => ({ ...p, type: 'payment' as const, method: p.method, label:
      p.kind === 'dp' ? 'Deposit (DP)' : p.kind === 'payment' ? 'Payment / Settlement' : '' })),
    ...input.refunds.map(r => ({ ...r, type: 'refund' as const, method: r.refund_method, label: 'Refund' })),
  ].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id.localeCompare(b.id) || a.type.localeCompare(b.type));
  let paid = 0;
  let refunded = 0;
  const history = entries.map(entry => {
    const key = `${entry.type}:${entry.id}`;
    if (!entry.id || seen.has(key) || entry.transaction_id !== t.id || !entry.label || !entry.method) {
      throw new Error('Histori pembayaran tidak lengkap, duplikat, atau jenis adjustment belum didukung.');
    }
    seen.add(key);
    const value = amount(entry.amount, 'Nominal pembayaran/refund');
    if (entry.type === 'refund') refunded += value; else paid += value;
    return { id: entry.id, type: entry.type, date: confirmationDate(entry.created_at),
      kind: entry.label, method: entry.method, amount: value / 100 };
  });
  if (!Number.isSafeInteger(paid) || !Number.isSafeInteger(refunded) || refunded > paid) {
    throw new Error('Total pembayaran/refund tidak konsisten.');
  }
  const net = paid - refunded;
  // Display the stricter stored booking boundary without changing operational records.
  const durationBooking = ['duration', 'duration_midnight_cap'].includes(input.package.time_mode ?? '') && !!t.scheduled_check_out;
  const deadline = t.ends_at && durationBooking && Date.parse(t.ends_at) > Date.parse(t.scheduled_check_out!)
    ? t.scheduled_check_out : t.ends_at ?? t.scheduled_check_out;
  if (deadline && t.started_at && Date.parse(deadline) <= Date.parse(t.started_at)) {
    throw new Error('Batas checkout tidak valid; periksa transaksi.');
  }
  return {
    transactionId: t.id, transactionNumber: t.transaction_number, transactionStatus: t.status,
    generatedAt: confirmationDate(input.generatedAt), business: { ...input.business },
    guest: { name: input.guest.full_name, phone: input.canReadGuestPhone ? input.guest.phone : null },
    room: { number: input.room.room_number, type: input.roomType.name },
    package: { code: packageCodes[input.package.name] ?? '', name: input.package.name },
    guests: { total: t.guest_count, extra: t.extra_guest_count, unitPrice: unit / 100 },
    times: { scheduledCheckIn: confirmationDate(t.scheduled_check_in), scheduledCheckOut: confirmationDate(t.scheduled_check_out),
      actualCheckIn: confirmationDate(t.started_at), checkoutDeadline: confirmationDate(deadline),
      actualCheckOut: confirmationDate(t.checked_out_at) },
    totals: { room: base / 100, extraGuest: extra / 100, bill: total / 100, grossPaid: paid / 100,
      refunded: refunded / 100, netPaid: net / 100, remaining: Math.max(total - net, 0) / 100,
      credit: Math.max(net - total, 0) / 100, status: net >= total ? 'PAID' : net > 0 ? 'PARTIALLY PAID' : 'UNPAID' },
    history,
  };
}
export type PaymentConfirmation = ReturnType<typeof buildPaymentConfirmation>;
