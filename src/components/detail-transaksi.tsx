import type { ReactNode } from 'react';
import {
  UserRound, Phone, NotebookPen, BedDouble, DoorOpen, Package, Users,
  CalendarDays, Clock3, Timer, ReceiptText, CircleDollarSign, History,
  Info, Car, CalendarPlus, Stamp, MapPin, type LucideIcon,
} from 'lucide-react';
import { HeaderDetail, BagianDetail, NilaiDetail, kelasPopupDetail } from '@/components/detail-premium';
import { ReceiptHistoryButton, ReceiptPrintButton } from '@/components/receipt-actions';
import { LambangTeratai } from '@/components/kerangka';
import { IkonWhatsApp } from '@/components/ikon-whatsapp';
import { bolehHubungiTamu } from '@/lib/aksi-operasional';
import { openWhatsApp } from '@/lib/whatsapp';
import { usePeran } from '@/lib/peran';
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

function tanggalWib(value: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function jamWib(value: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function durasiWib(awal: string | null, akhir: string | null) {
  if (!awal || !akhir) return '—';

  const menit = Math.round((new Date(akhir).getTime() - new Date(awal).getTime()) / 60000);

  if (!Number.isFinite(menit) || menit < 0) return '—';

  const jam = Math.floor(menit / 60);

  if (jam === 0) return `${menit % 60} menit`;

  return `${jam} jam ${menit % 60} menit`;
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

const kelasPopup = 'flex max-h-[calc(100dvh-2rem)] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-gold/45 bg-background text-sm shadow-lembut';

function Seksi({ judul, ikon: Ikon, children }: { judul: string; ikon: LucideIcon; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-1.5 flex items-center gap-2 border-b border-gold/25 pb-1 text-[12px] font-bold uppercase tracking-[0.16em] text-gold-light">
        <Ikon className="size-4 shrink-0 text-gold" strokeWidth={1.6} />
        <span className="min-w-0 truncate">{judul}</span>
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Baris({ label, ikon: Ikon, nada = '', children }: { label: string; ikon: LucideIcon; nada?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5 text-[13px] leading-snug">
      <Ikon className="size-3.5 shrink-0 self-center text-gold" strokeWidth={1.6} />
      <span className="w-[5.6rem] shrink-0 text-muted-foreground">{label}</span>
      <span className="shrink-0 text-muted-foreground">:</span>
      <span className={`min-w-0 flex-1 break-words font-medium ${nada || 'text-foreground'}`}>{children}</span>
    </div>
  );
}

function Kepala({ nomor, statusLabel, statusDot }: { nomor: string; statusLabel: string; statusDot: string }) {
  return (
    <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-gold/30 bg-navy-deep px-5 py-3 sm:px-7">
      <div className="flex shrink-0 items-center gap-3">
        <LambangTeratai className="h-9 w-12 shrink-0 text-gold" />
        <div className="leading-none">
          <p className="font-serif text-[17px] leading-[1.05] text-foreground">
            Baturaden <span className="text-gold-light">25</span><br />Homestay
          </p>
          <p className="mt-1 text-[0.55rem] font-semibold tracking-[0.32em] text-gold">MANAJEMEN</p>
        </div>
      </div>
      <span className="hidden h-12 w-px shrink-0 bg-gold/35 sm:block" aria-hidden="true" />
      <div className="order-last min-w-0 basis-full sm:order-none sm:basis-auto sm:flex-1">
        <h2 className="font-serif text-2xl leading-tight sm:text-[28px]">Detail Transaksi</h2>
        <p className="mt-0.5 font-mono text-[12px] tracking-[0.22em] text-gold">REG: {nomor}</p>
      </div>
      <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-gold-light sm:ml-0">
        <span className={`size-2 rounded-full ${statusDot}`} />
        {statusLabel}
      </span>
    </header>
  );
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

  const ringkasan = [
    { label: 'Total Harga', nilai: rupiah(total), nada: 'text-gold-light' },
    { label: 'Uang Muka', nilai: rupiah(uangMuka), nada: 'text-siap-foreground' },
    { label: 'Sisa Pembayaran', nilai: rupiah(remaining), nada: 'text-bahaya-foreground' },
  ];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/75 backdrop-blur-sm p-4">
      <div role="dialog" aria-modal="true" aria-label="Detail transaksi" className={kelasPopup}>
        <Kepala
          nomor={transaction.transaction_number}
          statusLabel={transaction.status === 'booking' ? 'Menunggu Check-in' : labelStatusTransaksi[transaction.status] ?? transaction.status}
          statusDot={warnaTitikStatus[transaction.status] ?? 'bg-muted-foreground'}
        />

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#F7F6F3] p-5 sm:px-7 text-foreground [--bahaya-foreground:oklch(0.5_0.14_25)] [--foreground:oklch(0.22_0.02_75)] [--gold-light:oklch(0.52_0.1_78)] [--gold:oklch(0.6_0.1_78)] [--muted-foreground:oklch(0.4_0.02_75)] [--perlu-foreground:oklch(0.55_0.12_75)] [--siap-foreground:oklch(0.45_0.1_152)] [--terisi-foreground:oklch(0.45_0.08_240)]">
          <div className="grid items-start gap-y-4 lg:grid-cols-3 lg:divide-x lg:divide-gold/20 lg:[&>*]:px-5 lg:[&>*:first-child]:pl-0 lg:[&>*:last-child]:pr-0">
            <div className="min-w-0">
              <Seksi judul="Informasi Tamu" ikon={UserRound}>
                <Baris label="Nama" ikon={UserRound}>{guest?.full_name ?? 'Tamu'}</Baris>
                <Baris label="No. HP" ikon={Phone}>
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="tabular-nums">{guest?.phone ?? '—'}</span>
                    <button
                      type="button"
                      disabled={!bolehHubungi}
                      aria-label="Hubungi tamu via WhatsApp"
                      title={guest?.phone ? 'Hubungi tamu via WhatsApp' : 'Nomor WhatsApp belum lengkap'}
                      onClick={() => guest?.phone && openWhatsApp(guest.phone)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-siap-foreground/35 bg-siap/25 px-2.5 py-0.5 text-[11px] font-semibold text-siap-foreground transition-colors hover:border-siap-foreground/70 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <IkonWhatsApp className="size-3" />
                      Hubungi
                    </button>
                  </span>
                </Baris>
                <Baris label="Alamat" ikon={MapPin}>{guest?.address || '—'}</Baris>
                <Baris label="Catatan" ikon={NotebookPen}>{guest?.notes || '—'}</Baris>
              </Seksi>

            </div>
            <div className="min-w-0">
              <Seksi judul="Detail Kamar & Paket" ikon={BedDouble}>
                <Baris label="Kamar" ikon={BedDouble}>{room?.room_number ?? '—'}</Baris>
                <Baris label="Tipe Kamar" ikon={DoorOpen}>{roomType?.name ?? '—'}</Baris>
                <Baris label="Paket" ikon={Package}>{kodePaket(packageItem?.name)}</Baris>
                <Baris label="Jenis Hari" ikon={CalendarDays}>{transaction.day_mode?.toUpperCase() ?? '—'}</Baris>
                <Baris label="Jumlah Tamu" ikon={Users}>Belum tersedia</Baris>
              </Seksi>

            </div>
            <div className="min-w-0">
              <Seksi judul="Jadwal & Status" ikon={Clock3}>
                <Baris label="Check-in" ikon={Car}>{waktuWib(transaction.scheduled_check_in)}</Baris>
                <Baris label="Check-out" ikon={CalendarDays}>{waktuWib(transaction.scheduled_check_out)}</Baris>
                <Baris label="Durasi" ikon={Timer}>{durasiWib(transaction.scheduled_check_in, transaction.scheduled_check_out)}</Baris>
                <Baris label="Status" ikon={Stamp}>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gold-light">
                    <span className={`size-1.5 rounded-full ${warnaTitikStatus[transaction.status] ?? 'bg-muted-foreground'}`} />
                    {labelStatusTransaksi[transaction.status] ?? transaction.status}
                  </span>
                </Baris>
                <Baris label="Dibuat pada" ikon={CalendarPlus}>{waktuWib(transaction.created_at)}</Baris>
                <Baris label="Dibuat oleh" ikon={UserRound}>{creator?.name ?? '—'}</Baris>
              </Seksi>
            </div>
          </div>
          <div className="my-4 h-px bg-gold/25" aria-hidden="true" />
          <div className="grid items-start gap-y-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:divide-x lg:divide-gold/20">
            <div className="min-w-0 lg:pr-6">
              <Seksi judul="Rincian Harga" ikon={ReceiptText}>
                <div className="overflow-hidden rounded-xl border border-gold/25 bg-white/70">
                <table className="w-full text-[12.5px] [&_td:first-child]:pl-3 [&_th:first-child]:pl-3 [&_td:last-child]:pr-3 [&_th:last-child]:pr-3">
                  <thead>
                    <tr className="bg-gold/10 text-[11px] font-semibold uppercase tracking-wide text-gold-light">
                      <th className="py-1 text-left font-medium">Deskripsi</th>
                      <th className="py-1 text-center font-medium">Qty</th>
                      <th className="py-1 text-right font-medium">Harga</th>
                      <th className="py-1 text-right font-medium">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-gold/15">
                      <td className="py-1.5 pr-2">Paket {kodePaket(packageItem?.name)}</td>
                      <td className="py-1.5 text-center tabular-nums">1</td>
                      <td className="py-1.5 text-right whitespace-nowrap tabular-nums">{rupiah(total)}</td>
                      <td className="py-1.5 text-right whitespace-nowrap tabular-nums">{rupiah(total)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="flex items-center justify-between gap-3 border-t border-gold/30 bg-gold/15 px-3 py-2">
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-gold-light">Total Harga</span>
                  <strong className="whitespace-nowrap text-[17px] font-bold tabular-nums text-foreground">{rupiah(total)}</strong>
                </div>
                </div>
              </Seksi>

            </div>
            <div className="min-w-0 lg:pl-6">
              <Seksi judul="Pembayaran" ikon={CircleDollarSign}>
                <div className="divide-y divide-gold/25 rounded-xl border border-gold/30 bg-white/60 sm:grid sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                  {ringkasan.map(item => (
                    <div key={item.label} className="flex min-w-0 items-baseline justify-between gap-2 px-3 py-3 sm:block sm:px-2 sm:text-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                      <p className={`text-[17px] font-bold tabular-nums sm:mt-1.5 sm:whitespace-nowrap ${item.nada}`}>{item.nilai}</p>
                    </div>
                  ))}
                </div>
              </Seksi>

            </div>
          </div>
          <div className="my-4 h-px bg-gold/25" aria-hidden="true" />
          <div className="grid items-start gap-y-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] lg:divide-x lg:divide-gold/20">
            <div className="min-w-0 lg:pr-6">
              <Seksi judul="Riwayat Pembayaran" ikon={History}>
                <div className="mb-2 flex justify-end"><ReceiptHistoryButton paymentIds={transactionPayments.map((payment) => payment.id)} /></div>
                {transactionPayments.length === 0 ? (
                  <p className="text-[12.5px] text-muted-foreground">Belum ada pembayaran tercatat.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-gold/25 bg-white/70 px-3">
                    <table className="w-full text-[12.5px]">
                      <thead>
                        <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <th className="py-1 pr-1 text-left font-medium">#</th>
                          <th className="py-1 pr-1 text-left font-medium">Tanggal</th>
                          <th className="py-1 pr-2 text-right font-medium">Jumlah</th>
                          <th className="py-1 pr-1 text-left font-medium">Metode</th>
                          <th className="py-1 pr-1 text-left font-medium">Oleh</th>
                          <th className="py-1 pr-1 text-left font-medium">Jenis</th>
                          <th className="py-1 text-left font-medium">Catatan</th>
                          <th className="py-1 text-right font-medium">Struk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactionPayments.map((payment, index) => {
                          const recorder = employees.rows.find(item => item.user_id === payment.recorded_by);
                          return (
                            <tr key={payment.id} className="border-t border-gold/15 align-top">
                              <td className="py-1.5 pr-1 tabular-nums text-muted-foreground">{index + 1}</td>
                              <td className="py-1.5 pr-1 whitespace-nowrap">
                                <span className="block">{tanggalWib(payment.created_at)}</span>
                                <span className="block text-muted-foreground">{jamWib(payment.created_at)}</span>
                              </td>
                              <td className="py-1.5 pr-2 text-right whitespace-nowrap font-semibold tabular-nums text-siap-foreground">{rupiah(Number(payment.amount))}</td>
                              <td className="py-1.5 pr-1 whitespace-nowrap">{payment.method}</td>
                              <td className="py-1.5 pr-1 break-words">{recorder?.name ?? '—'}</td>
                              <td className="py-1.5 whitespace-nowrap">{labelJenisPembayaran[payment.kind] ?? payment.kind}</td>
                              <td className="py-1.5 text-muted-foreground">—</td>
                              <td className="py-1.5 text-right"><ReceiptPrintButton paymentId={payment.id} label="Print Receipt" /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Seksi>
            </div>
            <div className="flex min-w-0 flex-col gap-4 lg:self-stretch lg:pl-6">
              <Seksi judul="Sesi Kas & Perubahan" ikon={Info}>
                <Baris label="Sesi Kas" ikon={ReceiptText}>
                  {sesiKas
                    ? `${sesiKas.status === 'open' ? 'Terbuka' : 'Ditutup'} · ${tanggalWib(`${sesiKas.operational_date}T00:00:00+07:00`)}`
                    : '—'}
                </Baris>
                <Baris label="Terakhir diubah" ikon={Clock3}>{waktuWib(transaction.updated_at)}</Baris>
              </Seksi>

              <button
                type="button"
                onClick={onClose}
                className="mt-auto inline-flex w-full items-center justify-center rounded-full border border-gold/50 bg-navy-deep px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#F2D184] transition-colors hover:bg-navy"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}