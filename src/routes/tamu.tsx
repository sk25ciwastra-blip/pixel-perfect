import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Eye, X, Search, Plus, ArrowDownUp, Pencil, UserRound, NotebookPen, History, MapPin, CalendarDays, Users, ChevronRight } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { Kerangka } from '@/components/kerangka';
import { Button } from '@/components/ui/button';
import { useTable, type Guest } from '@/lib/data-live';
import { supabase } from '@/integrations/supabase/client';
import { meta } from '@/lib/meta';
import { usePeran } from '@/lib/peran';
import { openWhatsApp } from '@/lib/whatsapp';
import { DetailTransaksi } from '@/components/detail-transaksi';
import { empatDigitWA, kunjunganTamu, urutTamu } from '@/lib/tamu-tampilan';
import gedungSate from '@/assets/gedung-sate-malam.jpg';

export const Route = createFileRoute('/tamu')({
  head: () => meta('Daftar Tamu', 'Data tamu dan pencarian nama atau nomor HP Baturaden 25 Homestay.'),
  component: HalamanTamu,
});
function normalisasiNomor(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('62') ? '0' + digits.slice(2) : digits;
}
function tanggalWib(value: string) {
  return new Date(value).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' });
}
function waktuWib(value: string) {
  return new Date(value).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' WIB';
}
const statusTransaksi: Record<string, string> = { booking: 'BOOKING', check_in: 'CHECK-IN', check_out: 'SELESAI', cancelled: 'DIBATALKAN' };

function IkonWhatsApp({ className = "size-5" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true"><path d="M20.52 3.48A11.9 11.9 0 0 0 12.05 0C5.46 0 .1 5.36.1 11.95c0 2.1.55 4.16 1.6 5.98L0 24l6.23-1.63a11.96 11.96 0 0 0 5.82 1.49h.01c6.58 0 11.94-5.36 11.94-11.95 0-3.2-1.24-6.2-3.48-8.43ZM12.05 21.85a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.7.97.99-3.61-.24-.37a9.87 9.87 0 0 1-1.51-5.3c0-5.48 4.46-9.94 9.94-9.94a9.87 9.87 0 0 1 7.03 2.91 9.87 9.87 0 0 1 2.91 7.03c0 5.48-4.46 9.94-9.94 9.94Zm5.45-7.44c-.3-.15-1.77-.87-2.04-.97-.28-.1-.48-.15-.68.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49s1.07 2.89 1.22 3.09c.15.2 2.1 3.2 5.08 4.49.71.31 1.27.5 1.7.64.71.22 1.36.19 1.87.12.57-.09 1.77-.73 2.02-1.43.25-.7.25-1.3.17-1.43-.07-.12-.27-.2-.57-.35Z" /></svg>;
}

function InformasiTamu({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return <div className="flex min-w-0 items-end gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg border border-gold/25 bg-primary-soft/30 text-gold"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><dt className="mb-1 text-xs text-muted-foreground">{label}</dt><dd className="min-h-10 rounded-lg border border-gold/25 bg-navy-deep/60 px-3 py-2 text-sm font-medium leading-relaxed break-words">{value}</dd></div></div>;
}

function HalamanTamu() {
  const { posisiKode } = usePeran();
  const readOnly = posisiKode === 'inspector';
  const { rows, loading, error, refresh } = useTable('guests');
  const transactions = useTable('transactions');
  const notes = useTable('guest_notes');
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
  const [semuaTransaksi, setSemuaTransaksi] = useState(false);
  const [semuaCatatan, setSemuaCatatan] = useState(false);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    setSemuaTransaksi(false);
    setSemuaCatatan(false);
  }, [detailTamu?.id]);
  const queryText = cari.trim().toLocaleLowerCase('id-ID');
  const queryDigits = normalisasiNomor(cari);
  const hasil = urutTamu(rows.filter(t => t.full_name.toLocaleLowerCase('id-ID').includes(queryText) || (queryDigits.length > 0 && normalisasiNomor(t.phone).includes(queryDigits))), transactions.rows, urutan);
  const transaksiTamu = (id: string) => transactions.rows.filter(t => t.guest_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  const jumlahKunjungan = (id: string) => kunjunganTamu(transactions.rows, id).length;
  const detail = rows.find(t => t.id === detailTamu?.id) ?? detailTamu;
  const riwayat = detail ? transaksiTamu(detail.id) : [];
  const pertama = detail ? kunjunganTamu(transactions.rows, detail.id).map(t => t.started_at).filter((time): time is string => !!time).sort().at(0) : undefined;
  const terakhir = detail ? kunjunganTamu(transactions.rows, detail.id).map(t => t.started_at).filter((time): time is string => !!time).sort().at(-1) : undefined;
  const catatanTamu = detail ? notes.rows.filter(n => n.guest_id === detail.id).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || b.id.localeCompare(a.id)) : [];
  const daftarCatatan = catatanTamu.length ? catatanTamu : detail?.notes.trim() ? [{ id: 'legacy', body: detail.notes, author_role: null, author_name: null, created_at: null }] : [];

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
      <form onSubmit={e => e.preventDefault()} className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-full border border-gold/25 bg-navy-deep/70 py-1.5 pl-4 pr-1.5 backdrop-blur-md sm:max-w-md">
        <Search className="size-5 shrink-0 text-foreground/90" aria-hidden="true" />
        <input aria-label="Pencarian tamu" placeholder="Cari Nama atau Nomor Whatsapp...." value={cari} onChange={e => setCari(e.target.value)} className="h-8 w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-gold/50" />
        <Button type="submit" size="sm" className="shrink-0 rounded-full px-4 text-base"><Search className="size-4" />Cari</Button>
      </form>
      </div>
      {loading && <p className="mt-4 text-base">Memuat tamu…</p>}
      {error && <p role="alert" className="mt-4 text-base text-destructive">{error}</p>}
      <div className="panel-mewah mt-6 w-full min-w-0 overflow-hidden p-2 sm:p-3">
        <div className="max-w-full overflow-x-auto">
          <table className="w-full min-w-[780px] table-fixed border-separate border-spacing-0 text-center text-base [&_th]:text-[13px]">
            <colgroup><col className="w-[6%]" /><col className="w-[28%]" /><col className="w-[18%]" /><col className="w-[15%]" /><col className="w-[16%]" /><col className="w-[17%]" /></colgroup>
            <thead className="whitespace-nowrap bg-navy-deep/60 text-[13px] font-semibold text-gold"><tr>
              <th className="border-b border-gold/20 px-2 py-2 normal-case">No.</th>
              <th className="pemisah-kolom border-b border-gold/20 px-3 py-2"><Button variant="ghost" size="sm" className="h-9 px-2 text-[13px] text-gold" onClick={() => setUrutan('nama')}>NAMA TAMU</Button></th>
              <th className="pemisah-kolom border-b border-gold/20 px-4 py-2">WHATSAPP</th>
              <th aria-sort={urutan === 'nama' ? 'none' : urutan === 'terbanyak' ? 'descending' : 'ascending'} className="pemisah-kolom border-b border-gold/20 px-3 py-2"><Button variant="ghost" size="sm" className="h-9 gap-1.5 px-1 text-[13px] text-gold" onClick={() => setUrutan(urutan === 'terbanyak' ? 'tersedikit' : 'terbanyak')}>KUNJUNGAN<ArrowDownUp className="size-4 shrink-0" /></Button></th>
              <th className="pemisah-kolom border-b border-gold/20 px-3 py-2">STATUS</th>
              <th className="border-b border-gold/20 px-4 py-2">AKSI</th>
            </tr></thead>
            <tbody>{hasil.map((t, index) => <tr key={t.id} className="h-14 transition-colors hover:bg-gold/[0.04]">
              <td className="border-b border-border/60 px-2 py-3 text-sm tabular-nums text-muted-foreground">{index + 1}</td>
              <td className="pemisah-kolom border-b border-border/60 px-4 py-3 text-left font-semibold"><span className="block truncate" title={t.full_name}>{t.full_name}</span></td>
              <td className="pemisah-kolom whitespace-nowrap border-b border-border/60 px-4 py-3 font-mono text-base tabular-nums">xxxx{empatDigitWA(t.phone)}</td>
              <td className="pemisah-kolom border-b border-border/60 px-4 py-3 tabular-nums">{transactions.loading ? '—' : jumlahKunjungan(t.id)}</td>
              <td className="pemisah-kolom border-b border-border/60 px-2 py-3"><span className="text-xs text-muted-foreground" title="Status Active/Blocked belum tersedia pada data tamu">Belum tersedia</span></td>
              <td className="border-b border-border/60 px-2 py-2"><div className="flex justify-center gap-0">
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
          <Dialog.Content aria-describedby={undefined} onCloseAutoFocus={event => { if (detailTransactionId) { event.preventDefault(); return; } if (detailTrigger.current?.isConnected) { event.preventDefault(); detailTrigger.current.focus(); } }} className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-gold/30 bg-background text-base shadow-lembut">
            <header className="relative isolate overflow-hidden border-b border-gold/20 bg-navy-deep px-5 py-6 sm:px-7 sm:py-7">
              <img src={gedungSate} alt="" className="pointer-events-none absolute inset-y-0 right-0 -z-20 h-full w-3/5 object-cover opacity-30" />
              <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-navy-deep via-navy-deep/85 to-navy-deep/30" />
              <p className="pr-10 text-[10px] font-semibold text-gold">BATURADEN 25 HOMESTAY</p>
              <Dialog.Title className="mt-2 pr-10 font-serif text-3xl leading-tight text-foreground sm:text-4xl">{open ? catatanSaja ? 'Tambah Catatan' : editing ? 'Perbaharui Data' : 'Tambah Tamu' : 'Detail Tamu'}</Dialog.Title>
              <p className="mt-2 break-words pr-8 text-sm text-muted-foreground">{editing ? `${editing.full_name} • ${editing.phone}` : detail ? `${detail.full_name} • ${detail.phone}` : 'Data tamu baru'}</p>
              <Button variant="ghost" size="icon" className="absolute right-3 top-3 text-gold-light" aria-label="Tutup detail tamu" disabled={saving} onClick={tutup}><X className="size-5" /></Button>
            </header>
            {open && !readOnly ? <form onSubmit={save}>
              <div className="space-y-5 p-5 sm:p-7">
                {!catatanSaja && <div className="grid gap-4 sm:grid-cols-2">{([['Nama lengkap', nama, setNama], ['Nomor HP/WhatsApp', telepon, setTelepon], ['Alamat', alamat, setAlamat]] as const).map(([label, value, setter]) => <label key={label} className={`block min-w-0 text-base ${label === 'Alamat' ? 'sm:col-span-2' : ''}`}><span className="font-medium text-gold-light">{label}</span><input required value={value} onChange={e => setter(e.target.value)} className="mt-2 h-12 w-full rounded-lg border border-input bg-navy-deep/50 px-3 text-base outline-none focus-visible:ring-1 focus-visible:ring-gold/50" /></label>)}</div>}
                <label className="block text-base"><span className="font-medium text-gold-light">{editing ? 'Tambah Catatan' : 'Catatan'}</span><textarea required={catatanSaja} autoFocus={catatanSaja} value={catatan} onChange={e => setCatatan(e.target.value)} className="mt-2 min-h-28 w-full rounded-lg border border-input bg-navy-deep/50 px-3 py-3 text-base outline-none focus-visible:ring-1 focus-visible:ring-gold/50" /></label>
                {notes.error && <p className="text-sm text-muted-foreground">Riwayat catatan belum tersedia. Data lama tetap dipertahankan.</p>}
                {message && <p role="alert" className="text-base text-destructive">{message}</p>}
              </div>
              <footer className="flex flex-wrap justify-end gap-3 border-t border-gold/20 bg-navy-deep/50 px-5 py-4 sm:px-7"><Button type="button" variant="outline" className="h-11 text-base" disabled={saving} onClick={() => { setOpen(false); setEditing(null); if (!detail) tutup(); }}>Batal</Button><Button type="submit" className="h-11 text-base" disabled={saving}>{saving ? 'Menyimpan…' : catatanSaja ? 'Simpan Catatan' : 'Simpan'}</Button></footer>
            </form> : detail && <>
              <div className="space-y-3 p-4 sm:p-5">
                <section className="rounded-xl border border-gold/30 bg-navy-deep/35 p-4">
                  <h3 className="flex items-center gap-2 border-b border-gold/20 pb-3 text-sm font-semibold text-gold"><UserRound className="size-5" />INFORMASI TAMU</h3>
                  <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <InformasiTamu label="Nama Tamu" value={detail.full_name} icon={UserRound} />
                    <InformasiTamu label="Total Kunjungan" value={transactions.loading ? 'Memuat…' : `${jumlahKunjungan(detail.id)} kali`} icon={Users} />
                    <InformasiTamu label="Nomor WhatsApp" value={detail.phone} icon={IkonWhatsApp} />
                    <InformasiTamu label="Kunjungan Pertama" value={pertama ? tanggalWib(pertama) : 'Belum tersedia'} icon={CalendarDays} />
                    <InformasiTamu label="Alamat" value={detail.address || '—'} icon={MapPin} />
                    <InformasiTamu label="Kunjungan Terakhir" value={terakhir ? tanggalWib(terakhir) : 'Belum tersedia'} icon={CalendarDays} />
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">Terdaftar {tanggalWib(detail.created_at)}</p>
                </section>
                <div className="grid min-w-0 gap-3">
                  <section className="min-w-0 rounded-xl border border-gold/30 bg-navy-deep/35 p-4"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-gold/20 pb-3"><h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gold"><NotebookPen className="size-5" />Catatan Tamu</h3>{daftarCatatan.length > 1 && <Button variant="ghost" size="sm" className="h-8 px-2 text-sm text-gold-light" onClick={() => setSemuaCatatan(!semuaCatatan)}>{semuaCatatan ? 'Ringkas' : 'Lihat Semua'}</Button>}</div>
                    {notes.error && <p className="mt-3 text-sm text-muted-foreground">Riwayat catatan belum dapat dimuat; catatan terakhir tetap ditampilkan.</p>}
                    <ul className={`mt-1 divide-y divide-border/60 ${semuaCatatan ? 'max-h-56 overflow-y-auto pr-3' : ''}`}>{(semuaCatatan ? daftarCatatan : daftarCatatan.slice(0, 1)).map(note => <li key={note.id} className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_190px] sm:items-center"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{note.body}</p><p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs sm:border-l sm:border-gold/20 sm:pl-3 leading-relaxed text-muted-foreground">{note.author_role && <span className="rounded border border-gold/25 px-1.5 py-0.5 text-gold">{note.author_role}</span>}<span className="break-words">{note.author_name ?? 'Pembuat tidak diketahui'}</span><span>•</span><span>{note.created_at ? waktuWib(note.created_at) : 'Waktu tidak diketahui'}</span></p></li>)}</ul>
                    {!daftarCatatan.length && <p className="mt-3 text-base text-muted-foreground">Belum ada catatan tamu</p>}
                  </section>
                  <section className="min-w-0 rounded-xl border border-gold/30 bg-navy-deep/35 p-4"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-gold/20 pb-3"><h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-gold"><History className="size-5" />Riwayat Transaksi</h3>{riwayat.length > 2 && <Button variant="ghost" size="sm" className="h-8 px-2 text-sm text-gold-light" onClick={() => setSemuaTransaksi(!semuaTransaksi)}>{semuaTransaksi ? 'Ringkas' : 'Lihat Semua'}</Button>}</div>
                    {transactions.error && <p role="alert" className="mt-3 text-sm text-destructive">Riwayat transaksi belum dapat dimuat.</p>}
                    <ul className={`mt-1 divide-y divide-border/60 ${semuaTransaksi ? 'max-h-56 overflow-y-auto pr-3' : ''}`}>{(semuaTransaksi ? riwayat : riwayat.slice(0, 2)).map(tr => <li key={tr.id} className="flex items-center gap-3 py-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg border border-gold/20 bg-primary-soft/20 text-gold"><History className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><Button type="button" variant="link" className="h-auto whitespace-normal break-all p-0 text-left font-mono text-sm text-primary" onClick={() => setDetailTransactionId(tr.id)}>{tr.transaction_number}</Button><span className="text-xs text-muted-foreground">•</span><span className="text-xs font-medium">{statusTransaksi[tr.status] ?? tr.status}</span></div><p className="mt-1 text-xs text-muted-foreground">{waktuWib(tr.created_at)}</p></div><Button size="icon" variant="ghost" className="size-8 shrink-0 text-gold-light" aria-label={`Detail transaksi ${tr.transaction_number}`} onClick={() => setDetailTransactionId(tr.id)}><ChevronRight className="size-4" /></Button></li>)}</ul>
                    {!transactions.loading && !transactions.error && !riwayat.length && <p className="mt-3 text-base text-muted-foreground">Belum ada riwayat transaksi</p>}
                  </section>
                </div>
              </div>
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/20 bg-navy-deep/50 px-4 py-4 sm:px-5">{!readOnly && <><Button variant="outline" className="h-11 gap-2 text-sm text-gold-light" onClick={() => openWhatsApp(detail.phone)}><IkonWhatsApp />WhatsApp</Button><Button className="h-11 gap-2 text-sm" onClick={() => edit(detail)}><Pencil className="size-4" />Perbaharui Data</Button></>}</footer>
            </>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {detailTransactionId && <DetailTransaksi transactionId={detailTransactionId} mode={posisiKode === 'housekeeping' ? 'housekeeping' : 'full'} onClose={() => setDetailTransactionId(null)} />}
    </Kerangka>
  );
}
