import { Link } from '@tanstack/react-router';
import { BarChart3, Brush, CalendarDays, ClipboardCheck, ChevronRight, BedDouble } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import type { Database } from '@/integrations/supabase/types';
import type { ringkasanHousekeeping } from '@/lib/housekeeping-ringkasan';

type HistoryRow = Database['public']['Tables']['housekeeping_history']['Row'];
type MaintenanceRow = Database['public']['Tables']['housekeeping_maintenance']['Row'];
type Room = Database['public']['Tables']['rooms']['Row'];
type Ringkasan = ReturnType<typeof ringkasanHousekeeping>;
const waktu = (value: string) => new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const pekerjaan = (action: string) => action === 'start_cleaning' ? 'Mulai dibersihkan' : action === 'finish_cleaning' ? 'Selesai dibersihkan' : 'Dijadikan siap';

export function RingkasanSelesai({ data }: { data: Ringkasan }) {
  return <div className="hk-completion-grid">{[{ label: 'Hari Ini', jumlah: data.hari, ikon: BedDouble }, { label: 'Minggu Ini', jumlah: data.minggu, ikon: CalendarDays }, { label: 'Bulan Ini', jumlah: data.bulan, ikon: ClipboardCheck }].map(item => <div key={item.label}><item.ikon /><div><p>{item.label}</p><strong>{item.jumlah}<small> kali</small></strong></div></div>)}</div>;
}

export function PanelPerawatanReferensi({ rows }: { rows: MaintenanceRow[] }) {
  return <section className="hk-side-panel hk-maintenance-reference"><div className="hk-panel-header"><CalendarDays /><h2>Perawatan Berkala</h2><Link to="/housekeeping" search={{ bagian: 'perawatan' }} className="hk-reference-link" aria-label="Lihat perawatan berkala"><ChevronRight /></Link></div><div className="hk-reference-scroll"><table className="hk-reference-table"><thead><tr><th>Lokasi</th><th>Jenis Perawatan</th><th>Terakhir Dikerjakan</th><th>Status</th></tr></thead><tbody>{[...rows].sort((a,b) => b.performed_at.localeCompare(a.performed_at)).slice(0,5).map(item => <tr key={item.id}><td>{item.location_code}</td><td>{item.work_type === 'linen' ? 'Sprei' : item.work_type === 'fan' ? 'Kipas Angin' : item.work_type === 'toilet' ? 'Toilet' : item.work_type}</td><td>{waktu(item.performed_at)}</td><td><span className="hk-state" data-state="ready">Tercatat</span></td></tr>)}{!rows.length && <tr><td colSpan={4} className="hk-reference-empty">Belum ada perawatan tercatat.</td></tr>}</tbody></table></div><Link to="/housekeeping" search={{ bagian: 'perawatan' }} className="hk-reference-more">Lihat Perawatan <ChevronRight /></Link></section>;
}

export function PanelSelesaiReferensi({ data }: { data: Ringkasan }) {
  return <section className="hk-side-panel hk-completion-panel"><div className="hk-panel-header"><Brush /><h2>Jumlah Pembersihan Selesai</h2></div><RingkasanSelesai data={data} /></section>;
}

export function RiwayatReferensi({ history, rooms }: { history: HistoryRow[]; rooms: Room[] }) {
  return <section className="hk-bottom-panel"><div className="hk-panel-header"><ClipboardCheck /><h2>Riwayat Pekerjaan</h2></div><div className="hk-reference-scroll"><table className="hk-reference-table"><thead><tr><th>Kamar</th><th>Petugas</th><th>Waktu WIB</th><th>Pekerjaan</th></tr></thead><tbody>{[...history].sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0,5).map(item => <tr key={item.id}><td>{rooms.find(room => room.id === item.room_id)?.room_number ?? '—'}</td><td>{item.performed_by_name || '—'}</td><td>{waktu(item.created_at)}</td><td>{pekerjaan(item.action)}</td></tr>)}{!history.length && <tr><td colSpan={4} className="hk-reference-empty">Belum ada riwayat pekerjaan.</td></tr>}</tbody></table></div><Link to="/housekeeping" search={{ bagian: 'riwayat' }} className="hk-reference-more">Lihat Semua <ChevronRight /></Link></section>;
}

export function GrafikReferensi({ data }: { data: Ringkasan }) {
  return <section className="hk-bottom-panel hk-chart-panel"><div className="hk-panel-header"><BarChart3 /><h2>Grafik Pembersihan per Bulan</h2><span className="hk-chart-year">{data.tahun}</span></div><div className="hk-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.grafik} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}><defs><linearGradient id="hk-emas-batang" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--gold-light)" /><stop offset="100%" stopColor="var(--gold-dark)" /></linearGradient></defs><CartesianGrid vertical={false} /><XAxis dataKey="nama" tickLine={false} axisLine={false} interval={0} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} /><Tooltip cursor={false} content={({ active, payload }) => active && payload?.length ? <div className="hk-chart-tooltip">{String(payload[0]?.payload?.nama ?? '')}: <strong>{Number(payload[0]?.value ?? 0)} pembersihan</strong></div> : null} /><Bar dataKey="jumlah" radius={[4,4,0,0]} maxBarSize={34} /></BarChart></ResponsiveContainer></div><p className="hk-chart-caption">Pembersihan selesai berdasarkan riwayat yang dapat diakses.</p></section>;
}