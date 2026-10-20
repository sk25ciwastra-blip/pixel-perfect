import { rpc } from "@/lib/data-live";
import { openWhatsApp } from '@/lib/whatsapp';
import { DetailTransaksi } from '@/components/detail-transaksi';
import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Kerangka, Judul, Daftar } from '@/components/kerangka';
import { FormulirPemesanan } from '@/components/formulir-pemesanan';
import { Button } from '@/components/ui/button';
import { LencanaTeks } from '@/components/status-kamar';
import { useTable } from '@/lib/data-live';
import { rupiah } from '@/lib/data-contoh';
import { supabase } from '@/integrations/supabase/client';
import { meta } from '@/lib/meta';
import { usePeran } from '@/lib/peran';
import { useSesiKasKonteks } from '@/lib/sesi-kas';

export const Route = createFileRoute('/booking')({
  head: () =>
    meta(
      'Pemesanan',
      'Daftar pemesanan kamar Baturaden 25 Homestay.',
    ),
  component: Halaman,
});

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

function Halaman() {
  const { posisiKode } = usePeran();
  const readOnly = posisiKode === 'inspector';

  const [open, setOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState('');
const [detailBookingId, setDetailBookingId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<MetodePembayaran>('QRIS');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const transactions = useTable('transactions');
const payments = useTable('payments');
const guests = useTable('guests');
const rooms = useTable('rooms');
const roomTypes = useTable('room_types');
const packages = useTable('packages');
const [paymentIdempotencyKey, setPaymentIdempotencyKey] = useState(() => crypto.randomUUID());
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

    const paid = totalPaid(transactionId);
    const total = Number(transaction?.price_snapshot ?? 0);
    const remaining = Math.max(total - paid, 0);

    setSelectedBookingId(transactionId);
    setPaymentAmount(remaining > 0 ? String(remaining) : '');
    setPaymentMethod('QRIS');
    setPaymentIdempotencyKey(crypto.randomUUID());
    setMessage('');
  }

  function closeCheckIn() {
    if (busy) return;

    setSelectedBookingId('');
    setPaymentAmount('');
    setMessage('');
  }

async function recordPayment() {
  if (!selectedBooking || selectedRemaining <= 0) return;

  setMessage('');
  setBusy(true);

  try {
    const amount = Number(paymentAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      amount > selectedRemaining
    ) {
      setMessage(
        `Nominal pembayaran harus antara Rp 1 dan ${rupiah(selectedRemaining)}.`,
      );
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

    const { error: paymentError } = await rpc(
      isTraining ? 'record_training_transaction_payment' : 'record_transaction_payment',
      {
        _transaction_id: selectedBooking.id,
        _amount: amount,
        _method: paymentMethod,
        _idempotency_key: paymentIdempotencyKey,
        _session_id: paymentSessionId,
      },
    );

    if (paymentError) {
      setMessage(paymentError.message);
      return;
    }

    // A successful payment ends this idempotent operation; the next payment
    // must use a fresh key while uncertain retries keep the current key.
    setPaymentIdempotencyKey(crypto.randomUUID());
    const remaining = selectedRemaining - amount;

    await payments.refresh();

    setPaymentAmount(remaining > 0 ? String(remaining) : '');

    setMessage(
      remaining > 0
        ? `Pembayaran tercatat. Masih ada sisa ${rupiah(remaining)}.`
        : 'Pembayaran tercatat. Transaksi sudah lunas.',
    );
  } finally {
    setBusy(false);
  }
}

async function finishCheckIn() {
  if (!selectedBooking) return;

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
    setPaymentAmount('');
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
      return waktuA - waktuB;
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

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.dateKey}>
          <p className="mb-2 text-sm font-bold capitalize">
  {judulTanggal(group.dateValue)} · {group.bookings.length}{' '}
{group.bookings.length === 1 ? 'Room' : 'Rooms'}
</p>

          <Daftar>
            {group.bookings.map((booking, index) => {
              const paid = totalPaid(booking.id);
              const total = Number(booking.price_snapshot ?? 0);
              const remaining = Math.max(total - paid, 0);

              const guest = guests.rows.find(
                (item) => item.id === booking.guest_id,
              );

              const room = rooms.rows.find(
                (item) => item.id === booking.room_id,
              );

              const roomType = roomTypes.rows.find(
                (item) => item.id === room?.room_type_id,
              );

              const phoneLast4 = guest?.phone
                ? guest.phone.replace(/\D/g, '').slice(-4)
                : '';

              return (
                <li key={booking.id} className="flex items-center gap-4 px-4 py-4">
                  <div className="flex w-24 shrink-0 self-center flex-col items-center justify-center rounded-xl bg-secondary px-2 py-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {roomType?.name ?? 'ROOM'}
                    </p>
                    <p className="mt-1 text-lg font-bold leading-none">
                      {room?.room_number ?? '-'}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {guest?.full_name ?? 'Tamu'}
                      {phoneLast4 ? ` · ${phoneLast4}` : ''}
                    </p>
                    <button
                      type="button"
                      className="mt-0.5 block max-w-full truncate text-left font-mono text-sm font-semibold text-primary hover:underline"
                      onClick={() => setDetailBookingId(booking.id)}
                    >
                      {booking.transaction_number}
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
  {booking.status === 'booking' && !readOnly && (
    <>
      <Button
  size="sm"
  variant="outline"
  onClick={() => {
    if (!guest?.phone) return;

    const packageItem = packages.rows.find(
      (item) => item.id === booking.package_id,
    );

    const formatJadwal = (value: string | null) => {
      if (!value) return '—';

      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
        .format(new Date(value))
        .replace(' pukul ', ', ');
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
  }}
>
  Hubungi
</Button>

      <Button
        size="sm"
        variant="outline"
        onClick={() => openCheckIn(booking.id)}
      >
        Check-in
      </Button>
    </>
  )}

  <LencanaTeks
    status={
      booking.status === 'booking'
        ? 'Booking'
        : booking.status === 'check_in'
          ? 'Check-in'
          : booking.status === 'check_out'
            ? 'Check-out'
            : 'Dibatalkan'
    }
  />
</div>
                </li>
              );
            })}
          </Daftar>
        </section>
      ))}
    </div>
  );
}

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
            Buat Booking Baru
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

      <Judul>Akan Datang</Judul>

      {baris(
        transactions.rows.filter(
          (booking) => booking.status === 'booking',
        ),
      )}

      <div className="mt-8">
        <Judul>Riwayat</Judul>
      </div>

      {baris(
        transactions.rows.filter(
          (booking) => booking.status !== 'booking',
        ),
      )}

      {open && !readOnly && (
        <FormulirPemesanan
          mode="booking"
          onClose={() => setOpen(false)}
          onSaved={transactions.refresh}
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
                <label className="block text-sm">
                  Nominal pembayaran
                  <input
                    type="number"
                    min="1"
                    max={selectedRemaining}
                    step="1"
                    value={paymentAmount}
                    onChange={(event) =>
                      setPaymentAmount(event.target.value)
                    }
                    className="mt-1 h-12 w-full rounded-xl border border-input bg-background px-4"
                  />
                </label>

                <div>
                  <p className="mb-2 text-sm">Metode pembayaran</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      ['Cash', 'QRIS', 'Transfer'] as const
                    ).map((method) => (
                      <Button
                        key={method}
                        type="button"
                        variant={
                          paymentMethod === method
                            ? 'default'
                            : 'outline'
                        }
                        onClick={() => setPaymentMethod(method)}
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
