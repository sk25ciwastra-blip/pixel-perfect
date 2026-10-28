import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReceiptHistoryButton, ReceiptPrintButton } from '@/components/receipt-actions';
import { useTable } from '@/lib/data-live';
import { rupiah } from '@/lib/data-contoh';

type DetailTransaksiProps = {
  transactionId: string;
  onClose: () => void;
  mode?: 'full' | 'housekeeping';
};
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
function waktuWib(value: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DetailTransaksi({
  transactionId,
  onClose,
  mode = 'full',
}: DetailTransaksiProps) {
  const transactions = useTable('transactions');
  const restricted = mode === 'housekeeping';
  const payments = useTable('payments', !restricted);
  const guests = useTable('guests', !restricted);
  const rooms = useTable('rooms');
  const roomTypes = useTable('room_types');
  const packages = useTable('packages');
  const employees = useTable('employees', !restricted);
  const housekeepingHistory = useTable('housekeeping_history', restricted);

  const transaction = transactions.rows.find(
    (item) => item.id === transactionId,
  );

  if (!transaction) {
    return null;
  }

  const guest = guests.rows.find(
    (item) => item.id === transaction.guest_id,
  );

  const room = rooms.rows.find(
    (item) => item.id === transaction.room_id,
  );

  if (restricted) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/75 backdrop-blur-sm p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Riwayat housekeeping"
          className="w-full max-w-lg rounded-2xl bg-background p-5 shadow-lembut"
        >
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Riwayat Housekeeping
              </p>
              <h2 className="mt-1 text-lg font-bold">
                {transaction.transaction_number}
              </h2>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Tutup"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Kamar: </span>
              <strong>{room?.room_number ?? '—'}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Status kamar: </span>
              <strong>{room?.status ?? '—'}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Check-out: </span>
              <strong>{waktuWib(transaction.checked_out_at)}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Catatan kamar: </span>
              <strong>{room?.notes || 'Tidak ada catatan.'}</strong>
            </p>

            <div className="border-t border-border pt-3">
              <p className="font-semibold">Riwayat pekerjaan</p>
              {housekeepingHistory.rows
                .filter(
                  (item) =>
                    item.room_id === transaction.room_id &&
                    (!item.transaction_id ||
                      item.transaction_id === transaction.id),
                )
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() -
                    new Date(a.created_at).getTime(),
                )
                .map((item) => (
                  <div key={item.id} className="mt-2 rounded-xl bg-secondary px-3 py-2 text-xs">
                    <p className="font-semibold">
                      {item.action === 'start_cleaning'
                        ? 'Mulai dibersihkan'
                        : item.action === 'finish_cleaning'
                          ? 'Selesai dibersihkan'
                          : 'Override menjadi siap'}
                    </p>
                    <p className="text-muted-foreground">
                      {item.performed_by_name} ·{' '}
                      {new Date(item.created_at).toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                      })}
                    </p>
                    {item.note && <p>{item.note}</p>}
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const roomType = roomTypes.rows.find(
    (item) => item.id === room?.room_type_id,
  );

  const packageItem = packages.rows.find(
    (item) => item.id === transaction.package_id,
  );

  const creator = employees.rows.find(
    (item) => item.user_id === transaction.created_by,
  );

  const transactionPayments = payments.rows
    .filter((item) => item.transaction_id === transaction.id)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime(),
    );

  const totalPaid = transactionPayments.reduce(
    (total, item) => total + Number(item.amount),
    0,
  );

  const total = Number(transaction.price_snapshot ?? 0);
  const remaining = Math.max(total - totalPaid, 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/75 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detail transaksi"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-background p-5 shadow-lembut"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Detail Transaksi
            </p>
            <h2 className="mt-1 text-lg font-bold">
              {transaction.transaction_number}
            </h2>
            <p className="text-sm font-semibold">
              {guest?.full_name ?? 'Tamu'}
              {guest?.phone
                ? ` · ${guest.phone.replace(/\D/g, '').slice(-4)}`
                : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase">
              {transaction.status === 'booking'
                ? 'Booking'
                : transaction.status === 'check_in'
                  ? 'In Room'
                  : transaction.status === 'check_out'
                    ? 'Selesai'
                    : 'Dibatalkan'}
            </span>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Tutup"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-5 text-sm">
          <section className="rounded-2xl border border-border p-4">
            <h3 className="mb-3 font-bold">Reservasi</h3>

            <div className="space-y-2">
              <p>
                <span className="text-muted-foreground">Room: </span>
                <strong>
                  {(roomType?.name ?? 'Room').toUpperCase()} ·{' '}
                  {room?.room_number ?? '-'}
                </strong>
              </p>

              <p>
                <span className="text-muted-foreground">Paket: </span>
                <strong>{kodePaket(packageItem?.name)}</strong>
              </p>

              <p>
                <span className="text-muted-foreground">Jenis hari: </span>
                <strong>
                  {transaction.day_mode?.toUpperCase() ?? '—'}
                </strong>
              </p>

              <p>
                <span className="text-muted-foreground">
                  Jadwal Check-in:{' '}
                </span>
                <strong>{waktuWib(transaction.scheduled_check_in)}</strong>
              </p>

              <p>
                <span className="text-muted-foreground">
                  Jadwal Check-out:{' '}
                </span>
                <strong>{waktuWib(transaction.scheduled_check_out)}</strong>
              </p>

              <p>
                <span className="text-muted-foreground">
                  Check-in aktual:{' '}
                </span>
                <strong>{waktuWib(transaction.started_at)}</strong>
              </p>

              <p>
                <span className="text-muted-foreground">
                  Check-out aktual:{' '}
                </span>
                <strong>{waktuWib(transaction.checked_out_at)}</strong>
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-border p-4">
  <h3 className="mb-3 font-bold">Pembayaran</h3>

  <div className="space-y-2">
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">Harga Awal</span>
      <strong>{rupiah(total)}</strong>
    </div>

    <div className="flex justify-between gap-4">
      <span className="font-semibold">Total Transaksi</span>
      <strong>{rupiah(total)}</strong>
    </div>

    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">Total Dibayar</span>
      <strong>{rupiah(totalPaid)}</strong>
    </div>

    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">Sisa</span>
      <strong>{rupiah(remaining)}</strong>
    </div>

    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">Status Pembayaran</span>
      <strong>{remaining === 0 ? 'LUNAS' : 'BELUM LUNAS'}</strong>
    </div>
  </div>
</section>

<section className="rounded-2xl border border-border p-4">
  <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-bold">Riwayat Pembayaran</h3><ReceiptHistoryButton paymentIds={transactionPayments.map((payment) => payment.id)} /></div>

            {transactionPayments.length === 0 ? (
              <p className="text-muted-foreground">
                Belum ada pembayaran tercatat.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {transactionPayments.map((payment) => {
                  const recorder = employees.rows.find(
                    (item) => item.user_id === payment.recorded_by,
                  );

                  return (
                    <div
                      key={payment.id}
                      className="flex justify-between gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="font-semibold uppercase">
                          {payment.kind} · {payment.method}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {waktuWib(payment.created_at)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Dicatat oleh {recorder?.name ?? '—'}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2"><strong>{rupiah(Number(payment.amount))}</strong><ReceiptPrintButton paymentId={payment.id} label="Cetak Struk" /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border p-4">
            <h3 className="mb-3 font-bold">Informasi Transaksi</h3>

            <div className="space-y-2">
              <p>
                <span className="text-muted-foreground">Dibuat: </span>
                <strong>{waktuWib(transaction.created_at)}</strong>
              </p>

              <p>
                <span className="text-muted-foreground">Dibuat oleh: </span>
                <strong>{creator?.name ?? '—'}</strong>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
