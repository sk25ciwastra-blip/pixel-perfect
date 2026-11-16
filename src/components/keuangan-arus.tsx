import { useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { rupiah } from '@/lib/data-contoh';

type Catatan = { created_at: string; amount: number };
type Props = { penerimaan: Catatan[]; pengeluaran: Catatan[] };

// The chart only groups the already-visible session records; it is not a cash-ledger calculation.
export function KeuanganArus({ penerimaan, pengeluaran }: Props) {
  const [periode, setPeriode] = useState<'Harian' | 'Mingguan' | 'Bulanan'>('Harian');
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
  return <>
    <div className="kf-periode" aria-label="Periode arus kas">
      {(['Harian', 'Mingguan', 'Bulanan'] as const).map(value => <Button key={value} variant="ghost" size="sm" aria-pressed={periode === value} onClick={() => setPeriode(value)}>{value}</Button>)}
    </div>
    <div className="kf-chart" role="img" aria-label={`Grafik ${periode.toLowerCase()} penerimaan dan pengeluaran dari catatan sesi kas`}>
      {data.length ? <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 14, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fill: 'var(--foreground)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--border)' }} minTickGap={18} />
          <YAxis width={50} tick={{ fill: 'var(--foreground)', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={value => value >= 1000000 ? `${value / 1000000} jt` : value >= 1000 ? `${value / 1000} rb` : String(value)} />
          <Tooltip formatter={value => rupiah(Number(value))} contentStyle={{ background: 'var(--card)', border: '1px solid var(--gold-dark)', borderRadius: 8, color: 'var(--foreground)', fontSize: 12 }} />
          <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
          <Bar dataKey="penerimaan" name="Penerimaan" fill="var(--chart-2)" maxBarSize={22} />
          <Bar dataKey="pengeluaran" name="Pengeluaran" fill="var(--chart-5)" maxBarSize={16} />
          <Line dataKey="bersih" name="Penerimaan bersih" stroke="var(--success-gold)" strokeWidth={2} dot={{ r: 4, fill: 'var(--success-gold)' }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer> : <p className="kf-chart-empty">Belum ada catatan arus kas pada sesi ini.</p>}
    </div>
  </>;
}