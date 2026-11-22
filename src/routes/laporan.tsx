import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { BarChart3, BedDouble, CalendarDays, ClipboardCheck, History, TrendingUp, Coins, Users, UserRound, Layers, UserRoundPlus, Settings, Download, Search, Eye, ReceiptText } from 'lucide-react';
import { Kerangka } from '@/components/kerangka';
import { Button } from '@/components/ui/button';
import { KeuanganArus } from '@/components/keuangan-arus';
import { useTable } from '@/lib/data-live';
import { usePeran } from '@/lib/peran';
import { rupiah } from '@/lib/data-contoh';
import { meta } from '@/lib/meta';
import { dalamPeriode, rentangLaporan, tanggalLaporan } from '@/lib/laporan-periode';
import { buatCsvLaporan } from '@/lib/laporan-export';
import { transaksiBelumDiarsipkan } from '@/lib/demo-archive';
import '@/components/laporan.css';

type Bagian = 'operasional' | 'closing' | 'riwayat' | 'harian' | 'pendapatan';
const daftarBagian: { kode: Bagian; label: string; ikon: typeof History }[] = [
  { kode: 'operasional', label: 'Operasional', ikon: BarChart3 },
  { kode: 'pendapatan', label: 'Pendapatan', ikon: Coins },
  { kode: 'harian', label: 'Rekap Harian', ikon: CalendarDays },
  { kode: 'closing', label: 'Closing Shift', ikon: ClipboardCheck },
  { kode: 'riwayat', label: 'Riwayat Closing', ikon: History },
];

export const Route = createFileRoute('/laporan')({
  validateSearch: (s: Record<string, unknown>): { bagian?: Bagian | undefined } => ({
    bagian: daftarBagian.some((b) => b.kode === s['bagian']) ? (s['bagian'] as Bagian) : undefined,
  }),
  head: () => meta('Laporan Operasional', 'Closing shift, riwayat closing, dan rekap operasional Baturaden 25 Homestay.'),
  component: Halaman,
});

const jamWib = (iso?: string | null) => iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) : '—';
const tanggalTeks = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });

function Halaman() {
  const { peran, posisiKode } = usePeran();
  const canViewHousekeeping = peran === 'owner' || ['supervisor', 'housekeeping', 'inspector'].includes(posisiKode ?? '');
  const { bagian = 'operasional' } = Route.useSearch();
  const sessions = useTable('finance_cash_sessions');
  const payments = useTable('payments');
  const transactions = useTable('transactions');
  const expenses = useTable('finance_expenses');
  const guests = useTable('guests');
  const [pilihan, setPilihan] = useState(1);
  const [periode, setPeriode] = useState(() => rentangLaporan(1));

  const sesiTerbuka = sessions.rows.filter((s) => s.status === 'OPEN');
  const sesiSelesai = useMemo(() => sessions.rows.filter((s) => s.status !== 'OPEN')
    .sort((a, b) => String(b.closed_at ?? b.created_at ?? '').localeCompare(String(a.closed_at ?? a.created_at ?? ''))), [sessions.rows]);

  const bayarPeriode = payments.rows.filter(p => dalamPeriode(p.created_at, periode));
  const biayaPeriode = expenses.rows.filter(p => dalamPeriode(p.created_at, periode));
  const trxPeriode = transactions.rows.filter(t => dalamPeriode(t.created_at, periode));
  const jumlahArsip = trxPeriode.filter(t => !transaksiBelumDiarsipkan(t)).length;
  const penerimaan = bayarPeriode.reduce((sum, p) => sum + Number(p.amount), 0);
  const biaya = biayaPeriode.reduce((sum, p) => sum + Number(p.amount), 0);
  const perMetode = bayarPeriode.reduce<Record<string, number>>((acc, p) => { acc[p.method] = (acc[p.method] ?? 0) + Number(p.amount); return acc; }, {});
  const rekap = useMemo(() => {
    const tanggal = new Set([...payments.rows, ...expenses.rows, ...transactions.rows].filter(p => dalamPeriode(p.created_at, periode)).map(p => tanggalLaporan(p.created_at)));
    return [...tanggal].sort().reverse().map(tgl => {
      const trx = transactions.rows.filter(t => tanggalLaporan(t.created_at) === tgl);
      return {
        tgl, transaksi: trx.length, arsipDemo: trx.filter(t => !transaksiBelumDiarsipkan(t)).length,
        masuk: payments.rows.filter(p => tanggalLaporan(p.created_at) === tgl).reduce((sum, p) => sum + Number(p.amount), 0),
        keluar: expenses.rows.filter(p => tanggalLaporan(p.created_at) === tgl).reduce((sum, p) => sum + Number(p.amount), 0),
      };
    });
  }, [payments.rows, expenses.rows, transactions.rows, periode]);
  const loading = payments.loading || expenses.loading || transactions.loading;
  const gagal = payments.error || expenses.error || transactions.error || sessions.error;
  function exportCsv() {
    if (loading || gagal) return;
    const csv = buatCsvLaporan({
      awal: periode.awal, akhir: periode.akhir,
      penerimaan, pengeluaran: biaya, jumlahTransaksi: trxPeriode.length, jumlahArsipDemo: jumlahArsip,
      rekap, metode: perMetode,
    });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `Baturaden_25_Homestay_Laporan_${periode.awal}_${periode.akhir}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }


  return (
    <Kerangka judul="Laporan Operasional" keterangan="Analisis aktivitas, pendapatan, dan kinerja operasional homestay.">
      <div className="lp-halaman">
      <nav className="lp-tabs" aria-label="Bagian laporan">
        {daftarBagian.filter(b => b.kode !== 'riwayat').map((b) => (
          <span key={b.kode} className="contents">
            {b.kode === 'harian' && <><Link to="/transaksi"><ReceiptText />Transaksi</Link><Link to={canViewHousekeeping ? '/housekeeping' : '/kamar'}><BedDouble />{canViewHousekeeping ? 'Kamar & Housekeeping' : 'Kamar'}</Link></>}
            <Link to="/laporan" search={{ bagian: b.kode }} aria-current={bagian === b.kode ? 'page' : undefined}><b.ikon />{b.label}</Link>
          </span>
        ))}
      </nav>
      <section className="lp-contenu">
        <div className="lp-toolbar">
          <strong>Periode Laporan :</strong>
          <label className="lp-select"><CalendarDays /><select aria-label="Periode laporan" value={pilihan} onChange={e => setPilihan(Number(e.target.value))}><option value={1}>Hari Ini</option><option value={7}>7 Hari Terakhir</option><option value={30}>30 Hari Terakhir</option></select></label>
          <div className="lp-dates"><CalendarDays />{tanggalTeks(periode.awal)} – {tanggalTeks(periode.akhir)}</div>
          <Button className="lp-afficher" onClick={() => setPeriode(rentangLaporan(pilihan))}><Search />Tampilkan Laporan</Button>
          <Button className="lp-export" variant="outline" disabled={loading || Boolean(gagal)} onClick={exportCsv} title="Unduh rekap operasional periode ini dalam CSV"><Download />Ekspor CSV</Button>
        </div>
        {gagal && <p className="lp-error" role="alert">Sebagian laporan belum dapat dimuat. Silakan muat ulang halaman.</p>}
        {bagian !== 'closing' && bagian !== 'riwayat' && <p className="mb-2 text-xs text-muted-foreground">Total historis mencakup transaksi Arsip DEMO dan pembayaran yang tercatat pada periode laporan.</p>}
        <div className="lp-kpis">
          {[{ label: 'Total Penerimaan', nilai: loading || payments.error ? '—' : rupiah(penerimaan), ikon: Coins },
            { label: 'Total Transaksi Baru', nilai: loading || transactions.error ? '—' : `${trxPeriode.length} Transaksi${jumlahArsip ? ` · ${jumlahArsip} Arsip DEMO` : ''}`, ikon: BedDouble },
            { label: 'Total Tamu Baru', nilai: guests.loading || guests.error ? '—' : `${guests.rows.filter(g => dalamPeriode(g.created_at, periode)).length} Tamu`, ikon: Users },
            { label: 'Total Tamu Lama', nilai: '—', ikon: UserRound }].map(k => <article className="lp-kpi" key={k.label}><span className="lp-kpi-icon"><k.ikon /></span><div><p>{k.label}</p><strong>{k.nilai}</strong></div></article>)}
        </div>
        {(bagian === 'operasional' || bagian === 'pendapatan') && <div className="lp-grid">
          <section className="lp-panel lp-chart"><div className="lp-panel-head"><div className="lp-heading"><BarChart3 /><div><h2>Kinerja Operasional</h2><p>Perbandingan penerimaan dan pengeluaran operasional.</p></div></div></div>
            {loading ? <div className="kf-chart-empty">Memuat laporan…</div> : gagal ? <div className="kf-chart-empty">Grafik belum dapat dimuat.</div> : <KeuanganArus penerimaan={bayarPeriode} pengeluaran={biayaPeriode} />}
          </section>
          <section className="lp-panel lp-summary"><div className="lp-heading"><Layers /><div><h2>Ringkasan Usaha</h2><p>Rangkuman penerimaan dan biaya operasional.</p></div></div><dl>
            <div><dt><BedDouble />Pendapatan Kamar</dt><dd>—</dd></div>
            <div><dt><UserRoundPlus />Tamu Tambahan</dt><dd>—</dd></div>
            <div><dt><Settings />Biaya Operasional</dt><dd className="lp-negative">{loading || expenses.error ? '—' : rupiah(biaya)}</dd></div>
          </dl><div className="lp-result"><span><TrendingUp />Arus Kas Bersih</span><strong>{loading || gagal ? '—' : rupiah(penerimaan - biaya)}</strong></div></section>
        </div>}
        {(bagian === 'operasional' || bagian === 'harian' || bagian === 'pendapatan') && <section className="lp-panel">
          <div className="lp-panel-head"><div className="lp-heading"><CalendarDays /><div><h2>Rekap Harian</h2><p>Ringkasan kinerja operasional per hari.</p></div></div><div className="lp-panel-actions"><Button variant="outline" asChild><Link to="/laporan" search={{ bagian: 'riwayat' }}><History />Riwayat Closing</Link></Button><Button className="lp-closing" asChild><Link to="/laporan" search={{ bagian: 'closing' }}><ClipboardCheck />Closing Shift</Link></Button></div></div>
          <div className="lp-table-scroll"><table className="lp-table"><thead><tr><th>Tanggal</th><th>Transaksi Baru</th><th>Penerimaan</th><th>Pengeluaran Operasional</th><th>Arus Kas Bersih</th><th>Aksi</th></tr></thead><tbody>
            {rekap.map(r => <tr key={r.tgl}><td>{tanggalTeks(r.tgl)}</td><td>{r.transaksi} Transaksi{r.arsipDemo > 0 && <> · {r.arsipDemo} Arsip DEMO</>}</td><td>{rupiah(r.masuk)}</td><td>{rupiah(r.keluar)}</td><td className={r.masuk - r.keluar < 0 ? 'lp-negative' : 'lp-positive'}>{rupiah(r.masuk - r.keluar)}</td><td><Button variant="outline" asChild><Link to="/transaksi"><Eye />Daftar operasional</Link></Button></td></tr>)}
          </tbody></table></div>
          {!rekap.length && <p className="lp-empty">{loading ? 'Memuat rekap…' : gagal ? 'Rekap belum dapat dimuat.' : 'Belum ada catatan pada periode ini.'}</p>}
        </section>}

      {bagian === 'closing' && (
        <div className="lp-sessions">
          <section className="lp-panel"><div className="lp-panel-head"><div className="lp-heading"><ClipboardCheck /><h2>Sesi Kas Terbuka</h2></div></div>
            {sesiTerbuka.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada sesi kas terbuka saat ini.</p> : (
              <ul>{sesiTerbuka.map((s) => (
                <li key={s.id} className="lp-session-row">
                  <p className="font-semibold">{s.operational_date ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">Dibuka {jamWib(s.opened_at ?? s.created_at)}</p>
                </li>))}</ul>
            )}
          </section>
          <section className="lp-panel"><div className="lp-panel-head"><div className="lp-heading"><ClipboardCheck /><h2>Lakukan Closing</h2></div></div>
            <p className="lp-note">Closing shift memakai perhitungan kas resmi di halaman Keuangan, agar angka setoran tetap satu sumber.</p>
            <div className="lp-panel-actions mt-4"><Button asChild className="lp-closing"><Link to="/keuangan">Buka Closing Shift</Link></Button></div>
          </section>
        </div>
      )}

      {bagian === 'riwayat' && (
        <section className="lp-panel"><div className="lp-panel-head"><div className="lp-heading"><History /><h2>Riwayat Closing</h2></div></div>
          {sesiSelesai.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada closing tercatat.</p> : (
            <div className="lp-table-scroll"><table className="lp-table">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Tanggal</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Ditutup</th></tr></thead>
              <tbody>{sesiSelesai.map((s) => (
                <tr key={s.id} className="border-b border-border/50"><td className="py-2.5 pr-3 font-semibold">{s.operational_date ?? '—'}</td><td className="py-2.5 pr-3 text-gold-light">{s.status}</td><td className="py-2.5 pr-3 text-muted-foreground">{jamWib(s.closed_at)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      )}

      {bagian === 'harian' && <section className="lp-panel mt-3"><div className="lp-panel-head"><div className="lp-heading"><Coins /><h2>Penerimaan per Metode</h2></div></div><dl>{Object.entries(perMetode).map(([m, v]) => <div className="lp-session-row" key={m}><dt>{m}</dt><dd className="lp-positive">{rupiah(v)}</dd></div>)}</dl>{!Object.keys(perMetode).length && <p className="lp-empty">Belum ada penerimaan pada periode ini.</p>}<div className="lp-session-row"><span>Booking : {trxPeriode.filter(t => t.status === 'booking').length}</span><span>Check-in : {trxPeriode.filter(t => t.status === 'check_in').length}</span></div></section>}
      </section>
      </div>
    </Kerangka>
  );
}
