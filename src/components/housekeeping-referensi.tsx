import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { BarChart3, Brush, CalendarDays, ClipboardList, ChevronRight, BedDouble, CheckCircle2, LoaderCircle } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import type { Database } from '@/integrations/supabase/types';
import { formatDurasi, grafikTahun, riwayatPekerjaan, tahunTersedia, type ringkasanHousekeeping } from '@/lib/housekeeping-ringkasan';

type HistoryRow = Database['public']['Tables']['housekeeping_history']['Row'];
type MaintenanceRow = Database['public']['Tables']['housekeeping_maintenance']['Row'];
type Room = Database['public']['Tables']['rooms']['Row'];
type Ringkasan = ReturnType<typeof ringkasanHousekeeping>;
const waktu = (value: string) => new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const tanggal = (value: string) => new Date(value).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' });
const jenis = (value: string) => value === 'linen' ? 'Penggantian Sprei & Linen' : value === 'fan' ? 'Pembersihan Kipas Angin' : value === 'toilet' ? 'Pembersihan Kamar Mandi' : value;

export function RingkasanSelesai({ data }: { data: Ringkasan }) {
  return <div className="hk-completion-grid">{[{ label: 'Hari Ini', jumlah: data.hari, ikon: BedDouble }, { label: 'Minggu Ini', jumlah: data.minggu, ikon: CalendarDays }, { label: 'Bulan Ini', jumlah: data.bulan, ikon: CalendarDays }].map(item => <div key={item.label}><item.ikon /><div><p>{item.label}</p><strong>{item.jumlah}<small> kamar</small></strong></div></div>)}</div>;
}

export function PanelPerawatanReferensi({ rows, rooms }: { rows: MaintenanceRow[]; rooms: Room[] }) {
  const terbaru = [...rows].sort((a, b) => b.performed_at.localeCompare(a.performed_at)).slice(0, 5);
  return <section className="hk-side-panel hk-maintenance-reference"><div className="hk-panel-header"><CalendarDays /><h2>Perawatan Berkala</h2></div><div className="hk-reference-scroll"><table className="hk-reference-table"><thead><tr><th>Kamar</th><th>Jenis Perawatan</th><th>Tanggal</th><th>Status</th></tr></thead><tbody>{terbaru.map(item => <tr key={item.id}><td>{rooms.find(room => room.id === item.room_id)?.room_number ?? item.location_code}</td><td>{jenis(item.work_type)}</td><td>{tanggal(item.performed_at)}</td><td><span className="hk-state" data-state="ready"><CheckCircle2 />Selesai</span></td></tr>)}{!rows.length && <tr><td colSpan={4} className="hk-reference-empty">Belum ada perawatan tercatat.</td></tr>}</tbody></table></div></section>;
}

export function PanelSelesaiReferensi({ data }: { data: Ringkasan }) {
  return <section className="hk-side-panel hk-completion-panel"><div className="hk-panel-header"><Brush /><h2>Jumlah Kamar Dibersihkan</h2></div><RingkasanSelesai data={data} /></section>;
}

export function RiwayatReferensi({ history, rooms }: { history: HistoryRow[]; rooms: Room[] }) {
  const jobs = riwayatPekerjaan(history, 5);
  return <section className="hk-bottom-panel hk-history-reference"><div className="hk-panel-header"><ClipboardList /><h2>Riwayat Pekerjaan</h2></div><div className="hk-reference-scroll"><table className="hk-reference-table"><thead><tr><th>Kamar</th><th>Petugas</th><th>Mulai</th><th>Selesai</th><th>Durasi</th><th>Hasil</th></tr></thead><tbody>{jobs.map(item => <tr key={item.id}><td>{rooms.find(room => room.id === item.roomId)?.room_number ?? '—'}</td><td>{item.petugas || '—'}</td><td>{item.mulai ? waktu(item.mulai) : '—'}</td><td>{item.selesai ? waktu(item.selesai) : '—'}</td><td>{formatDurasi(item.durasiMenit)}</td><td><span className="hk-state" data-state={item.hasil === 'Proses' ? 'cleaning' : 'ready'}>{item.hasil === 'Proses' ? <LoaderCircle /> : <CheckCircle2 />}{item.hasil}</span></td></tr>)}{!jobs.length && <tr><td colSpan={6} className="hk-reference-empty">Belum ada riwayat pekerjaan.</td></tr>}</tbody></table></div><div className="hk-panel-footer"><span>Menampilkan {jobs.length} pekerjaan terakhir</span><Link to="/housekeeping" search={{ bagian: 'riwayat' }} className="hk-reference-more">Lihat Semua <ChevronRight /></Link></div></section>;
}

export function GrafikReferensi({ data, history }: { data: Ringkasan; history: HistoryRow[] }) {
  const [tahun, setTahun] = useState(data.tahun);
  const pilihan = tahunTersedia(history);
  const grafik = tahun === data.tahun ? data.grafik : grafikTahun(history, tahun);
  const bulanIni = tahun === data.tahun ? new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta', month: 'numeric' }) : '';
  return <section className="hk-bottom-panel hk-chart-panel"><div className="hk-panel-header"><BarChart3 /><h2>Grafik Membersihkan Kamar per Bulan</h2><select className="hk-chart-year" aria-label="Pilih tahun grafik" value={tahun} onChange={event => setTahun(event.target.value)}>{pilihan.map(item => <option key={item} value={item}>{item}</option>)}</select></div><div className="hk-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={grafik} margin={{ top: 22, right: 12, left: 4, bottom: 0 }}><defs><linearGradient id="hk-emas-batang" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--gold-light)" /><stop offset="100%" stopColor="var(--gold)" /></linearGradient><linearGradient id="hk-emas-tua" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--gold)" /><stop offset="100%" stopColor="var(--gold-dark)" /></linearGradient></defs><CartesianGrid vertical={false} /><XAxis dataKey="nama" tickLine={false} axisLine={{ stroke: 'var(--premium-line)' }} interval={0} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} label={{ value: 'Jumlah Kamar', angle: -90, position: 'insideLeft', offset: 6, className: 'hk-chart-axis-label' }} /><Tooltip cursor={false} content={({ active, payload }) => active && payload?.length ? <div className="hk-chart-tooltip">{String(payload[0]?.payload?.nama ?? '')}: <strong>{Number(payload[0]?.value ?? 0)} kamar</strong></div> : null} /><Bar dataKey="jumlah" radius={[4,4,0,0]} maxBarSize={30}>{grafik.map((item, index) => <Cell key={item.nama} fill={String(index + 1) === bulanIni ? 'url(#hk-emas-tua)' : bulanIni && index + 1 > Number(bulanIni) ? 'var(--premium-highlight)' : 'url(#hk-emas-batang)'} />)}<LabelList dataKey="jumlah" position="top" className="hk-chart-value" formatter={(value: unknown) => Number(value) > 0 ? String(value) : ""} /></Bar></BarChart></ResponsiveContainer></div></section>;
}
