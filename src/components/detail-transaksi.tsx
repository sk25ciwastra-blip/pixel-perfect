import { useState, type ReactNode } from 'react';
import {
  UserRound, NotebookPen, BedDouble, DoorOpen, CalendarDays, ReceiptText,
  CircleDollarSign, History, CreditCard, Flag, Download, ChevronDown, Printer, X, Clock, SquarePlus, type LucideIcon,
} from 'lucide-react';
import { HeaderDetail, BagianDetail, NilaiDetail, kelasPopupDetail } from '@/components/detail-premium';
import { TombolHapusDemo } from '@/components/hapus-data-demo';
import '@/components/operasional-krem.css';
import '@/components/detail-transaksi.css';
import { IkonWhatsApp } from '@/components/ikon-whatsapp';
import { bolehHubungiTamu } from '@/lib/aksi-operasional';
import { openWhatsApp } from '@/lib/whatsapp';
import { usePeran } from '@/lib/peran';
import { usePaymentConfirmation } from '@/lib/use-payment-confirmation';
import { AksiPdfStruk } from '@/components/konfirmasi-pembayaran';
import { useTable } from '@/lib/data-live';
import { rupiah } from '@/lib/data-contoh';
import { waktuWib, jejakWib, tanggalHariWib, jamWib } from '@/lib/waktu-transaksi';
import { ReceiptTransactionButton, ReceiptPrinterTestButton } from '@/components/receipt-actions';
import { featureFlags } from '@/lib/feature-flags';

type DetailTransaksiProps = {
  transactionId: string;
  onClose: () => void;
  onDeleted?: () => void;
  mode?: 'full' | 'housekeeping' | 'read-only';
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
  check_in: 'Check-in',
  check_out: 'Selesai',
  cancelled: 'Dibatalkan',
};

const labelJenisPembayaran: Record<string, string> = {
  dp: 'DOWN PAYMENT (DP)',
  payment: 'FINAL PAYMENT',
};

function Panel({ judul, ikon: Ikon, isi, children }: { judul: string; ikon: LucideIcon; isi?: boolean; children: ReactNode }) {
  return <section className={`dtx-panel${isi ? ' dtx-isi-penuh' : ''}`}><h3><Ikon /><span>{judul}</span></h3>{children}</section>;
}

function Baris({ label, children }: { label: string; children: ReactNode }) {
  return <div className="dtx-baris"><span>{label}</span><span>:</span><span>{children}</span></div>;
}

function WaktuMenginap({ value }: { value: string | null }) {
  if (!value) return <>—</>;
  const tanggal = new Date(value);
  if (Number.isNaN(tanggal.getTime())) return <>—</>;
  return <span className="dtx-waktu-menginap">
    <strong><CalendarDays />{tanggal.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</strong>
    <span><Clock />{tanggal.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false })} WIB</span>
  </span>;
}

export function DetailTransaksi({
  transactionId,
  onClose,
  onDeleted,
  mode = 'full',
}: DetailTransaksiProps) {
  const { posisiKode } = usePeran();
  const transactions = useTable('transactions', true, { column: 'id', value: transactionId });
  const restricted = mode === 'housekeeping';
  // Inspector remains read-only even if another page forgets the mode prop.
  const viewOnly = mode === 'read-only' || posisiKode === 'inspector';
  const transaction = transactions.rows.find(item => item.id === transactionId);
  const payments = useTable('payments', !restricted, { column: 'transaction_id', value: transactionId });
  const guests = useTable('guests', !restricted && !!transaction?.guest_id, { column: 'id', value: transaction?.guest_id ?? '' });
  const rooms = useTable('rooms');
  const roomTypes = useTable('room_types');
  const packages = useTable('packages');
  const employees = useTable('employees', !restricted);
  const housekeepingHistory = useTable('housekeeping_history', restricted);
  const konfirmasi = usePaymentConfirmation();
  const notes = useTable('guest_notes', !restricted && !!transaction?.guest_id, { column: 'guest_id', value: transaction?.guest_id ?? '' });
  const logs = useTable('activity_logs', !restricted, { column: 'entity_id', value: transactionId });
  const [lihatCatatan, setLihatCatatan] = useState(false);
  const [bukaPdf, setBukaPdf] = useState(false);

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


  const catatan = [...notes.rows].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
  const bolehHubungi = !viewOnly && bolehHubungiTamu(posisiKode, guest?.phone);
  const namaPegawai = (uid: string | null | undefined) => employees.rows.find(item => item.user_id === uid)?.name;
  const viaBooking = !!transaction.scheduled_check_in;
  const logCheckout = logs.rows.find(item => item.action === 'check_out');

  type Peristiwa = { key: string; waktu: string | null; judul: string; ikon: LucideIcon; nada?: 'hijau' | 'abu' | undefined; metode?: string | undefined; jumlah?: number | undefined; oleh?: string | undefined; ket?: string | undefined };
  const peristiwa: Peristiwa[] = ([
    { key: 'buat', waktu: transaction.created_at, judul: viaBooking ? 'RESERVASI' : 'Transaksi dibuat', ikon: CalendarDays, oleh: creator?.name },
    ...transactionPayments.map(p => ({ key: p.id, waktu: p.created_at, judul: p.kind === 'dp' ? 'DOWN PAYMENT (DP)' : labelJenisPembayaran[p.kind] ?? p.kind, ikon: CreditCard, metode: p.method.toUpperCase(), jumlah: Number(p.amount), oleh: namaPegawai(p.recorded_by) })),
    ...(transaction.started_at ? [{ key: 'in', waktu: transaction.started_at, judul: 'CHECK-IN', ikon: DoorOpen, nada: 'hijau' as const, oleh: viaBooking ? undefined : creator?.name }] : []),
  ] as Peristiwa[]).sort((a, b) => new Date(a.waktu ?? 0).getTime() - new Date(b.waktu ?? 0).getTime());
  if (transaction.status !== 'cancelled') peristiwa.push(transaction.checked_out_at
    ? { key: 'out', waktu: transaction.checked_out_at, judul: 'CHECK-OUT', ikon: Flag, oleh: namaPegawai(logCheckout?.user_id) }
    : { key: 'out', waktu: null, judul: 'CHECK-OUT', ikon: Flag, nada: 'abu', ket: 'Belum dilakukan' });

  const status = transaction.status === 'booking' ? 'Menunggu Check-in' : labelStatusTransaksi[transaction.status] ?? transaction.status;
  const hargaDasar = transaction.base_price_snapshot ?? total - Number(transaction.extra_guest_charge ?? 0);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-navy-deep/75 backdrop-blur-sm p-3 sm:p-4">
      <div role="dialog" aria-modal="true" aria-label="Detail transaksi" className="operasional-krem dtx">
        <header className="dtx-kepala">
          <div className="min-w-0">
            <p className="dtx-jejak">TRANSAKSI / ARSIP OPERASIONAL</p>
            <div className="dtx-judul"><h2>Detail Transaksi</h2><span className="dtx-nomor">{transaction.transaction_number}</span></div>
          </div>
          <div className="dtx-meta">
            <span className={`dtx-status dtx-status-${transaction.status}`}>{status.toUpperCase()}</span>
            <p>Dibuat pada : {jejakWib(transaction.created_at)}</p>
          </div>
        </header>

        <div className="dtx-isi">
          <div className="dtx-grid">
            <div className="dtx-kolom">
              <Panel judul="Identitas Tamu" ikon={UserRound}>
                <Baris label="Nama">{guest?.full_name ?? 'Tamu'}</Baris>
                <Baris label="No. HP"><span className="dtx-hp"><span>{guest?.phone ?? '—'}</span><button type="button" className="dtx-hubungi" disabled={!bolehHubungi} aria-label="Hubungi tamu via WhatsApp" title={guest?.phone ? 'Hubungi tamu via WhatsApp' : 'Nomor WhatsApp belum lengkap'} onClick={() => guest?.phone && openWhatsApp(guest.phone)}><IkonWhatsApp />Hubungi</button></span></Baris>
                <Baris label="Alamat">{guest?.address || '—'}</Baris>
              </Panel>

              <Panel judul="Rincian Menginap" ikon={BedDouble} isi>
                <div className="dtx-menginap">
                    <Baris label="No. Kamar">{room?.room_number ?? '—'}</Baris>
                    <Baris label="Kode Paket">{kodePaket(packageItem?.name)}</Baris>
                    <Baris label="Tipe Kamar">{roomType?.name?.toUpperCase() ?? '—'}</Baris>
                    <Baris label="Jenis Transaksi"><span className={`dtx-jenis ${viaBooking ? 'dtx-jenis-booking' : 'dtx-jenis-langsung'}`}>{viaBooking ? 'BOOKING' : 'WALK-IN'}</span></Baris>
                    <Baris label="Jadwal Check-in"><WaktuMenginap value={transaction.scheduled_check_in} /></Baris>
                    <Baris label="Check-in Aktual"><WaktuMenginap value={transaction.started_at} /></Baris>
                    <Baris label="Batas Sewa"><WaktuMenginap value={transaction.scheduled_check_out} /></Baris>
                    <Baris label="Check-out Aktual"><WaktuMenginap value={transaction.checked_out_at} /></Baris>
                </div>
                <div className="dtx-dua dtx-ekstra">
                  <div className="dtx-kotak"><h4><SquarePlus />EXTEND</h4><Baris label="Kode Paket">—</Baris><Baris label="Batas Check-out">—</Baris><Baris label="Dibuat Oleh">—</Baris></div>
                  <div className="dtx-kotak"><h4><Clock />OVERTIME</h4><Baris label="Batas Check-out">—</Baris><Baris label="Kelebihan Waktu">—</Baris><Baris label="Dibuat Oleh">—</Baris></div>
                </div>
              </Panel>

              <Panel judul="Rincian Transaksi" ikon={ReceiptText}>
                <div className="dtx-tabel"><table><thead><tr><th>No.</th><th>Tipe Kamar</th><th>No. Kamar</th><th>Paket</th><th>Jumlah</th></tr></thead><tbody>
                  <tr><td>1</td><td>{roomType?.name?.toUpperCase() ?? '—'}</td><td>{room?.room_number ?? '—'}</td><td>{kodePaket(packageItem?.name)}</td><td>{rupiah(hargaDasar)}</td></tr>
                  {Number(transaction.extra_guest_charge) > 0 && <tr><td>2</td><td colSpan={3}>Tamu Tambahan × {transaction.extra_guest_count}</td><td>{rupiah(transaction.extra_guest_charge)}</td></tr>}
                </tbody></table></div>
                <div className="dtx-total dtx-total-besar"><span>Total Transaksi</span><strong>{rupiah(total)}</strong></div>
              </Panel>
            </div>

            <div className="dtx-kolom">
              <Panel judul="Pembayaran" ikon={CircleDollarSign}>
                <div className="dtx-bayar"><span>Total Tagihan</span><span>{rupiah(total)}</span></div>
                <div className="dtx-bayar"><span>DP</span><span>{rupiah(uangMuka)}</span></div>
                <div className="dtx-bayar dtx-dibayar"><span>Total Dibayar</span><strong>{rupiah(totalPaid)}</strong></div>
                <div className="dtx-total"><span>Sisa Tagihan</span><strong>{rupiah(remaining)}</strong></div>
              </Panel>

              <Panel judul="Riwayat Transaksi & Penanganan" ikon={History}>
                <ol className="dtx-linimasa">{peristiwa.map(e => <li key={e.key} className={e.nada ? `dtx-nada-${e.nada}` : undefined}>
                  <span className="dtx-bulat"><e.ikon /></span>
                  <div className="dtx-kartu">
                    <div className="dtx-kartu-atas"><strong>{e.judul}</strong><span>{tanggalHariWib(e.waktu)}</span></div>
                    <div className="dtx-kartu-bawah">
                      <span className="dtx-kartu-kiri">
                        {e.metode
                          ? <>{e.metode} <span aria-hidden>·</span> <b>{rupiah(e.jumlah ?? 0)}</b></>
                          : e.ket
                            ? <em>{e.ket}</em>
                            : <>Oleh : <b>{e.oleh ?? '—'}</b></>}
                      </span>
                      <span className="dtx-kartu-kanan">{e.waktu ? `${jamWib(e.waktu)} WIB` : ''}</span>
                    </div>
                    {e.metode && <p className="dtx-kartu-oleh">Oleh : <b>{e.oleh ?? '—'}</b></p>}
                    {e.metode && e.ket && <p><em>{e.ket}</em></p>}
                  </div>
                </li>)}</ol>
              </Panel>

              <section className="dtx-panel dtx-catatan">
                <div className="dtx-catatan-kepala"><h3><NotebookPen /><span>Catatan</span></h3>{catatan.length > 0 && <button type="button" className="dtx-lihat" aria-expanded={lihatCatatan} onClick={() => setLihatCatatan(v => !v)}>Lihat semua ({catatan.length})</button>}</div>
                <p className="dtx-catatan-isi">{catatan[0]?.body || guest?.notes || 'Tidak ada catatan.'}</p>
                {lihatCatatan && <div className="dtx-semua" role="dialog" aria-label="Semua catatan"><div className="dtx-semua-kepala"><strong>Semua Catatan</strong><button type="button" aria-label="Tutup catatan" onClick={() => setLihatCatatan(false)}><X /></button></div>
                  {catatan.map(n => <div key={n.id} className="dtx-semua-item"><p>{n.created_at ? waktuWib(n.created_at) : 'Waktu tidak diketahui'} · {n.author_name ?? 'Penulis tidak diketahui'}{n.author_role ? ` (${n.author_role})` : ''}</p><strong>{n.body}</strong></div>)}</div>}
              </section>
            </div>
          </div>
        </div>

        <footer className="dtx-pied">
          <p><strong>Terakhir diubah :</strong> {jejakWib(transaction.updated_at)}</p>
          <div className="dtx-aksi">
            {!viewOnly && <>
              <div className="dtx-pdf">
                <button type="button" className="dtx-tombol" aria-expanded={bukaPdf} onClick={() => setBukaPdf(v => !v)}><Download />Bukti Digital<ChevronDown className="dtx-panah" /></button>
                {bukaPdf && <div className="dtx-pdf-menu"><AksiPdfStruk hook={konfirmasi} transactionId={transaction.id} ringkas /></div>}
              </div>
              <span className="dtx-cetak">
                {featureFlags.receipt58mm
                  ? <ReceiptTransactionButton transactionNumber={transaction.transaction_number} label="Cetak Struk" />
                  : <button type="button" disabled title="Cetak struk pembayaran resmi belum diaktifkan. Owner dapat mencoba printer dengan tombol Tes Printer 58 mm."><Printer />Cetak Struk</button>}
                {posisiKode === 'owner' && <ReceiptPrinterTestButton />}
              </span>
            </>}
            {transaction.demo_archived_at && <span className="text-xs font-semibold">Arsip DEMO</span>}
            {!viewOnly && onDeleted && !transaction.demo_archived_at && <TombolHapusDemo kind="transaction" id={transaction.id} code={transaction.transaction_number}
              name={guest?.full_name ?? 'Tamu'} amount={transaction.price_snapshot === null ? 'Nominal belum tercatat' : rupiah(total)}
              onDeleted={onDeleted} />}
            {!viewOnly && onDeleted && !transaction.demo_archived_at && <TombolHapusDemo kind="archive" id={transaction.id} code={transaction.transaction_number}
              name={guest?.full_name ?? 'Tamu'} amount={transaction.price_snapshot === null ? 'Nominal belum tercatat' : rupiah(total)}
              onDeleted={onDeleted} />}
            <button type="button" className="dtx-tutup" onClick={onClose}>Tutup</button>
          </div>
        </footer>
      </div>
    </div>
  );
}
