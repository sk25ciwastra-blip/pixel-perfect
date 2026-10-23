import { BedDouble, UserRound, MapPin, Package, CalendarDays, Clock3, ReceiptText, CreditCard, History, CircleDollarSign, NotebookPen } from 'lucide-react';
import { HeaderDetail, BagianDetail, NilaiDetail, kelasPopupDetail } from '@/components/detail-premium';
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
        <div role="dialog" aria-modal="true" aria-label="Riwayat housekeeping" className={kelasPopupDetail}>
          <HeaderDetail title="Riwayat Housekeeping" nomor={transaction.transaction_number} onClose={onClose} panorama />
          <div className="space-y-3 p-4 sm:p-5">
            <BagianDetail title="Informasi kamar" icon={BedDouble}><div className="grid gap-3 sm:grid-cols-2">
              <NilaiDetail label="Kamar" icon={BedDouble}>{room?.room_number ?? '—'}</NilaiDetail>
              <NilaiDetail label="Status kamar" icon={ReceiptText}>{room?.status ?? '—'}</NilaiDetail>
              <NilaiDetail label="Check-out" icon={CalendarDays}>{waktuWib(transaction.checked_out_at)}</NilaiDetail>
              <NilaiDetail label="Catatan kamar" icon={NotebookPen}>{room?.notes || 'Tidak ada catatan.'}</NilaiDetail>
            </div></BagianDetail>
            <BagianDetail title="Riwayat pekerjaan" icon={History}>
              <div className="space-y-2">{housekeepingHistory.rows
                .filter(item => item.room_id === transaction.room_id && (!item.transaction_id || item.transaction_id === transaction.id))
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map(item => <div key={item.id} className="rounded-lg border border-gold/15 bg-background/60 p-3">
                  <p className="font-semibold text-gold-light">{item.action === 'start_cleaning' ? 'Mulai dibersihkan' : item.action === 'finish_cleaning' ? 'Selesai dibersihkan' : 'Override menjadi siap'}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.performed_by_name} · {new Date(item.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
                  {item.note && <p className="mt-2 break-words">{item.note}</p>}
                </div>)}</div>
            </BagianDetail>
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
      <div role="dialog" aria-modal="true" aria-label="Detail transaksi" className={kelasPopupDetail}>
        <HeaderDetail title="Detail Transaksi" nomor={transaction.transaction_number} onClose={onClose} />
        <div className="space-y-3 p-4 sm:p-5">
          <BagianDetail title="Detail tamu & kamar" icon={UserRound}>
            <div className="grid gap-3 sm:grid-cols-2">
              <NilaiDetail label="Nama tamu" icon={UserRound}>{guest?.full_name ?? 'Tamu'}</NilaiDetail>
              <NilaiDetail label="Kamar" icon={BedDouble}>{room?.room_number ?? '—'}</NilaiDetail>
              <NilaiDetail label="Nomor WhatsApp" icon={UserRound}>{guest?.phone ?? '—'}</NilaiDetail>
              <NilaiDetail label="Tipe kamar" icon={BedDouble}>{roomType?.name ?? '—'}</NilaiDetail>
              <NilaiDetail label="Alamat" icon={MapPin}>{guest?.address || '—'}</NilaiDetail>
              <NilaiDetail label="Paket" icon={Package}>{kodePaket(packageItem?.name)}</NilaiDetail>
              <NilaiDetail label="Jenis hari" icon={CalendarDays}>{transaction.day_mode?.toUpperCase() ?? '—'}</NilaiDetail>
            </div>
          </BagianDetail>
          <BagianDetail title="Ringkasan pembayaran" icon={CircleDollarSign}>
            <div className="grid gap-3 sm:grid-cols-2">
              <NilaiDetail label="Harga awal" icon={BedDouble}>{rupiah(total)}</NilaiDetail>
              <NilaiDetail label="Total dibayar" icon={CreditCard} tone="masuk">{rupiah(totalPaid)}</NilaiDetail>
              <NilaiDetail label="Total transaksi" icon={ReceiptText} tone="total">{rupiah(total)}</NilaiDetail>
              <NilaiDetail label="Sisa pembayaran" icon={Clock3} tone="total">{rupiah(remaining)}</NilaiDetail>
            </div>
            <p className="mt-3 text-right text-xs font-semibold text-gold-light">Status pembayaran: {remaining === 0 ? 'LUNAS' : 'BELUM LUNAS'}</p>
          </BagianDetail>
          <BagianDetail title="Riwayat pembayaran" icon={History}>
            {transactionPayments.length === 0 ? <p className="text-muted-foreground">Belum ada pembayaran tercatat.</p> :
              <div className="space-y-2">{transactionPayments.map(payment => {
                const recorder = employees.rows.find(item => item.user_id === payment.recorded_by);
                return <div key={payment.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-gold/20 bg-background/60 p-3">
                  <CreditCard className="size-5 shrink-0 text-gold" />
                  <div className="min-w-0"><p className="break-words font-semibold uppercase">{payment.kind} · {payment.method}</p><p className="mt-1 text-xs text-muted-foreground">{waktuWib(payment.created_at)}</p><p className="text-xs text-muted-foreground">Dicatat oleh {recorder?.name ?? '—'}</p></div>
                  <strong className="text-right text-siap-foreground">{rupiah(Number(payment.amount))}</strong>
                </div>;
              })}</div>}
          </BagianDetail>
          <BagianDetail title="Status & waktu" icon={Clock3}><div className="grid gap-3 sm:grid-cols-2">
            <NilaiDetail label="Status transaksi" icon={ReceiptText}>{transaction.status === 'booking' ? 'Booking' : transaction.status === 'check_in' ? 'Terisi' : transaction.status === 'check_out' ? 'Selesai' : 'Dibatalkan'}</NilaiDetail>
            <NilaiDetail label="Dibuat oleh" icon={UserRound}>{creator?.name ?? '—'}</NilaiDetail>
            <NilaiDetail label="Jadwal check-in" icon={CalendarDays}>{waktuWib(transaction.scheduled_check_in)}</NilaiDetail>
            <NilaiDetail label="Jadwal check-out" icon={CalendarDays}>{waktuWib(transaction.scheduled_check_out)}</NilaiDetail>
            <NilaiDetail label="Check-in aktual" icon={Clock3}>{waktuWib(transaction.started_at)}</NilaiDetail>
            <NilaiDetail label="Check-out aktual" icon={Clock3}>{waktuWib(transaction.checked_out_at)}</NilaiDetail>
            <NilaiDetail label="Dibuat" icon={CalendarDays}>{waktuWib(transaction.created_at)}</NilaiDetail>
          </div></BagianDetail>
        </div>
      </div>
    </div>
  );
}
