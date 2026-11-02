import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, ReceiptText, Search } from 'lucide-react';
import { DetailTransaksi } from '@/components/detail-transaksi';
import { IkonWhatsApp } from '@/components/ikon-whatsapp';
import { bolehHubungiTamu } from '@/lib/aksi-operasional';
import { openWhatsApp } from '@/lib/whatsapp';
import { Kerangka } from '@/components/kerangka';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lencana } from '@/components/status-kamar';
import { rupiah } from '@/lib/data-contoh';
import { supabase } from '@/integrations/supabase/client';
import { meta } from '@/lib/meta';
import { usePeran } from '@/lib/peran';
import { NAMA_BULAN, periodeWib, tanggalTransaksi, TRANSAKSI_PER_HALAMAN } from '@/lib/transaksi-filter';
import { transaksiQuery, tahunTransaksiQuery } from '@/lib/transaksi-query';

export const Route = createFileRoute('/transaksi')({
  ssr: false,
  head: () => meta('Daftar Transaksi', 'Penelusuran transaksi Baturaden 25 Homestay berdasarkan bulan, tahun, dan nomor transaksi.'),
  validateSearch: (s: Record<string, unknown>): { bulan?: number | undefined; tahun?: number | undefined; cari?: string | undefined; halaman?: number | undefined } => ({
    bulan: typeof s['bulan'] === 'number' ? s['bulan'] : undefined,
    tahun: typeof s['tahun'] === 'number' ? s['tahun'] : undefined,
    cari: typeof s['cari'] === 'string' ? s['cari'] : '',
    halaman: typeof s['halaman'] === 'number' ? s['halaman'] : 1,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps }) => {
    const kini = periodeWib();
    const filter = normalisasi(deps, kini);
    await Promise.all([context.queryClient.ensureQueryData(transaksiQuery(filter)), context.queryClient.ensureQueryData(tahunTransaksiQuery)]);
  },
  pendingComponent: () => <Kerangka judul="Daftar Transaksi"><p role="status" className="text-muted-foreground">Memuat transaksi…</p></Kerangka>,
  errorComponent: () => <Kerangka judul="Daftar Transaksi"><p role="alert">Daftar transaksi tidak dapat dimuat.</p><Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Coba lagi</Button></Kerangka>,
  notFoundComponent: () => <Kerangka judul="Daftar Transaksi"><p>Transaksi tidak ditemukan.</p></Kerangka>,
  component: Halaman,
});

function normalisasi(s: { bulan?: number | undefined; tahun?: number | undefined; cari?: string | undefined; halaman?: number | undefined }, kini: { bulan: number; tahun: number }) {
  return {
    bulan: s.bulan !== undefined && Number.isInteger(s.bulan) && s.bulan >= 0 && s.bulan <= 12 ? s.bulan : kini.bulan,
    tahun: s.tahun !== undefined && Number.isInteger(s.tahun) && s.tahun >= 1 && s.tahun <= 9998 ? s.tahun : kini.tahun,
    cari: (s.cari ?? '').trim(),
    halaman: s.halaman !== undefined && Number.isFinite(s.halaman) ? Math.max(1, Math.floor(s.halaman)) : 1,
  };
}
const labels = { booking: 'BOOKING', check_in: 'CHECK-IN', check_out: 'SELESAI', cancelled: 'DIBATALKAN' };
const labelClasses = { booking: 'bg-primary-soft text-primary', check_in: 'bg-terisi text-terisi-foreground', check_out: 'bg-siap text-siap-foreground', cancelled: 'bg-bahaya text-bahaya-foreground' };
function jam(value: string | null) {
  return value ? new Date(value).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).replace(':', '.') : '—';
}
function Halaman() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filter = normalisasi(search, periodeWib());
  const { data } = useSuspenseQuery(transaksiQuery(filter));
  const { data: tahunTersedia } = useSuspenseQuery(tahunTransaksiQuery);
  const queryClient = useQueryClient();
  const { posisiKode } = usePeran();
  const [cari, setCari] = useState(search.cari ?? '');
  const [detail, setDetail] = useState<string | null>(null);
  useEffect(() => setCari(search.cari ?? ''), [search.cari]);
  useEffect(() => {
    const channel = supabase.channel('daftar-transaksi-paginasi').on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
      void queryClient.invalidateQueries({ queryKey: ['daftar-transaksi'] });
      void queryClient.invalidateQueries({ queryKey: ['tahun-transaksi'] });
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [queryClient]);
  const ubah = (values: Partial<typeof filter>) => void navigate({ search: prev => ({ ...prev, ...values, halaman: values.halaman ?? 1 }) });
  const pages = Math.max(1, Math.ceil(data.total / TRANSAKSI_PER_HALAMAN));
  const groups = new Map<string, typeof data.rows>();
  for (const tr of data.rows) {
    const date = tanggalTransaksi(tr.created_at);
    groups.set(date, [...(groups.get(date) ?? []), tr]);
  }
  const tahun = [...new Set([...tahunTersedia, filter.tahun])].sort((a, b) => b - a);
  const judulPeriode = filter.cari ? 'Hasil pencarian seluruh periode' : `${filter.bulan ? NAMA_BULAN[filter.bulan - 1] : 'Semua bulan'} ${filter.tahun}`;
  const paginasi = (ringkas = false) => <div className="flex shrink-0 items-center gap-2">
    {!ringkas && <span className="mr-1 text-xs text-muted-foreground">Halaman {data.halaman} dari {pages}</span>}
    <Button size="icon" variant="outline" className="size-8 rounded-md" aria-label="Halaman sebelumnya" disabled={data.halaman <= 1} onClick={() => ubah({ halaman: data.halaman - 1 })}><ChevronLeft /></Button>
    {ringkas && <span className="min-w-8 text-center text-sm font-semibold text-gold-light">{data.halaman} / {pages}</span>}
    <Button size="icon" variant="outline" className="size-8 rounded-md" aria-label="Halaman berikutnya" disabled={data.halaman >= pages} onClick={() => ubah({ halaman: data.halaman + 1 })}><ChevronRight /></Button>
  </div>;
  return <Kerangka judul="Daftar Transaksi" keterangan="Pemantauan dan penelusuran transaksi">
    <div className="grid grid-cols-2 items-end gap-3 rounded-lg border border-gold/25 bg-card/70 p-3 sm:p-4 lg:grid-cols-[minmax(140px,.7fr)_minmax(130px,.6fr)_minmax(240px,1.5fr)]">
      <div className="space-y-2"><label className="text-xs text-muted-foreground" htmlFor="bulan-transaksi">Bulan</label><Select value={String(filter.bulan)} onValueChange={v => ubah({ bulan: Number(v) })}><SelectTrigger id="bulan-transaksi" className="h-11 bg-background/70 [&>span]:flex [&>span]:items-center"><span className="flex items-center gap-2"><CalendarDays className="size-4 text-gold" /><SelectValue /></span></SelectTrigger><SelectContent><SelectItem value="0">Semua Bulan</SelectItem>{NAMA_BULAN.map((b, i) => <SelectItem key={b} value={String(i + 1)}>{b}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-2"><label className="text-xs text-muted-foreground" htmlFor="tahun-transaksi">Tahun</label><Select value={String(filter.tahun)} onValueChange={v => ubah({ tahun: Number(v) })}><SelectTrigger id="tahun-transaksi" className="h-11 bg-background/70 [&>span]:flex [&>span]:items-center"><span className="flex items-center gap-2"><CalendarDays className="size-4 text-gold" /><SelectValue /></span></SelectTrigger><SelectContent>{tahun.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
      <form onSubmit={e => { e.preventDefault(); ubah({ cari }); }} className="col-span-2 flex h-11 min-w-0 items-center gap-2 rounded-md border border-gold/30 bg-background/70 pl-3 pr-1 lg:col-span-1"><Search className="size-4 shrink-0 text-muted-foreground" /><input aria-label="Pencarian transaksi" placeholder="Cari Nomor Transaksi..." value={cari} onChange={e => setCari(e.target.value)} className="h-full w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground" /><Button type="submit" size="sm" className="shrink-0">Cari</Button></form>
    </div>
    <div className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/50 bg-primary-soft/30 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3"><CalendarDays className="size-6 shrink-0 text-gold" /><div><h2 className="text-sm font-bold text-gold-light">{judulPeriode}</h2><p className="mt-0.5 text-xs text-muted-foreground">{filter.cari ? `Nomor transaksi: ${filter.cari}` : 'Daftar transaksi berdasarkan tanggal dibuat'}</p></div></div><div className="flex flex-wrap items-center gap-4"><span className="text-sm">{data.total} transaksi</span>{paginasi()}</div>
    </div>
    {!data.rows.length && <div className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">{filter.cari ? 'Nomor transaksi tidak ditemukan.' : 'Belum ada transaksi pada periode ini.'}</div>}
    <div className="space-y-4">{[...groups].map(([date, rows]) => <section key={date} className="rounded-lg border border-gold/20 bg-card/40 p-3 sm:p-4" aria-label={`Transaksi ${date}`}>
      <div className="mb-3 flex items-center gap-3"><h3 className="text-sm font-bold">{new Date(date + 'T12:00:00+07:00').toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' })}</h3><span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">{rows.length} transaksi</span></div>
      <ul className="space-y-2">{rows.map(tr => {
        const phone = tr.guests?.phone?.replace(/\D/g, '').slice(-4) || '—';
        return <li key={tr.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg border border-gold/25 bg-background/70 p-2.5 transition-colors hover:border-gold/50 sm:grid-cols-[74px_minmax(0,1fr)_minmax(210px,.85fr)_110px_120px_32px] sm:gap-x-4 sm:p-3">
          <div className="row-span-2 flex min-h-16 flex-col items-center justify-center rounded-md border border-gold/50 bg-primary-soft/40 px-1 text-center sm:row-span-1"><span className="w-full truncate text-[11px] text-gold-light" title={tr.rooms?.room_types?.name}>{tr.rooms?.room_types?.name ?? 'Kamar'}</span><strong className="mt-1 font-serif text-2xl leading-none text-foreground">{tr.rooms?.room_number ?? '—'}</strong></div>
          <div className="min-w-0"><p className="truncate text-sm font-bold" title={tr.guests?.full_name}>{tr.guests?.full_name?.toUpperCase() ?? 'TAMU'} · {phone}</p><Button variant="link" className="mt-0.5 h-auto max-w-full justify-start truncate p-0 font-mono text-xs text-gold-light" onClick={() => setDetail(tr.id)}>{tr.transaction_number}</Button></div>
          <div className="col-start-2 row-start-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:col-start-auto sm:row-start-auto sm:text-xs"><span>Check-in <strong className="ml-1 font-mono text-foreground">{jam(tr.started_at)}</strong></span><span className="border-l border-gold/20 pl-3">Check-out <strong className="ml-1 font-mono text-foreground">{jam(tr.checked_out_at)}</strong></span></div>
          <div className="col-start-3 row-start-1 justify-self-end sm:col-start-auto sm:row-start-auto sm:justify-self-center"><Lencana kelas={labelClasses[tr.status]}>{labels[tr.status]}</Lencana></div>
          <strong className="col-start-3 row-start-2 whitespace-nowrap text-right text-sm sm:col-start-auto sm:row-start-auto">{tr.price_snapshot === null ? '—' : rupiah(Number(tr.price_snapshot))}</strong>
          <Button variant="ghost" size="icon" className="col-start-2 row-start-3 size-8 border-l border-gold/20 text-siap-foreground sm:col-start-auto sm:row-start-auto" aria-label="Hubungi tamu via WhatsApp" title="Hubungi tamu via WhatsApp" disabled={!bolehHubungiTamu(posisiKode, tr.guests?.phone)} onClick={() => {
            if (!bolehHubungiTamu(posisiKode, tr.guests?.phone) || !tr.guests?.phone) return;
            openWhatsApp(tr.guests.phone);
          }}><IkonWhatsApp /></Button>
        </li>;
      })}</ul>
    </section>)}</div>
    <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{data.total ? `${(data.halaman - 1) * 20 + 1}–${Math.min(data.halaman * 20, data.total)} dari ${data.total} transaksi` : '0 transaksi'} · 20 per halaman</span>{paginasi(true)}</footer>
    {detail && <DetailTransaksi transactionId={detail} onClose={() => setDetail(null)} />}
  </Kerangka>;
}