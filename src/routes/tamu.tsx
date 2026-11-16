import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Eye, Search, Plus, ArrowDownUp, Pencil, UserRound, NotebookPen, CalendarDays, Users, BedDouble, FileText, X, Clock, Layers, CircleCheck, Info, ReceiptText } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { Kerangka } from '@/components/kerangka';
import { Button } from '@/components/ui/button';
import { useTable, type Guest } from '@/lib/data-live';
import { supabase } from '@/integrations/supabase/client';
import { meta } from '@/lib/meta';
import { usePeran } from '@/lib/peran';
import { openWhatsApp } from '@/lib/whatsapp';
import { DetailTransaksi } from '@/components/detail-transaksi';
import '@/components/tamu.css';
import '@/components/detail-tamu.css';
import { empatDigitWA, kunjunganTamu, urutTamu } from '@/lib/tamu-tampilan';

export const Route = createFileRoute('/tamu')({
  head: () => meta('Daftar Tamu', 'Data tamu dan pencarian nama atau nomor HP Baturaden 25 Homestay.'),
  component: HalamanTamu,
});
function normalisasiNomor(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('62') ? '0' + digits.slice(2) : digits;
}
function tanggalPendekWib(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric' });
}
function jamWib(value: string) {
  return new Date(value).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false });
}
function rupiah(nilai: number) {
  return 'Rp' + nilai.toLocaleString('id-ID');
}
function terbanyak(items: string[]) {
  const hitung = new Map<string, number>();
  for (const item of items) if (item !== '—') hitung.set(item, (hitung.get(item) ?? 0) + 1);
  return [...hitung.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'id-ID')).at(0)?.[0] ?? '—';
}
const statusTransaksi: Record<string, string> = { booking: 'BOOKING', check_in: 'CHECK-IN', check_out: 'SELESAI', cancelled: 'DIBATALKAN' };
function pembuatCatatan(role: string | null, name: string | null) {
  const jabatan: Record<string, string> = { owner: 'Owner', own: 'Owner', pemilik: 'Owner', supervisor: 'SPV', spv: 'SPV', receptionist: 'RCP', resepsionis: 'RCP', rcp: 'RCP', housekeeping: 'HK', hk: 'HK' };
  const label = jabatan[role?.trim().toLowerCase() ?? ''];
  const nama = name?.trim();
  const hanyaLabelOwner = label === 'Owner' && (!nama || ['pemilik', 'owner', 'own'].includes(nama.toLowerCase()));
  if (hanyaLabelOwner) return 'Owner · Nama tidak tersedia';
  if (!nama) return 'Tidak diketahui';
  return label ? `${label} · ${nama}` : nama;
}
function waktuCatatanWib(value: string) {
  const date = new Date(value);
  const tanggal = date.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric' });
  const jam = date.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.');
  return `${tanggal} · ${jam} WIB`;
}

function IkonWhatsApp({ className = "size-5" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M20.52 3.48A11.9 11.9 0 0 0 12.05 0C5.46 0 .1 5.36.1 11.95c0 2.1.55 4.16 1.6 5.98L0 24l6.23-1.63a11.96 11.96 0 0 0 5.82 1.49h.01c6.58 0 11.94-5.36 11.94-11.95 0-3.2-1.24-6.2-3.48-8.43ZM12.05 21.85a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.7.97.99-3.61-.24-.37a9.87 9.87 0 0 1-1.51-5.3c0-5.48 4.46-9.94 9.94-9.94a9.87 9.87 0 0 1 7.03 2.91 9.87 9.87 0 0 1 2.91 7.03c0 5.48-4.46 9.94-9.94 9.94Zm5.45-7.44c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.27.5 1.7.64.71.22 1.36.19 1.87.12.57-.09 1.77-.73 2.02-1.43.25-.7.25-1.3.17-1.43-.07-.12-.27-.2-.57-.35Z" /></svg>;
}

function HalamanTamu() {
  const { posisiKode } = usePeran();
  const readOnly = posisiKode === 'inspector';
  const { rows, loading, error, refresh } = useTable('guests');
  const transactions = useTable('transactions');
  const notes = useTable('guest_notes');
  const rooms = useTable('rooms');
  const roomTypes = useTable('room_types');
  const packages = useTable('packages');
  const [cari, setCari] = useState('');
  const [urutan, setUrutan] = useState<'nama' | 'terbanyak' | 'tersedikit'>('nama');
  const [open, setOpen] = useState(false);
  const [catatanSaja, setCatatanSaja] = useState(false);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [nama, setNama] = useState('');
  const [alamat, setAlamat] = useState('');
  const [telepon, setTelepon] = useState('');
  const [catatan, setCatatan] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailTamu, setDetailTamu] = useState<Guest | null>(null);
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);
  const [tabDetail, setTabDetail] = useState<'kunjungan' | 'transaksi' | 'booking' | 'catatan'>('kunjungan');
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    setTabDetail('kunjungan');
  }, [detailTamu?.id]);
  const queryText = cari.trim().toLocaleLowerCase('id-ID');
  const queryDigits = normalisasiNomor(cari);
  const hasil = urutTamu(rows.filter(t => t.full_name.toLocaleLowerCase('id-ID').includes(queryText) || (queryDigits.length > 0 && normalisasiNomor(t.phone).includes(queryDigits))), transactions.rows, urutan);
  const transaksiTamu = (id: string) => transactions.rows.filter(t => t.guest_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  const jumlahKunjungan = (id: string) => kunjunganTamu(transactions.rows, id).length;
  const detail = rows.find(t => t.id === detailTamu?.id) ?? detailTamu;
  const riwayat = detail ? transaksiTamu(detail.id) : [];
  const terakhir = detail ? kunjunganTamu(transactions.rows, detail.id).map(t => t.started_at).filter((time): time is string => !!time).sort().at(-1) : undefined;
  const catatanTamu = detail ? notes.rows.filter(n => n.guest_id === detail.id).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || b.id.localeCompare(a.id)) : [];
  const daftarCatatan = catatanTamu.length ? catatanTamu : detail?.notes.trim() ? [{ id: 'legacy', body: detail.notes, author_role: null, author_name: null, created_at: null }] : [];
  const nomorKamar = (id: string) => rooms.rows.find(r => r.id === id)?.room_number ?? '—';
  const tipeKamar = (id: string) => { const kamar = rooms.rows.find(r => r.id === id); return roomTypes.rows.find(t => t.id === kamar?.room_type_id)?.name ?? '—'; };
  const namaPaket = (id: string | null) => packages.rows.find(p => p.id === id)?.name ?? '—';
  const kunjunganList = detail ? kunjunganTamu(transactions.rows, detail.id).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)) : [];
  const bookingList = riwayat.filter(t => t.status === 'booking');
  const barisRiwayat = tabDetail === 'booking' ? bookingList : tabDetail === 'transaksi' ? riwayat : kunjunganList;
  const totalTransaksi = riwayat.reduce((sum, t) => sum + (t.price_snapshot ?? t.base_price_snapshot ?? 0), 0);
  const tipeFavorit = terbanyak(riwayat.map(t => tipeKamar(t.room_id)));
  const paketFavorit = terbanyak(riwayat.map(t => namaPaket(t.package_id)));
  const tamuUmum = riwayat.length ? Math.round(riwayat.reduce((sum, t) => sum + (t.guest_count ?? 0), 0) / riwayat.length) : 0;
  const catatanPreferensi = daftarCatatan[0]?.body ?? '—';

  function edit(t?: Guest, hanyaCatatan = false) {
    setCatatanSaja(hanyaCatatan);
    setEditing(t ?? null); setNama(t?.full_name ?? ''); setAlamat(t?.address ?? ''); setTelepon(t?.phone ?? '');
    setCatatan(''); setMessage(''); setOpen(true);
  }
  function tutup() { setDetailTamu(null); setOpen(false); setEditing(null); setMessage(''); }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving || readOnly) return;
    const match = rows.find(t => t.phone === telepon.trim() && t.id !== editing?.id);
    if (!catatanSaja && match) { setMessage(`Nomor sudah tercatat atas nama ${match.full_name}. Gunakan data tamu tersebut.`); return; }
    if (!catatanSaja && !/^[0-9+]{8,16}$/.test(telepon.trim())) { setMessage('Nomor HP harus 8–16 digit.'); return; }
    if (catatan.trim() && (notes.loading || notes.error)) { setMessage('Riwayat catatan belum dapat diakses. Kosongkan catatan baru untuk menyimpan data tamu saja.'); return; }
    setSaving(true); setMessage('');
    try {
      const payload = { full_name: nama.trim(), address: alamat.trim(), phone: telepon.trim(), ...(!editing ? { notes: catatan.trim() } : catatan.trim() ? { notes: catatan.trim() } : {}) };
      const result = editing ? await supabase.from('guests').update(catatanSaja ? { notes: catatan.trim() } : payload).eq('id', editing.id).select().single() : await supabase.from('guests').insert(payload).select().single();
      if (result.error) setMessage(result.error.code === '23505' ? 'Nomor HP sudah tercatat. Gunakan data tamu tersebut.' : result.error.message);
      else { if (detailTamu && result.data) setDetailTamu(result.data); setOpen(false); setEditing(null); await Promise.all([refresh(), notes.refresh()]); }
    } catch { setMessage('Data belum tersimpan. Silakan coba kembali.'); } finally { setSaving(false); }
  }

  return (
    <Kerangka judul="Daftar Tamu" keterangan={`${rows.length} tamu tercatat`} aksi={!readOnly && <Button className="h-11 shrink-0 gap-2 rounded-xl px-5 text-base" onClick={() => edit()}><Plus className="size-4" /><span className="leading-none">Tambah Tamu</span></Button>}>
      <div className="min-w-0">
      <form onSubmit={e => e.preventDefault()} className="tamu-cari grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-gold/25 bg-navy-deep/70 py-1.5 pl-4 pr-1.5 backdrop-blur-md sm:max-w-md">
        <Search className="size-5 shrink-0 text-foreground/90" aria-hidden="true" />
        <input aria-label="Pencarian tamu" placeholder="Cari Nama atau Nomor Whatsapp...." value={cari} onChange={e => setCari(e.target.value)} className="h-8 w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-gold/50" />
        <Button type="submit" size="sm" className="shrink-0 rounded-full px-4 text-base"><Search className="size-4" />Cari</Button>
      </form>
      </div>
      {loading && <p className="mt-4 text-base">Memuat tamu…</p>}
      {error && <p role="alert" className="mt-4 text-base text-destructive">{error}</p>}
      <div className="tabel-tamu-premium mt-6 w-full min-w-0 overflow-hidden rounded-lg border border-[var(--premium-line)] bg-[var(--premium-paper)] p-2 text-[var(--premium-ink)] shadow-lembut [--muted-foreground:var(--premium-muted)] [--gold:var(--gold-krem)] [--gold-light:var(--gold-krem)] [--siap-foreground:var(--premium-success)] [--border:var(--premium-line)] [--accent:var(--premium-highlight)] [--accent-foreground:var(--premium-ink)] sm:p-3">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[780px] table-fixed border-separate border-spacing-0 text-center text-base [&_th]:text-[13px]">
            <colgroup><col className="w-[6%]" /><col className="w-[28%]" /><col className="w-[18%]" /><col className="w-[15%]" /><col className="w-[16%]" /><col className="w-[17%]" /></colgroup>
            <thead className="whitespace-nowrap bg-[var(--premium-highlight)] text-[13px] font-semibold text-gold"><tr>
              <th className="border-b border-gold/20 px-3 py-3 normal-case">No.</th>
              <th className="pemisah-kolom border-b border-gold/20 px-4 py-3"><Button variant="ghost" size="sm" className="h-9 px-3 text-[13px] text-gold" onClick={() => setUrutan('nama')}>NAMA TAMU</Button></th>
              <th className="pemisah-kolom border-b border-gold/20 px-5 py-3">WHATSAPP</th>
              <th aria-sort={urutan === 'nama' ? 'none' : urutan === 'terbanyak' ? 'descending' : 'ascending'} className="pemisah-kolom border-b border-gold/20 px-4 py-3"><Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2 text-[13px] text-gold" onClick={() => setUrutan(urutan === 'terbanyak' ? 'tersedikit' : 'terbanyak')}>KUNJUNGAN<ArrowDownUp className="size-4 shrink-0" /></Button></th>
              <th className="pemisah-kolom border-b border-gold/20 px-5 py-3">STATUS</th>
              <th className="border-b border-gold/20 px-5 py-3">AKSI</th>
            </tr></thead>
            <tbody>{hasil.map((t, index) => <tr key={t.id} className="h-14 transition-colors hover:bg-gold/[0.04]">
              <td className="border-b border-border/60 px-2 py-3 text-sm tabular-nums text-muted-foreground">{index + 1}</td>
              <td className="pemisah-kolom border-b border-border/60 px-4 py-3 text-left font-semibold"><span className="block truncate" title={t.full_name}>{t.full_name}</span></td>
              <td className="pemisah-kolom whitespace-nowrap border-b border-border/60 px-4 py-3 font-mono text-base tabular-nums">xxxx{empatDigitWA(t.phone)}</td>
              <td className="pemisah-kolom border-b border-border/60 px-4 py-3 tabular-nums">{transactions.loading ? '—' : jumlahKunjungan(t.id)}</td>
              <td className="pemisah-kolom border-b border-border/60 px-2 py-3"><span className="tamu-status-pill text-xs text-muted-foreground" title="Status Active/Blocked belum tersedia pada data tamu">Belum tersedia</span></td>
              <td className="border-b border-border/60 px-2 py-2"><div className="tamu-aksi flex justify-center gap-0">
                <Button size="icon" variant="ghost" className="size-10 text-gold-light" title={`Lihat detail ${t.full_name}`} aria-label={`Lihat detail ${t.full_name}`} onClick={event => { detailTrigger.current = event.currentTarget; setOpen(false); setDetailTamu(t); }}><Eye className="size-[21px]!" /></Button>
                {!readOnly && <Button size="icon" variant="ghost" className="size-10 text-siap-foreground" title={`WhatsApp ${t.full_name}`} aria-label={`WhatsApp ${t.full_name}`} onClick={() => openWhatsApp(t.phone)}><IkonWhatsApp className="size-[21px]!" /></Button>}
                 {!readOnly && <Button size="icon" variant="ghost" className="size-10 text-gold-light" title={`Tambah catatan ${t.full_name}`} aria-label={`Tambah catatan ${t.full_name}`} onClick={event => { detailTrigger.current = event.currentTarget; setDetailTamu(t); edit(t, true); }}><NotebookPen className="size-[21px]!" /></Button>}
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
        {!loading && !hasil.length && <p className="px-4 py-10 text-center text-base text-muted-foreground">Tamu tidak ditemukan.</p>}
      </div>
      <Dialog.Root open={(!!detail || open) && !detailTransactionId} onOpenChange={value => { if (!value && !saving && !detailTransactionId) tutup(); }}>
        <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-navy-deep/75 backdrop-blur-sm" />
          <Dialog.Content aria-describedby={undefined} onCloseAutoFocus={event => { if (detailTransactionId) { event.preventDefault(); return; } if (detailTrigger.current?.isConnected) { event.preventDefault(); detailTrigger.current.focus(); } }} className={open ? "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[720px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-gold/30 bg-background text-base shadow-lembut" : "detail-tamu-popup fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[1000px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto text-base"}>
            {open ? <header className="relative isolate overflow-hidden border-b border-gold/20 bg-navy-deep px-5 py-4 sm:px-7 sm:py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0"><p className="text-[10px] font-semibold text-gold">BATURADEN 25 HOMESTAY</p>
                <Dialog.Title className="mt-1.5 font-serif text-3xl leading-tight text-foreground sm:text-4xl">{catatanSaja ? 'Tambah Catatan' : editing ? 'Perbarui Data' : 'Tambah Tamu'}</Dialog.Title></div>
              </div>
            </header> : <header className="dt-header">
              <div className="dt-judul"><BedDouble aria-hidden="true" /><Dialog.Title asChild><h2>Detail Tamu</h2></Dialog.Title></div>
              <Dialog.Close asChild><button type="button" className="dt-tutup-ikon" aria-label="Tutup detail tamu"><X className="size-5" /></button></Dialog.Close>
            </header>}
            {open && !readOnly ? <form onSubmit={save}>
              <div className="space-y-5 p-5 sm:p-7">
                {!catatanSaja && <div className="grid gap-4 sm:grid-cols-2">{([['Nama lengkap', nama, setNama], ['Nomor HP/WhatsApp', telepon, setTelepon], ['Alamat', alamat, setAlamat]] as const).map(([label, value, setter]) => <label key={label} className={`block min-w-0 text-base ${label === 'Alamat' ? 'sm:col-span-2' : ''}`}><span className="font-medium text-gold-light">{label}</span><input required value={value} onChange={e => setter(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-input bg-navy-deep/50 px-3 text-base outline-none focus-visible:ring-1 focus-visible:ring-gold/50" /></label>)}</div>}
                <label className="block text-base"><span className="font-medium text-gold-light">{editing ? 'Tambah Catatan' : 'Catatan'}</span><textarea required={catatanSaja} autoFocus={catatanSaja} value={catatan} onChange={e => setCatatan(e.target.value)} className="mt-2 min-h-28 w-full rounded-lg border border-input bg-navy-deep/50 px-3 py-3 text-base outline-none focus-visible:ring-1 focus-visible:ring-gold/50" /></label>
                {notes.error && <p className="text-sm text-muted-foreground">Riwayat catatan belum tersedia. Data lama tetap dipertahankan.</p>}
                {message && <p role="alert" className="text-base text-destructive">{message}</p>}
              </div>
              <footer className="flex flex-wrap justify-end gap-3 border-t border-gold/20 bg-navy-deep/50 px-5 py-4 sm:px-7"><Button type="button" variant="outline" className="h-11 text-base" disabled={saving} onClick={() => { setOpen(false); setEditing(null); if (!detail) tutup(); }}>Batal</Button><Button type="submit" className="h-11 text-base" disabled={saving}>{saving ? 'Menyimpan…' : catatanSaja ? 'Simpan Catatan' : 'Simpan'}</Button></footer>
            </form> : detail && <>
              <div className="dt-tamu">
                <span className="dt-avatar"><UserRound aria-hidden="true" /></span>
                <div className="dt-identitas">
                  <h3>{detail.full_name.toUpperCase()} · {empatDigitWA(detail.phone)}</h3>
                  <p className="dt-telepon"><IkonWhatsApp className="size-[19px]" />{detail.phone}</p>
                  <span className="dt-pill-status" title="Status Active/Blocked belum tersedia pada data tamu">Belum tersedia</span>
                </div>
                <div className="dt-statistik">
                  <div className="dt-stat"><span className="dt-stat-ikon"><BedDouble aria-hidden="true" /></span><div><p>Total Kunjungan</p><strong>{transactions.loading ? '…' : `${jumlahKunjungan(detail.id)} Kali`}</strong></div></div>
                  <div className="dt-stat"><span className="dt-stat-ikon"><FileText aria-hidden="true" /></span><div><p>Total Transaksi</p><strong>{transactions.loading ? '…' : rupiah(totalTransaksi)}</strong></div></div>
                  <div className="dt-stat"><span className="dt-stat-ikon"><CalendarDays aria-hidden="true" /></span><div><p>Kunjungan Terakhir</p><strong>{terakhir ? tanggalPendekWib(terakhir) : '—'}</strong></div></div>
                </div>
              </div>
              <section className="dt-bagian">
                <h3 className="dt-bagian-judul"><Info aria-hidden="true" />Informasi Tamu</h3>
                <dl className="dt-info-grid">
                  <div><dt>Nama Lengkap</dt><dd>{detail.full_name.toUpperCase()}</dd></div>
                  <div><dt>No. HP / WhatsApp</dt><dd><span className="dt-telepon-inline"><IkonWhatsApp className="size-[17px]" />{detail.phone}</span></dd></div>
                  <div><dt>No. Whatsapp</dt><dd className="dt-tebal">{detail.phone || '—'}</dd></div>
                  <div><dt>Email</dt><dd>—</dd></div>
                  <div><dt>Alamat</dt><dd>{detail.address || '—'}</dd></div>
                  <div><dt>Catatan</dt><dd>{catatanPreferensi}</dd></div>
                </dl>
              </section>
              <section className="dt-bagian">
                <h3 className="dt-bagian-judul"><Layers aria-hidden="true" />Preferensi &amp; Riwayat Umum</h3>
                <div className="dt-pref">
                  <div className="dt-pref-item"><span className="dt-pref-ikon"><BedDouble aria-hidden="true" /></span><div><p>Tipe Favorit</p><strong>{tipeFavorit}</strong></div></div>
                  <div className="dt-pref-item"><span className="dt-pref-ikon"><Layers aria-hidden="true" /></span><div><p>Paket Favorit</p><strong>{paketFavorit}</strong></div></div>
                  <div className="dt-pref-item"><span className="dt-pref-ikon"><Users aria-hidden="true" /></span><div><p>Jumlah Tamu Umum</p><strong>{tamuUmum ? `${tamuUmum} Orang` : '—'}</strong></div></div>
                  <div className="dt-pref-item"><span className="dt-pref-ikon"><NotebookPen aria-hidden="true" /></span><div><p>Catatan Preferensi</p><strong>{catatanPreferensi}</strong></div></div>
                </div>
              </section>
              <div className="dt-tab-bar" role="tablist" aria-label="Riwayat tamu">
                <button type="button" role="tab" aria-selected={tabDetail === 'kunjungan'} data-aktif={tabDetail === 'kunjungan'} className="dt-tab" onClick={() => setTabDetail('kunjungan')}><Clock aria-hidden="true" />Riwayat Kunjungan ({kunjunganList.length})</button>
                <button type="button" role="tab" aria-selected={tabDetail === 'transaksi'} data-aktif={tabDetail === 'transaksi'} className="dt-tab" onClick={() => setTabDetail('transaksi')}><Layers aria-hidden="true" />Riwayat Transaksi</button>
                <button type="button" role="tab" aria-selected={tabDetail === 'booking'} data-aktif={tabDetail === 'booking'} className="dt-tab" onClick={() => setTabDetail('booking')}><CalendarDays aria-hidden="true" />Riwayat Booking</button>
                <button type="button" role="tab" aria-selected={tabDetail === 'catatan'} data-aktif={tabDetail === 'catatan'} className="dt-tab" onClick={() => setTabDetail('catatan')}><NotebookPen aria-hidden="true" />Catatan</button>
              </div>
              {tabDetail === 'catatan' ? <>
                {notes.error && <p className="dt-kosong">Riwayat catatan belum dapat dimuat; catatan terakhir tetap ditampilkan.</p>}
                {daftarCatatan.length ? <ul className="dt-catatan-list">{daftarCatatan.map(note => <li key={note.id} className="dt-catatan-item"><p>{note.body}</p><p className="dt-catatan-meta">{pembuatCatatan(note.author_role, note.author_name)} · {note.created_at ? waktuCatatanWib(note.created_at) : 'Waktu tidak diketahui'}</p></li>)}</ul> : !notes.error && <p className="dt-kosong">Belum ada catatan tamu</p>}
              </> : <>
                {transactions.error && <p role="alert" className="dt-kosong">Riwayat transaksi belum dapat dimuat.</p>}
                {barisRiwayat.length ? <div className="dt-tabel-wrap"><table className="dt-tabel">
                  <thead><tr><th>No.</th><th>Tgl Kunjungan</th><th>No. Transaksi</th><th>Kamar</th><th>Tipe</th><th>Paket</th><th>Check-in</th><th>Check-out</th><th>Total</th><th>Status</th><th aria-label="Struk" /></tr></thead>
                  <tbody>{barisRiwayat.map((tr, index) => <tr key={tr.id}>
                    <td className="dt-nomor">{index + 1}</td>
                    <td>{tanggalPendekWib(tr.started_at ?? tr.created_at)}</td>
                    <td className="dt-mono">{tr.transaction_number}</td>
                    <td><span className="dt-kamar-pill">{nomorKamar(tr.room_id)}</span></td>
                    <td>{tipeKamar(tr.room_id)}</td>
                    <td>{namaPaket(tr.package_id)}</td>
                    <td>{tr.started_at ? jamWib(tr.started_at) : '—'}</td>
                    <td>{tr.checked_out_at ?? tr.ends_at ? jamWib((tr.checked_out_at ?? tr.ends_at) as string) : '—'}</td>
                    <td>{rupiah(tr.price_snapshot ?? tr.base_price_snapshot ?? 0)}</td>
                    <td><span className="dt-status" data-state={tr.status}>{tr.status === 'check_out' && <CircleCheck aria-hidden="true" />}{statusTransaksi[tr.status] ?? tr.status}</span></td>
                    <td><button type="button" className="dt-struk" aria-label={`Detail transaksi ${tr.transaction_number}`} onClick={() => setDetailTransactionId(tr.id)}><ReceiptText aria-hidden="true" /></button></td>
                  </tr>)}</tbody>
                </table></div> : !transactions.loading && !transactions.error && <p className="dt-kosong">{tabDetail === 'booking' ? 'Belum ada riwayat booking' : 'Belum ada riwayat transaksi'}</p>}
              </>}
              <footer className="dt-footer">
                <div className="dt-footer-kiri">
                  {!readOnly && <button type="button" className="dt-tombol" onClick={() => edit(detail)}><Pencil aria-hidden="true" />Perbarui Data</button>}
                  {!readOnly && <button type="button" className="dt-tombol" onClick={() => openWhatsApp(detail.phone)}><IkonWhatsApp className="size-[18px]" />Hubungi</button>}
                </div>
                <button type="button" className="dt-tutup" onClick={tutup}>Tutup</button>
              </footer>
            </>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {detailTransactionId && <DetailTransaksi transactionId={detailTransactionId} mode={posisiKode === 'housekeeping' ? 'housekeeping' : 'full'} onClose={() => setDetailTransactionId(null)} />}
    </Kerangka>
  );
}
