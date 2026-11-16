import { useEffect, useId, useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { rupiah } from '@/lib/data-contoh';
import { labelSkala, skalaArusKas } from '@/lib/keuangan-skala';

type Catatan = { created_at: string; amount: number };
type Props = { penerimaan: Catatan[]; pengeluaran: Catatan[] };

// The chart only groups the already-visible session records; it is not a cash-ledger calculation.
export function KeuanganArus({ penerimaan, pengeluaran }: Props) {
  const [periode, setPeriode] = useState<'Harian' | 'Mingguan' | 'Bulanan'>('Harian');
  const id = useId().replace(/:/g, '');
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setAnimate(!media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const data = useMemo(() => {
    const groups = new Map<string, { tanggal: string; label: string; penerimaan: number; pengeluaran: number; bersih: number }>();
    const add = (row: Catatan, jenis: 'penerimaan' | 'pengeluaran') => {
      const date = new Date(row.created_at);
      if (!Number.isFinite(date.getTime())) return;
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
      const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
      const day = `${part('year')}-${part('month')}-${part('day')}`;
      let key = day;
      if (periode === 'Bulanan') key = day.slice(0, 7);
      if (periode === 'Mingguan') {
        const week = new Date(`${day}T00:00:00Z`);
        week.setUTCDate(week.getUTCDate() - (week.getUTCDay() + 6) % 7);
        key = week.toISOString().slice(0, 10);
      }
      const label = periode === 'Bulanan'
        ? date.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', month: 'short', year: '2-digit' })
        : new Date(`${key}T00:00:00Z`).toLocaleDateString('id-ID', { timeZone: 'UTC', day: '2-digit', month: 'short' });
      const entry = groups.get(key) ?? { tanggal: key, label, penerimaan: 0, pengeluaran: 0, bersih: 0 };
      entry[jenis] += Number(row.amount);
      entry.bersih = entry.penerimaan - entry.pengeluaran;
      groups.set(key, entry);
    };
    penerimaan.forEach(row => add(row, 'penerimaan'));
    pengeluaran.forEach(row => add(row, 'pengeluaran'));
    return [...groups.values()].sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [penerimaan, pengeluaran, periode]);
  const skala = useMemo(
    () => skalaArusKas(data.flatMap(row => [row.penerimaan, row.pengeluaran, row.bersih])),
    [data],
  );
  return <>
    <div className="kf-periode" aria-label="Periode arus kas">
      {(['Harian', 'Mingguan', 'Bulanan'] as const).map(value => <Button key={value} variant="ghost" size="sm" aria-pressed={periode === value} onClick={() => setPeriode(value)}>{value}</Button>)}
    </div>
    <div className="kf-chart" role="img" aria-label={`Grafik ${periode.toLowerCase()} penerimaan dan pengeluaran dari catatan sesi kas`}>
      {data.length ? <ResponsiveContainer width="100%" height="100%">
        <ComposedChart key={periode} data={data} margin={{ top: 18, right: 16, left: 0, bottom: 8 }} barGap={6} barCategoryGap="28%">
          <defs>
            <linearGradient id={`${id}-masuk`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.55} />
              <stop offset="42%" stopColor="var(--siap-foreground)" />
              <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.85} />
            </linearGradient>
            <linearGradient id={`${id}-keluar`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.55} />
              <stop offset="42%" stopColor="var(--bahaya-foreground)" />
              <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.85} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" strokeOpacity={0.6} />
          <XAxis dataKey="label" tick={{ fill: 'var(--foreground)', fontSize: 11, fontWeight: 500 }} tickMargin={10} tickLine={false} axisLine={{ stroke: 'var(--border)' }} minTickGap={24} />
          <YAxis width={64} domain={skala.domain} ticks={skala.ticks} allowDecimals={false} tick={({ x, y, payload }) => <text x={Number(x) - 8} y={y} dy={4} textAnchor="end" fill="var(--muted-foreground)" fontSize={11}>{labelSkala(Number(payload.value))}</text>} tickLine={false} axisLine={false} />
          <Tooltip wrapperClassName="kf-chart-tooltip" cursor={{ fill: 'var(--primary-soft)', fillOpacity: 0.25 }} content={({ active, payload, label }) => active && payload?.length ? <div className="kf-chart-tip"><strong>{label}</strong>{payload.map(entry => <div key={String(entry.dataKey)} data-series={entry.dataKey}><span>{entry.name}</span><b>{rupiah(Number(entry.value))}</b></div>)}</div> : null} />
          <Bar dataKey="penerimaan" name="Penerimaan" fill={`url(#${id}-masuk)`} radius={[4, 4, 0, 0]} maxBarSize={30} isAnimationActive={animate} animationDuration={750} animationEasing="ease-out" />
          <Bar dataKey="pengeluaran" name="Pengeluaran" fill={`url(#${id}-keluar)`} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={animate} animationDuration={750} animationEasing="ease-out" />
          <Line className="kf-chart-line" type="linear" dataKey="bersih" name="Arus Kas Bersih" stroke="var(--gold-light)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--gold-light)', stroke: 'var(--card)', strokeWidth: 2 }} activeDot={{ r: 6, fill: 'var(--gold-light)', stroke: 'var(--card)', strokeWidth: 2 }} isAnimationActive={animate} animationDuration={950} animationEasing="ease-out" />
        </ComposedChart>
      </ResponsiveContainer> : <p className="kf-chart-empty">Belum ada catatan arus kas pada sesi ini.</p>}
    </div>
    {data.length > 0 && <ul className="kf-chart-legend" aria-label="Keterangan grafik"><li data-series="penerimaan"><i aria-hidden="true" />Penerimaan</li><li data-series="pengeluaran"><i aria-hidden="true" />Pengeluaran</li><li data-series="bersih"><i aria-hidden="true" />Arus Kas Bersih</li></ul>}
  </>;
}