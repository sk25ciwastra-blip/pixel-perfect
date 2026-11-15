import type { ReactNode } from 'react';
import {
  UserRound, Phone, NotebookPen, BedDouble, DoorOpen, Package, Users,
  CalendarDays, Clock3, Timer, ReceiptText, CircleDollarSign, History,
  Info, Car, CalendarPlus, Stamp, MapPin, type LucideIcon,
} from 'lucide-react';
import { HeaderDetail, BagianDetail, NilaiDetail, kelasPopupDetail } from '@/components/detail-premium';
import { Button } from '@/components/ui/button';
import '@/components/operasional-krem.css';
import { IkonWhatsApp } from '@/components/ikon-whatsapp';
import { bolehHubungiTamu } from '@/lib/aksi-operasional';
import { openWhatsApp } from '@/lib/whatsapp';
import { usePeran } from '@/lib/peran';
import { usePaymentConfirmation } from '@/lib/use-payment-confirmation';
import { AksiPdfStruk } from '@/components/konfirmasi-pembayaran';
import { useTable } from '@/lib/data-live';
import { rupiah } from '@/lib/data-contoh';
import { durasiWib, jamWib, tanggalWib, waktuWib } from '@/lib/waktu-transaksi';
import { ReceiptPrintButton, ReceiptHistoryButton } from '@/components/receipt-actions';

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

const labelStatusTransaksi: Record<string, string> = {
  booking: 'Booking',
  check_in: 'Terisi',
  check_out: 'Selesai',
  cancelled: 'Dibatalkan',
};

const warnaTitikStatus: Record<string, string> = {
  booking: 'bg-perlu-foreground',
  check_in: 'bg-terisi-foreground',
  check_out: 'bg-siap-foreground',
  cancelled: 'bg-bahaya-foreground',
};

const labelJenisPembayaran: Record<string, string> = {
  dp: 'Uang Muka',
  payment: 'Pembayaran',
};

const kelasPopup = 'operasional-krem flex max-h-[calc(100dvh-2rem)] w-full max-w-[1000px] flex-col overflow-hidden text-sm';

function Seksi({ judul, ikon: Ikon, children }: { judul: string; ikon: LucideIcon; children: ReactNode }) {
  return <section className="ok-panel"><h3><Ikon /><span>{judul}</span></h3>{children}</section>;
}

function Baris({ label, children }: { label: string; ikon: LucideIcon; nada?: string; rataAtas?: boolean; children: ReactNode }) {
  return <div className="ok-baris"><span>{label}</span><span>:</span><span>{children}</span></div>;
}

function Kepala({ nomor, statusLabel, statusDot, dibuat }: { nomor: string; statusLabel: string; statusDot: string; dibuat: string }) {
  return <header className="ok-kepala">
    <div className="min-w-0"><p>TRANSAKSI / ARSIP OPERASIONAL</p><div className="flex flex-wrap items-center gap-3"><h2>Detail Transaksi</h2><span className="ok-nomor font-mono break-all">{nomor}</span></div></div>
    <div className="ok-meta"><span className="inline-flex items-center gap-2 rounded-md border border-primary/50 px-3 py-1 text-xs font-semibold text-primary"><span className={`size-2 rounded-full ${statusDot}`} />{statusLabel}</span><p>Dibuat pada: {dibuat}</p></div>
  </header>;
}

export function DetailTransaksi({
  transactionId,
  onClose,
  mode = 'full',
}: DetailTransaksiProps) {
  const transactions = useTable('transactions', true, { column: 'id', value: transactionId });
  const restricted = mode === 'housekeeping';
  const transaction = transactions.rows.find(item => item.id === transactionId);
  const payments = useTable('payments', !restricted, { column: 'transaction_id', value: transactionId });
  const guests = useTable('guests', !restricted && !!transaction?.guest_id, { column: 'id', value: transaction?.guest_id ?? '' });
  const rooms = useTable('rooms');
  const roomTypes = useTable('room_types');
  const packages = useTable('packages');
  const employees = useTable('employees', !restricted);
  const cashSessions = useTable('finance_cash_sessions', !restricted);
  const housekeepingHistory = useTable('housekeeping_history', restricted);
  const { posisiKode } = usePeran();
  const konfirmasi = usePaymentConfirmation();

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

  const uangMuka = transactionPayments
    .filter((item) => item.kind === 'dp')
    .reduce((total, item) => total + Number(item.amount), 0);

  const total = Number(transaction.price_snapshot ?? 0);
  const remaining = Math.max(total - totalPaid, 0);

  const sesiKasTerakhir = [...transactionPayments].reverse().find((item) => item.cash_session_id);
  const sesiKas = cashSessions.rows.find((item) => item.id === sesiKasTerakhir?.cash_session_id);

  const bolehHubungi = bolehHubungiTamu(posisiKode, guest?.phone);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/75 backdrop-blur-sm p-4">
      <div role="dialog" aria-modal="true" aria-label="Detail transaksi" className={kelasPopup}>
        <Kepala nomor={transaction.transaction_number} dibuat={waktuWib(transaction.created_at)}
          statusLabel={transaction.status === 'booking' ? 'Menunggu Check-in' : labelStatusTransaksi[transaction.status] ?? transaction.status}
          statusDot={warnaTitikStatus[transaction.status] ?? 'bg-muted-foreground'} />
        <div className="ok-isi">
          <div className="ok-grid">
            <div className="ok-kolom">
              <Seksi judul="Identitas Tamu" ikon={UserRound}>
                <Baris label="Nama" ikon={UserRound}>{guest?.full_name ?? 'Tamu'}</Baris>
                <Baris label="No. HP" ikon={Phone}><span className="flex flex-wrap items-center gap-2"><span>{guest?.phone ?? '—'}</span><Button type="button" variant="outline" size="sm" disabled={!bolehHubungi} aria-label="Hubungi tamu via WhatsApp" title={guest?.phone ? 'Hubungi tamu via WhatsApp' : 'Nomor WhatsApp belum lengkap'} onClick={() => guest?.phone && openWhatsApp(guest.phone)} className="h-6 px-2 text-[10px] text-siap-foreground"><IkonWhatsApp />Hubungi</Button></span></Baris>
                <Baris label="Alamat" ikon={MapPin}>{guest?.address || '—'}</Baris>
              </Seksi>
              <Seksi judul="Rincian Menginap" ikon={BedDouble}>
                <div className="ok-rincian">
                  <div>
                    <Baris label="No. Kamar" ikon={BedDouble}>{room?.room_number ?? '—'}</Baris>
                    <Baris label="Tipe Kamar" ikon={DoorOpen}>{roomType?.name ?? '—'}</Baris>
                    <Baris label="Jadwal Check-in" ikon={CalendarDays}>{waktuWib(transaction.scheduled_check_in)}</Baris>
                    <Baris label="Batas Sewa" ikon={CalendarDays}>{waktuWib(transaction.scheduled_check_out)}</Baris>
                    <Baris label="Durasi" ikon={Timer}>{durasiWib(transaction.scheduled_check_in, transaction.scheduled_check_out)}</Baris>
                  </div>
                  <div>
                    <Baris label="Kode Paket" ikon={Package}>{kodePaket(packageItem?.name)}</Baris>
                    <Baris label="Dibuat oleh" ikon={UserRound}>{creator?.name ?? '—'}</Baris>
                    <Baris label="Check-in Aktual" ikon={Car}>{waktuWib(transaction.started_at)}</Baris>
                    <Baris label="Check-out Aktual" ikon={CalendarDays}>{waktuWib(transaction.checked_out_at)}</Baris>
                    <Baris label="Jumlah Tamu" ikon={Users}>{transaction.guest_count ?? 'Belum tersedia'}</Baris>
                    <Baris label="Jenis Hari" ikon={CalendarDays}>{transaction.day_mode?.toUpperCase() ?? '—'}</Baris>
                  </div>
                </div>
              </Seksi>
              <Seksi judul="Sesi Kas & Perubahan" ikon={Info}>
                <Baris label="Sesi Kas" ikon={ReceiptText}>{sesiKas ? `${sesiKas.status === 'OPEN' ? 'Terbuka' : 'Ditutup'} · ${tanggalWib(`${sesiKas.operational_date}T00:00:00+07:00`)}` : '—'}</Baris>
                <div className="mt-3 flex flex-wrap items-center gap-2"><ReceiptHistoryButton transactionNumber={transaction.transaction_number} /><AksiPdfStruk hook={konfirmasi} transactionId={transaction.id} /></div>
              </Seksi>
            </div>
            <div className="ok-kolom">
              <Seksi judul="Pembayaran" ikon={CircleDollarSign}>
                <div className="ok-payment"><span>Total Tagihan</span><span>{rupiah(total)}</span></div>
                <div className="ok-payment"><span>Uang Muka</span><span>{rupiah(uangMuka)}</span></div>
                <div className="ok-payment font-bold"><span>Total Dibayar</span><span>{rupiah(totalPaid)}</span></div>
                <div className="ok-total mt-2"><span>Sisa Tagihan</span><strong>{rupiah(remaining)}</strong></div>
              </Seksi>
              <Seksi judul="Riwayat Pembayaran" ikon={History}>
                {transactionPayments.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada pembayaran tercatat.</p> : <div className="ok-history">{transactionPayments.map(payment => {
                  const recorder = employees.rows.find(item => item.user_id === payment.recorded_by);
                  return <div key={payment.id} className="ok-history-item"><div className="ok-history-top"><span>{labelJenisPembayaran[payment.kind] ?? payment.kind}</span><span>{rupiah(Number(payment.amount))}</span></div><div className="ok-history-meta"><span>{payment.method} · {recorder?.name ?? '—'}</span><span>{tanggalWib(payment.created_at)} {jamWib(payment.created_at)}</span></div><ReceiptPrintButton paymentId={payment.id} /></div>;
                })}</div>}
              </Seksi>
              <Seksi judul="Catatan" ikon={NotebookPen}><p className="break-words text-xs leading-relaxed">{guest?.notes || 'Tidak ada catatan.'}</p></Seksi>
            </div>
          </div>
          <div className="ok-table-wrap"><Seksi judul="Rincian Transaksi" ikon={ReceiptText}>
            <table><thead><tr><th>Deskripsi</th><th>Jumlah</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>
              <tr><td>Paket {kodePaket(packageItem?.name)}</td><td>1</td><td>{rupiah(transaction.base_price_snapshot ?? total - Number(transaction.extra_guest_charge ?? 0))}</td><td>{rupiah(transaction.base_price_snapshot ?? total - Number(transaction.extra_guest_charge ?? 0))}</td></tr>
              {Number(transaction.extra_guest_charge) > 0 && <tr><td>Tamu Tambahan</td><td>{transaction.extra_guest_count}</td><td>{rupiah(transaction.extra_guest_unit_price)}</td><td>{rupiah(transaction.extra_guest_charge)}</td></tr>}
            </tbody></table><div className="ok-total mt-2"><span>Total Transaksi</span><strong>{rupiah(total)}</strong></div>
          </Seksi></div>
        </div>
        <footer className="ok-pied"><p><strong>Terakhir diubah:</strong> {waktuWib(transaction.updated_at)}</p><Button type="button" className="ok-noir" onClick={onClose}>Tutup</Button></footer>
      </div>
    </div>
  );
}
