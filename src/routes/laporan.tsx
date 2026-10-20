import { createFileRoute, Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { ClipboardCheck, History, CalendarCheck, TrendingUp } from 'lucide-react';
import { Kerangka, Panel, Angka } from '@/components/kerangka';
import { useTable } from '@/lib/data-live';
import { rupiah } from '@/lib/data-contoh';
import { meta } from '@/lib/meta';

type Bagian = 'closing' | 'riwayat' | 'harian' | 'pendapatan';
const daftarBagian: { kode: Bagian; label: string; ikon: typeof History }[] = [
  { kode: 'closing', label: 'Closing Shift', ikon: ClipboardCheck },
  { kode: 'riwayat', label: 'Riwayat Closing', ikon: History },
  { kode: 'harian', label: 'Rekap Harian', ikon: CalendarCheck },
  { kode: 'pendapatan', label: 'Rekap Pendapatan', ikon: TrendingUp },
];

export const Route = createFileRoute('/laporan')({
  validateSearch: (s: Record<string, unknown>): { bagian?: Bagian } => ({
    bagian: daftarBagian.some((b) => b.kode === s.bagian) ? (s.bagian as Bagian) : undefined,
  }),
  head: () => meta('Laporan Operasional', 'Closing shift, riwayat closing, dan rekap operasional Baturaden 25 Homestay.'),
  component: Halaman,
});

const tglWib = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
const jamWib = (iso?: string | null) => iso ? new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }) : '—';

function Halaman() {
  const { bagian = 'closing' } = Route.useSearch();
  const sessions = useTable('finance_cash_sessions');
  const payments = useTable('payments');
  const transactions = useTable('transactions');
  const hariIni = tglWib(new Date().toISOString());

  const sesiTerbuka = sessions.rows.filter((s) => s.status === 'OPEN');
  const sesiSelesai = useMemo(() => sessions.rows.filter((s) => s.status !== 'OPEN')
    .sort((a, b) => String(b.closed_at ?? b.created_at ?? '').localeCompare(String(a.closed_at ?? a.created_at ?? ''))), [sessions.rows]);

  const bayarHariIni = payments.rows.filter((p) => tglWib(p.created_at) === hariIni);
  const trxHariIni = transactions.rows.filter((t) => tglWib(t.created_at) === hariIni);
  const perMetode = bayarHariIni.reduce<Record<string, number>>((acc, p) => { acc[p.method] = (acc[p.method] ?? 0) + Number(p.amount); return acc; }, {});

  const tujuhHari = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 86400000).toISOString();
    const tgl = tglWib(d);
    const total = payments.rows.filter((p) => tglWib(p.created_at) === tgl).reduce((s, p) => s + Number(p.amount), 0);
    return { tgl, total };
  }), [payments.rows]);
  const maks = Math.max(1, ...tujuhHari.map((h) => h.total));

  return (
    <Kerangka judul="Laporan Operasional" keterangan="Closing shift dan rekap operasional harian">
      <div className="mb-6 flex flex-wrap gap-2">
        {daftarBagian.map((b) => (
          <Link key={b.kode} to="/laporan" search={{ bagian: b.kode }}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition ${bagian === b.kode ? 'border-gold/60 bg-gradient-to-r from-gold-light/20 to-gold/5 text-gold-light' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}>
            <b.ikon className="h-4 w-4" />{b.label}
          </Link>
        ))}
      </div>

      {bagian === 'closing' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel judul="Sesi kas terbuka">
            {sesiTerbuka.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada sesi kas terbuka saat ini.</p> : (
              <ul className="space-y-2">{sesiTerbuka.map((s) => (
                <li key={s.id} className="rounded-xl border border-border bg-secondary/60 px-3 py-2 text-sm">
                  <p className="font-semibold">{s.operational_date ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">Dibuka {jamWib(s.opened_at ?? s.created_at)}</p>
                </li>))}</ul>
            )}
          </Panel>
          <Panel judul="Lakukan closing">
            <p className="text-sm text-muted-foreground">Closing shift memakai perhitungan kas resmi di halaman Keuangan, agar angka setoran tetap satu sumber.</p>
            <Link to="/keuangan" className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Buka Closing Shift</Link>
          </Panel>
        </div>
      )}

      {bagian === 'riwayat' && (
        <Panel judul="Riwayat closing">
          {sesiSelesai.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada closing tercatat.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Tanggal</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Ditutup</th></tr></thead>
              <tbody>{sesiSelesai.map((s) => (
                <tr key={s.id} className="border-b border-border/50"><td className="py-2.5 pr-3 font-semibold">{s.operational_date ?? '—'}</td><td className="py-2.5 pr-3 text-gold-light">{s.status}</td><td className="py-2.5 pr-3 text-muted-foreground">{jamWib(s.closed_at)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </Panel>
      )}

      {bagian === 'harian' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel judul="Hari ini">
            <div className="grid grid-cols-2 gap-4">
              <Angka label="Transaksi baru" nilai={String(trxHariIni.length)} />
              <Angka label="Booking" nilai={String(trxHariIni.filter((t) => t.status === 'booking').length)} />
              <Angka label="Check-in" nilai={String(trxHariIni.filter((t) => t.status === 'check_in').length)} />
              <Angka label="Penerimaan" nilai={rupiah(bayarHariIni.reduce((s, p) => s + Number(p.amount), 0))} />
            </div>
          </Panel>
          <Panel judul="Penerimaan per metode">
            {Object.keys(perMetode).length === 0 ? <p className="text-sm text-muted-foreground">Belum ada penerimaan hari ini.</p> : (
              <ul className="space-y-2">{Object.entries(perMetode).map(([m, v]) => (
                <li key={m} className="flex justify-between text-sm"><span>{m}</span><span className="font-semibold text-v0-success">{rupiah(v)}</span></li>))}</ul>
            )}
          </Panel>
        </div>
      )}

      {bagian === 'pendapatan' && (
        <Panel judul="Penerimaan 7 hari terakhir">
          <div className="flex h-56 items-end gap-3">
            {tujuhHari.map((h) => (
              <div key={h.tgl} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{h.total ? rupiah(h.total) : ''}</span>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-gold-dark to-gold-light" style={{ height: `${(h.total / maks) * 160 + 2}px` }} />
                <span className="text-[11px] text-muted-foreground">{h.tgl.slice(8)}/{h.tgl.slice(5, 7)}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm">Total: <span className="font-bold text-v0-success">{rupiah(tujuhHari.reduce((s, h) => s + h.total, 0))}</span></p>
        </Panel>
      )}
    </Kerangka>
  );
}
