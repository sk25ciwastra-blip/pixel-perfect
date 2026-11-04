import { rpc } from "@/lib/data-live";
import { openWhatsApp } from '@/lib/whatsapp';
import { DetailTransaksi } from '@/components/detail-transaksi';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Search, CalendarDays, ArrowUpDown, User, Phone, Clock, Circle, ChevronRight } from 'lucide-react';
import { Kerangka } from '@/components/kerangka';
import { FormulirPemesanan } from '@/components/formulir-pemesanan';
import { Button } from '@/components/ui/button';
import { LencanaTeks } from '@/components/status-kamar';
import { useTable } from '@/lib/data-live';
import { rupiah } from '@/lib/data-contoh';
import { supabase } from '@/integrations/supabase/client';
import { meta } from '@/lib/meta';
import { usePeran } from '@/lib/peran';
import { useSesiKasKonteks } from '@/lib/sesi-kas';
import {
  recordTransactionPaymentCombined,
  recordTrainingTransactionPaymentCombined,
  shouldUseCombinedPayment,
  type CombinedPaymentComponent,
} from '@/lib/combined-payments';
import { featureFlags } from '@/lib/feature-flags';

export const Route = createFileRoute('/booking')({
  head: () =>
    meta(
      'Pemesanan',
      'Daftar pemesanan kamar Baturaden 25 Homestay.',
    ),
  validateSearch: (s: Record<string, unknown>): { bagian?: 'semua' | 'hari-ini' | 'besok' | 'mendatang' | undefined } => ({
    bagian: ['semua', 'hari-ini', 'besok', 'mendatang'].includes(String(s['bagian'])) ? (s['bagian'] as 'semua') : undefined,
  }),
  component: Halaman,
});

function kunciWib(offsetHari: number) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(Date.now() + offsetHari * 86400000));
}

type MetodePembayaran = 'Cash' | 'QRIS' | 'Transfer';

function kodePaket(name: string | undefined) {
  const kode: Record<string, string> = {
    'Paket 2 Jam': 'P2',
    'Paket 4 Jam': 'P4',
    'Paket 6 Jam': 'P6',
    'Paket 12 Jam': 'P12',
    'Paket 24 Jam': 'P24',
    'Paket Pagi': 'PP',
    'Paket Malam': 'PM',
    'Paket Harian': 'PH',
    'Paket Mingguan': 'PW',
  };

  return name ? (kode[name] ?? name) : '—';
}

type BookingArrival = 'upcoming' | 'waiting' | 'late' | 'action' | 'verify';

function bookingArrival(
  booking: { scheduled_check_in: string | null; scheduled_check_out: string | null },
  now: number,
): { kind: BookingArrival; label: string } {
  const start = booking.scheduled_check_in ? Date.parse(booking.scheduled_check_in) : NaN;
  const end = booking.scheduled_check_out ? Date.parse(booking.scheduled_check_out) : NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return { kind: 'verify', label: 'PERLU VERIFIKASI' };
  }
  if (now >= end) return { kind: 'action', label: 'PERLU TINDAKAN' };
  if (now < start) return { kind: 'upcoming', label: 'AKAN DATANG' };
  const minutesLate = Math.floor((now - start) / 60000);
  if (minutesLate < 1) return { kind: 'waiting', label: 'MENUNGGU CHECK-IN' };
  return { kind: 'late', label: `TERLAMBAT ${minutesLate} MENIT` };
}

function Halaman() {
  const { bagian = 'semua' } = Route.useSearch();
  const cocokJadwal = (t: { scheduled_check_in: string | null }) => {
    if (bagian === 'semua') return true;
    if (!t.scheduled_check_in) return false;
    const k = kunciWib(0);
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t.scheduled_check_in));
    if (bagian === 'hari-ini') return d === k;
    if (bagian === 'besok') return d === kunciWib(1);
    return d >= kunciWib(2);
  };
  const [sekarang, setSekarang] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setSekarang(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);
  const [cari, setCari] = useState('');
  const [tanggalPilih, setTanggalPilih] = useState('');
  const [urut, setUrut] = useState<'dekat' | 'jauh'>('dekat');
  const { posisiKode } = usePeran();
  const readOnly = posisiKode === 'inspector';

  const [open, setOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState('');
const [detailBookingId, setDetailBookingId] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<MetodePembayaran[]>(['QRIS']);
  const [paymentAmounts, setPaymentAmounts] = useState<Partial<Record<MetodePembayaran, string>>>({ QRIS: '' });
  const [paymentIdempotencyKeys, setPaymentIdempotencyKeys] = useState<Partial<Record<MetodePembayaran, string>>>({ QRIS: crypto.randomUUID() });
  const [paymentRequestKey, setPaymentRequestKey] = useState(() => crypto.randomUUID());
  const [paymentRequestFingerprint, setPaymentRequestFingerprint] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const transactions = useTable('transactions');
const payments = useTable('payments');
const guests = useTable('guests');
const rooms = useTable('rooms');
const roomTypes = useTable('room_types');
const packages = useTable('packages');
const {
  sessionId: paymentSessionId,
  activeSession: activePaymentSession,
  needsAssistedContext,
  isTraining,
  loading: paymentSessionLoading,
  error: paymentSessionError,
} = useSesiKasKonteks();

  const selectedBooking = transactions.rows.find(
    (item) => item.id === selectedBookingId,
  );

  const selectedPaid = useMemo(() => {
    if (!selectedBookingId) return 0;

    return payments.rows
      .filter((payment) => payment.transaction_id === selectedBookingId)
      .reduce((total, payment) => total + Number(payment.amount), 0);
  }, [payments.rows, selectedBookingId]);

  const selectedTotal = Number(selectedBooking?.price_snapshot ?? 0);
  const selectedRemaining = Math.max(selectedTotal - selectedPaid, 0);

  function totalPaid(transactionId: string) {
    return payments.rows
      .filter((payment) => payment.transaction_id === transactionId)
      .reduce((total, payment) => total + Number(payment.amount), 0);
  }

  function openCheckIn(transactionId: string) {
    const transaction = transactions.rows.find(
      (item) => item.id === transactionId,
    );
    // Protect against a stale list/timer: expired or incomplete bookings must
    // not start a payment flow that the existing backend will reject.
    if (!transaction || transaction.status !== 'booking') return;
    const arrival = bookingArrival(transaction, Date.now());
    if (arrival.kind === 'action' || arrival.kind === 'verify') return;

    const paid = totalPaid(transactionId);
    const total = Number(transaction?.price_snapshot ?? 0);
    const remaining = Math.max(total - paid, 0);

    setSelectedBookingId(transactionId);
    setPaymentMethods(['QRIS']);
    setPaymentAmounts({ QRIS: remaining > 0 ? String(remaining) : '' });
    setPaymentIdempotencyKeys({ QRIS: crypto.randomUUID() });
    setPaymentRequestKey(crypto.randomUUID());
    setPaymentRequestFingerprint('');
    setMessage('');
  }

  function closeCheckIn() {
    if (busy) return;

    setSelectedBookingId('');
    setPaymentAmounts({ QRIS: '' });
    setPaymentMethods(['QRIS']);
    setPaymentRequestFingerprint('');
    setMessage('');
  }

async function recordPayment() {
  if (!selectedBooking || selectedRemaining <= 0) return;
  const arrival = bookingArrival(selectedBooking, Date.now());
  if (arrival.kind === 'action' || arrival.kind === 'verify') {
    setMessage('Jadwal Booking kedaluwarsa atau belum lengkap. Periksa detail sebelum menerima pembayaran.');
    return;
  }

  setMessage('');
  setBusy(true);

  try {
    if (paymentMethods.length > 1 && !featureFlags.combinedPayment) {
      setMessage('Pembayaran gabungan belum diaktifkan. Pilih satu metode pembayaran sampai backend siap.');
      return;
    }
    const amounts = paymentMethods.map((method) => Number(paymentAmounts[method] ?? 0));
    const amount = amounts.reduce((sum, value) => sum + value, 0);
    if (amounts.some((value) => !Number.isFinite(value) || value <= 0) || amount > selectedRemaining) {
      setMessage('Setiap nominal harus positif dan total tidak boleh melebihi sisa tagihan.');
      return;
    }

    if (paymentSessionLoading || paymentSessionError) {
      setMessage(paymentSessionError || 'Sesi kas masih dimuat. Coba lagi sebentar.');
      return;
    }

    if (!paymentSessionId || needsAssistedContext) {
      setMessage(needsAssistedContext
        ? 'Pilih sesi bantuan aktif di halaman Keuangan sebelum mencatat pembayaran.'
        : 'Buka sesi kas aktif sebelum mencatat pembayaran.');
      return;
    }

    const requestFingerprint = JSON.stringify({
      transactionId: selectedBooking.id,
      payments: paymentMethods.map((method) => ({ method, amount: Number(paymentAmounts[method]) || 0 })),
      sessionId: paymentSessionId,
    });
    const requestKey = paymentRequestFingerprint && paymentRequestFingerprint !== requestFingerprint
      ? crypto.randomUUID()
      : paymentRequestKey;
    const componentKeys = { ...paymentIdempotencyKeys };
    if (paymentRequestFingerprint && paymentRequestFingerprint !== requestFingerprint) {
      paymentMethods.forEach((method) => { componentKeys[method] = crypto.randomUUID(); });
    }
    setPaymentRequestKey(requestKey);
    setPaymentRequestFingerprint(requestFingerprint);
    setPaymentIdempotencyKeys(componentKeys);

    const combinedArgs = {
      _transaction_id: selectedBooking.id,
      _payments: paymentMethods.map((method) => ({
        method,
        amount: Number(paymentAmounts[method]),
        idempotency_key: componentKeys[method],
      })) as CombinedPaymentComponent[],
      _request_idempotency_key: requestKey,
      _request_fingerprint: requestFingerprint,
      _session_id: paymentSessionId,
    };
    const primaryMethod = paymentMethods[0] ?? 'QRIS';
    const combined = shouldUseCombinedPayment(paymentMethods.length, featureFlags.combinedPayment);
    const { error: paymentError } = combined
      ? await (isTraining ? recordTrainingTransactionPaymentCombined(combinedArgs) : recordTransactionPaymentCombined(combinedArgs))
      : await rpc(
          isTraining ? 'record_training_transaction_payment' : 'record_transaction_payment',
          {
            _transaction_id: selectedBooking.id,
            _amount: amount,
            _method: primaryMethod,
            _idempotency_key: componentKeys[primaryMethod] ?? crypto.randomUUID(),
            _session_id: paymentSessionId,
          },
        );

    if (paymentError) {
      setMessage(paymentError.message);
      return;
    }

    const remaining = selectedRemaining - amount;
    setPaymentIdempotencyKeys({ QRIS: crypto.randomUUID() });
    setPaymentRequestKey(crypto.randomUUID());
    setPaymentRequestFingerprint('');
    await payments.refresh();
    setPaymentMethods(['QRIS']);
    setPaymentAmounts({ QRIS: remaining > 0 ? String(remaining) : '' });
    setMessage(
      remaining > 0
        ? 'Pembayaran tercatat. Masih ada sisa ' + rupiah(remaining) + '.'
        : 'Pembayaran tercatat. Transaksi sudah lunas.',
    );
  } finally {
    setBusy(false);
  }
}
async function finishCheckIn() {
  if (!selectedBooking) return;
  const arrival = bookingArrival(selectedBooking, Date.now());
  if (arrival.kind === 'action' || arrival.kind === 'verify') {
    setMessage('Jadwal Booking kedaluwarsa atau belum lengkap. Check-in tidak dapat dilanjutkan.');
    return;
  }

  setMessage('');

  if (selectedRemaining > 0) {
    setMessage(
      `Check-in belum dapat dilakukan. Masih ada sisa pembayaran ${rupiah(selectedRemaining)}.`,
    );
    return;
  }

  setBusy(true);

  try {
    const { error: checkInError } = await rpc(
      isTraining ? 'check_in_training_booking' : 'check_in_booking',
      isTraining
        ? { _transaction_id: selectedBooking.id, _session_id: paymentSessionId }
        : { _transaction_id: selectedBooking.id },
    );

    if (checkInError) {
      setMessage(checkInError.message);
      return;
    }

    await Promise.all([
      transactions.refresh(),
      payments.refresh(),
      rooms.refresh(),
    ]);

    setSelectedBookingId('');
    setPaymentAmounts({ QRIS: '' });
    setMessage('');
  } finally {
    setBusy(false);
  }
}
function tanggalWib(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function judulTanggal(value: string) {
  const tanggal = new Date(value);

  const tanggalBooking = tanggalWib(value);
  const hariIni = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const besokDate = new Date();
  besokDate.setDate(besokDate.getDate() + 1);

  const besok = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(besokDate);

  const lengkap = tanggal.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  if (tanggalBooking === hariIni) {
    return `Hari ini · ${lengkap}`;
  }

  if (tanggalBooking === besok) {
    return `Besok · ${lengkap}`;
  }

  return lengkap;
}
  function baris(isi: typeof transactions.rows) {
  const sorted = [...isi].sort((a, b) => {
    const waktuA = new Date(
      a.scheduled_check_in ?? a.created_at,
    ).getTime();

    const waktuB = new Date(
      b.scheduled_check_in ?? b.created_at,
    ).getTime();

    if (waktuA !== waktuB) {
      return urut === 'dekat' ? waktuA - waktuB : waktuB - waktuA;
    }

    return a.transaction_number.localeCompare(b.transaction_number);
  });

  const groups = sorted.reduce<
    Array<{
      dateKey: string;
      dateValue: string;
      bookings: typeof transactions.rows;
    }>
  >((hasil, booking) => {
    const dateValue =
      booking.scheduled_check_in ?? booking.created_at;

    const dateKey = tanggalWib(dateValue);
    const group = hasil.find((item) => item.dateKey === dateKey);

    if (group) {
      group.bookings.push(booking);
    } else {
      hasil.push({
        dateKey,
        dateValue,
        bookings: [booking],
      });
    }

    return hasil;
  }, []);

  if (groups.length === 0) {
    return <p className="rounded-xl border border-gold/15 px-4 py-6 text-center text-sm text-muted-foreground">Tidak ada data.</p>;
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.dateKey}>
          <p className="mb-2 flex items-center gap-2 text-sm font-bold capitalize">
            <CalendarDays className="size-3.5 text-foreground/80" />
            {judulTanggal(group.dateValue)} · {group.bookings.length}{' '}
            {group.bookings.length === 1 ? 'Room' : 'Rooms'}
          </p>

          <ul className="divide-y divide-gold/25 overflow-hidden rounded-xl border border-gold/30 bg-[#F7F6F3] text-foreground shadow-[0_10px_30px_-18px_var(--gold)] [--foreground:oklch(0.22_0.02_75)] [--muted-foreground:oklch(0.4_0.02_75)] [--primary:oklch(0.55_0.11_70)] [--gold:oklch(0.6_0.1_78)] [--gold-light:oklch(0.5_0.1_78)]">
            {group.bookings.map((booking) => {
              const guest = guests.rows.find((item) => item.id === booking.guest_id);
              const room = rooms.rows.find((item) => item.id === booking.room_id);
              const roomType = roomTypes.rows.find((item) => item.id === room?.room_type_id);
              const packageItem = packages.rows.find((item) => item.id === booking.package_id);
              const phoneLast4 = guest?.phone ? guest.phone.replace(/\D/g, '').slice(-4) : '';
              const tgl = (v?: string | null) => v ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(v)) : '—';
              const jam = (v?: string | null) => v ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(v)).replace('.', ':') : '—';
              const arrival = bookingArrival(booking, sekarang);
              const statusLabel = booking.status === 'booking' ? arrival.label : booking.status === 'check_in' ? 'CHECK-IN' : booking.status === 'check_out' ? 'SELESAI' : 'DIBATALKAN';
              const statusKelas = booking.status === 'booking'
                ? arrival.kind === 'upcoming'
                  ? 'bg-[oklch(0.86_0.06_240)] text-[oklch(0.35_0.1_250)]'
                  : arrival.kind === 'waiting'
                    ? 'bg-[oklch(0.86_0.1_150)] text-[oklch(0.33_0.1_150)]'
                    : 'bg-[oklch(0.9_0.08_40)] text-[oklch(0.42_0.13_35)]'
                : booking.status === 'check_out' || booking.status === 'check_in'
                  ? 'bg-[oklch(0.85_0.1_150)] text-[oklch(0.33_0.1_150)]'
                  : 'bg-[oklch(0.86_0.07_25)] text-[oklch(0.4_0.13_25)]';

              const hubungi = () => {
                if (!guest?.phone) return;
                const formatJadwal = (value: string | null) => {
                  if (!value) return '—';
                  return new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
                    .format(new Date(value)).replace(' pukul ', ', ');
                };
                const pesan = `Halo Kak ${guest.full_name}, kami dari Baturaden 25 Homestay.
Kami mengingatkan reservasi Anda:
Room: ${(roomType?.name ?? '—').toUpperCase()} · ${room?.room_number ?? '—'}
Paket: ${kodePaket(packageItem?.name)}
Check-in: ${formatJadwal(booking.scheduled_check_in)}
Check-out: ${formatJadwal(booking.scheduled_check_out)}
No. Transaksi: ${booking.transaction_number}
Terima kasih.`;
                openWhatsApp(guest.phone, pesan);
              };

              const tombolOutline = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-foreground/20 bg-white px-3 text-xs font-semibold text-foreground shadow-sm transition hover:border-gold';
              const tombolEmas = 'inline-flex h-8 items-center gap-1 rounded-lg bg-gradient-to-b from-[oklch(0.72_0.11_75)] to-[oklch(0.58_0.11_70)] px-3 text-xs font-semibold text-[oklch(0.98_0.01_80)] shadow transition hover:brightness-105';

              return (
                <li key={booking.id} className="grid grid-cols-1 items-center gap-3 px-3 py-2.5 lg:grid-cols-[minmax(0,1fr)_140px_140px_130px_320px] lg:gap-0">
                  <div className="flex min-w-0 items-center gap-3 lg:pr-3">
                    <div className="flex h-12 w-[72px] shrink-0 flex-col items-center justify-center rounded-lg border border-[oklch(0.5_0.09_75)] bg-[oklch(0.17_0.012_60)] text-center shadow-[0_8px_18px_-12px_var(--gold)]">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-[oklch(0.78_0.1_80)]">{roomType?.name ?? 'ROOM'}</p>
                      <p className="font-serif text-lg font-semibold leading-tight text-[oklch(0.98_0.01_80)]">{room?.room_number ?? '-'}</p>
                    </div>
                    <div className="flex min-w-0 flex-col justify-center gap-0.5">
                      <p className="truncate text-sm font-bold">{guest?.full_name ?? 'Tamu'}{phoneLast4 ? ` - ${phoneLast4}` : ''}</p>
                      <button type="button" onClick={() => setDetailBookingId(booking.id)} className="block max-w-full truncate text-left text-xs font-medium text-primary hover:underline">
                        {booking.transaction_number}
                      </button>
                    </div>
                  </div>

                  {[['Check-in', booking.scheduled_check_in], ['Check-out', booking.scheduled_check_out]].map(([label, v]) => (
                    <div key={label} className="flex flex-col justify-center gap-1 border-gold/30 lg:border-l lg:px-4">
                      <p className="flex h-4 items-center text-[10px] leading-none text-muted-foreground">{label}</p>
                      <p className="flex h-[18px] items-center gap-1.5 text-xs font-semibold"><CalendarDays className="size-3.5 shrink-0" />{tgl(v)}</p>
                      <p className="flex h-[18px] items-center gap-1.5 text-xs font-semibold"><Clock className="size-3.5 shrink-0" />{jam(v)}</p>
                    </div>
                  ))}

                  <div className="flex flex-col justify-center gap-1 border-gold/30 lg:border-l lg:px-4">
                    <span aria-hidden className="hidden h-4 lg:block" />
                    <span className={`flex h-[18px] w-fit items-center rounded-full px-2.5 text-[10px] font-semibold uppercase ${statusKelas}`}>{statusLabel}</span>
                    <p className="flex h-[18px] items-center gap-1.5 text-xs"><User className="size-3" />{kodePaket(packageItem?.name)}{packageItem?.duration_minutes ? ` · ${Math.round(packageItem.duration_minutes / 60)} Jam` : ''}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5 border-gold/30 lg:border-l lg:pl-3">
                    {booking.status === 'booking' && !readOnly && (
                      <>
                        <button type="button" className={tombolOutline} onClick={hubungi}><Phone className="size-3.5" />Hubungi</button>
                        {arrival.kind !== 'action' && arrival.kind !== 'verify' && (
                          <button type="button" className={tombolOutline} onClick={() => openCheckIn(booking.id)}><Circle className="size-3.5" />Check-in</button>
                        )}
                      </>
                    )}
                    <button type="button" className={tombolEmas} onClick={() => setDetailBookingId(booking.id)}><ChevronRight className="size-3.5" />Lihat Detail</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

  const cocokFilter = (t: (typeof transactions.rows)[number]) => {
    if (tanggalPilih && tanggalWib(t.scheduled_check_in ?? t.created_at) !== tanggalPilih) return false;
    const q = cari.trim().toLowerCase();
    if (!q) return true;
    const g = guests.rows.find((x) => x.id === t.guest_id);
    const r = rooms.rows.find((x) => x.id === t.room_id);
    return [t.transaction_number, g?.full_name, g?.phone, r?.room_number].some((v) => String(v ?? '').toLowerCase().includes(q));
  };
  const bookingTerfilter = transactions.rows.filter((b) => b.status === 'booking' && cocokJadwal(b) && cocokFilter(b));
  const akanDatang = bookingTerfilter.filter((b) => {
    const kind = bookingArrival(b, sekarang).kind;
    return kind === 'upcoming' || kind === 'waiting';
  });
  const perluTindakan = bookingTerfilter.filter((b) => {
    const kind = bookingArrival(b, sekarang).kind;
    return kind === 'late' || kind === 'action' || kind === 'verify';
  });
  const riwayat = transactions.rows.filter((b) => b.status !== 'booking' && cocokJadwal(b) && cocokFilter(b));

  return (
  <>
    {detailBookingId && (
      <DetailTransaksi
        transactionId={detailBookingId}
        onClose={() => setDetailBookingId('')}
      />
    )}

    <Kerangka
      judul="Booking"
      keterangan="Daftar pemesanan kamar"
      aksi={
        !readOnly && (
          <Button
            className="h-11 rounded-xl"
            onClick={() => setOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Booking
          </Button>
        )
      }
    >
      {transactions.error && (
        <p role="alert">{transactions.error}</p>
      )}

      {payments.error && (
        <p role="alert">{payments.error}</p>
      )}

      <div className="mb-4 grid gap-2.5 md:grid-cols-[minmax(0,1fr)_200px_220px]">
        <label className="flex h-10 items-center gap-2.5 rounded-lg border border-gold/25 bg-navy-deep/60 px-3">
          <Search className="size-3.5 shrink-0 text-gold" />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nomor transaksi, nama tamu, atau nomor kamar..."
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <label className="flex h-10 items-center gap-2.5 rounded-lg border border-gold/25 bg-navy-deep/60 px-3">
          <CalendarDays className="size-3.5 shrink-0 text-gold" />
          <input
            type="date"
            aria-label="Pilih Tanggal"
            value={tanggalPilih}
            onChange={(e) => setTanggalPilih(e.target.value)}
            className="h-full w-full bg-transparent text-sm outline-none [color-scheme:dark]"
          />
        </label>
        <label className="flex h-10 items-center gap-2.5 rounded-lg border border-gold/25 bg-navy-deep/60 px-3">
          <ArrowUpDown className="size-3.5 shrink-0 text-gold" />
          <select
            aria-label="Urutkan"
            value={urut}
            onChange={(e) => setUrut(e.target.value as 'dekat' | 'jauh')}
            className="h-full w-full bg-transparent text-sm outline-none [&>option]:bg-navy-deep"
          >
            <option value="dekat">Urutkan: Tanggal (Terdekat)</option>
            <option value="jauh">Urutkan: Tanggal (Terjauh)</option>
          </select>
        </label>
      </div>

      <JudulJumlah label="Akan Datang / Menunggu Check-in" jumlah={akanDatang.length} />
      {baris(akanDatang)}

      <div className="mt-8">
        <JudulJumlah label="Perlu Tindakan" jumlah={perluTindakan.length} />
      </div>
      {baris(perluTindakan)}

      <div className="mt-8">
        <JudulJumlah label="Riwayat" jumlah={riwayat.length} />
      </div>
      {baris(riwayat)}


      {open && !readOnly && (
        <FormulirPemesanan
          mode="booking"
          onClose={() => setOpen(false)}
          onSaved={async () => { await Promise.all([transactions.refresh(), guests.refresh()]); }}
        />
      )}

      {selectedBooking && !readOnly && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/75 backdrop-blur-sm p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pelunasan dan Check-in"
            className="w-full max-w-md rounded-2xl bg-background p-5 shadow-lembut"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
  <h2 className="text-lg font-bold">
    {selectedRemaining > 0
      ? 'Pembayaran'
      : 'Pembayaran Berhasil'}
  </h2>
  <p className="text-sm text-muted-foreground">
    {selectedBooking.transaction_number}
  </p>
</div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Tutup"
                disabled={busy}
                onClick={closeCheckIn}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <dl className="divide-y divide-border rounded-2xl border border-border bg-card text-sm">
              <div className="flex justify-between px-4 py-3">
                <dt className="text-muted-foreground">Total tagihan</dt>
                <dd className="font-semibold">
                  {rupiah(selectedTotal)}
                </dd>
              </div>

              <div className="flex justify-between px-4 py-3">
                <dt className="text-muted-foreground">
                  Sudah dibayar
                </dt>
                <dd className="font-semibold">
                  {rupiah(selectedPaid)}
                </dd>
              </div>

              <div className="flex justify-between px-4 py-3">
                <dt className="text-muted-foreground">Sisa</dt>
                <dd className="font-semibold text-primary">
                  {rupiah(selectedRemaining)}
                </dd>
              </div>
            </dl>

            <p className="mt-5 rounded-xl bg-secondary px-3 py-2 text-sm">
              {activePaymentSession
                ? 'Sesi kas aktif terhubung otomatis ke pembayaran.'
                : needsAssistedContext
                  ? 'Sesi bantuan belum ditentukan. Buka halaman Keuangan untuk memilih konteks sesi aktif.'
                  : 'Belum ada sesi kas aktif. Buka sesi sebelum mencatat pembayaran.'}
            </p>

            {selectedRemaining > 0 ? (
              <div className="mt-5 space-y-4">
                {paymentMethods.map((method) => (
                  <label key={method} className="block text-sm">
                    Nominal {method}
                    <input
                      type="number"
                      min="1"
                      max={selectedRemaining}
                      step="1"
                      value={paymentAmounts[method] ?? ''}
                      onChange={(event) =>
                        setPaymentAmounts((current) => ({ ...current, [method]: event.target.value }))
                      }
                      className="mt-1 h-12 w-full rounded-xl border border-input bg-background px-4"
                    />
                  </label>
                ))}

                <div>
                  <p className="mb-2 text-sm">Metode pembayaran (maks. 2)</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Cash', 'QRIS', 'Transfer'] as const).map((method) => (
                      <Button
                        key={method}
                        type="button"
                        variant={paymentMethods.includes(method) ? 'default' : 'outline'}
                        disabled={!paymentMethods.includes(method) && paymentMethods.length >= 2}
                        onClick={() => {
                          if (paymentMethods.includes(method)) {
                            if (paymentMethods.length === 1) return;
                            setPaymentMethods((current) => current.filter((item) => item !== method));
                            setPaymentAmounts((current) => {
                              const next = { ...current };
                              delete next[method];
                              return next;
                            });
                          } else {
                            if (paymentMethods.length >= 1 && !featureFlags.combinedPayment) {
                              setMessage('Pembayaran gabungan belum diaktifkan. Pilih satu metode pembayaran sampai backend siap.');
                              return;
                            }
                            setPaymentMethods((current) => [...current, method]);
                            setPaymentAmounts((current) => ({ ...current, [method]: '' }));
                            setPaymentIdempotencyKeys((current) => ({ ...current, [method]: crypto.randomUUID() }));
                          }
                        }}
                      >
                        {method}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
  <div className="mt-5 rounded-2xl border border-border bg-primary-soft px-5 py-6 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
      ✓
    </div>

    <h3 className="mt-4 text-lg font-bold">
      Pembayaran sudah lunas!
    </h3>

    <p className="mt-1 text-sm text-muted-foreground">
      Pembayaran telah berhasil dicatat.
    </p>

    <p className="mt-3 text-sm font-semibold">
      Booking siap untuk proses Check-in.
    </p>
  </div>
)}

            {message && (
  <p
    role="alert"
    className="mt-4 text-sm text-destructive"
  >
    {message}
  </p>
)}

            <div className="mt-6">
  {selectedRemaining > 0 ? (
    <div className="flex gap-3">
      <Button
        type="button"
        variant="outline"
        className="h-12 flex-1 rounded-xl"
        disabled={busy}
        onClick={closeCheckIn}
      >
        Batal
      </Button>

      <Button
        type="button"
        className="h-12 flex-[2] rounded-xl"
        disabled={busy}
        onClick={() => void recordPayment()}
      >
        {busy ? 'Memproses…' : 'Bayar'}
      </Button>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-3">
      <Button
        type="button"
        className="h-14 w-full max-w-xs rounded-xl text-base font-bold"
        disabled={busy}
        onClick={() => void finishCheckIn()}
      >
        {busy ? 'Memproses…' : 'Check-in'}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="h-10 px-8"
        disabled={busy}
        onClick={closeCheckIn}
      >
        Batal
      </Button>
    </div>
  )}
</div>
          </div>
        </div>
      )}
      </Kerangka>
  </>
);
}

function JudulJumlah({ label, jumlah }: { label: string; jumlah: number }) {
  return (
    <div className="mb-2.5 flex items-center gap-2.5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{label}</h2>
      <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1.5 text-[11px] font-bold text-navy-deep">{jumlah}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-gold/40 to-transparent" aria-hidden="true" />
    </div>
  );
}
