import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Eye, X, Search, Plus, ArrowDownUp, Pencil } from 'lucide-react';
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

function HalamanTamu() {
  const { posisiKode } = usePeran();
  const readOnly = posisiKode === 'inspector';
  const { rows, loading, error, refresh } = useTable('guests');
  const transactions = useTable('transactions');
  const notes = useTable('guest_notes');
  const [cari, setCari] = useState('');
  const [urutan, setUrutan] = useState<'nama' | 'terbanyak' | 'tersedikit'>('nama');
  const [open, setOpen] = useState(false);
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
  const terakhir = detail ? kunjunganTamu(transactions.rows, detail.id).map(t => t.started_at).filter((time): time is string => !!time).sort().at(-1) : undefined;
  const catatanTamu = detail ? notes.rows.filter(n => n.guest_id === detail.id).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '') || b.id.localeCompare(a.id)) : [];
  const daftarCatatan = catatanTamu.length ? catatanTamu : detail?.notes.trim() ? [{ id: 'legacy', body: detail.notes, author_role: null, author_name: null, created_at: null }] : [];

  function edit(t?: Guest) {
    setEditing(t ?? null); setNama(t?.full_name ?? ''); setAlamat(t?.address ?? ''); setTelepon(t?.phone ?? '');
    setCatatan(''); setMessage(''); setOpen(true);
  }
  function tutup() { setDetailTamu(null); setOpen(false); setEditing(null); setMessage(''); }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (saving || readOnly) return;
    const match = rows.find(t => t.phone === telepon.trim() && t.id !== editing?.id);
    if (match) { setMessage(`Nomor sudah tercatat atas nama ${match.full_name}. Gunakan data tamu tersebut.`); return; }
    if (!/^[0-9+]{8,16}$/.test(telepon.trim())) { setMessage('Nomor HP harus 8–16 digit.'); return; }
    if (catatan.trim() && (notes.loading || notes.error)) { setMessage('Riwayat catatan belum dapat diakses. Kosongkan catatan baru untuk menyimpan data tamu saja.'); return; }
    setSaving(true); setMessage('');
    try {
      const payload = { full_name: nama.trim(), address: alamat.trim(), phone: telepon.trim(), ...(!editing ? { notes: catatan.trim() } : catatan.trim() ? { notes: catatan.trim() } : {}) };
      const result = editing ? await supabase.from('guests').update(payload).eq('id', editing.id).select().single() : await supabase.from('guests').insert(payload).select().single();
      if (result.error) setMessage(result.error.code === '23505' ? 'Nomor HP sudah tercatat. Gunakan data tamu tersebut.' : result.error.message);
      else { if (detailTamu && result.data) setDetailTamu(result.data); setOpen(false); setEditing(null); await Promise.all([refresh(), notes.refresh()]); }
    } catch { setMessage('Data belum tersimpan. Silakan coba kembali.'); } finally { setSaving(false); }
  }

  return (
    <Kerangka judul="Daftar Tamu" keterangan={`${rows.length} tamu tercatat`} aksi={!readOnly && <Button className="h-11 shrink-0 gap-2 rounded-xl px-5" onClick={() => edit()}><Plus className="size-4" /><span>Tambah Tamu</span></Button>}>
      <form onSubmit={e => e.preventDefault()} className="flex w-full min-w-0 items-center gap-2 rounded-full border border-gold/25 bg-navy-deep/70 py-1.5 pl-4 pr-1.5 backdrop-blur-md sm:max-w-md">
        <Search className="size-4 shrink-0 text-foreground/90" aria-hidden="true" />
        <input aria-label="Pencarian tamu" placeholder="Cari Nama atau Nomor Whatsapp...." value={cari} onChange={e => setCari(e.target.value)} className="h-8 w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-gold/50" />
        <Button type="submit" size="sm" className="shrink-0 rounded-full px-4"><Search className="size-4" />Cari</Button>
      </form>
      {loading && <p className="mt-4 text-sm">Memuat tamu…</p>}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <div className="panel-mewah mt-5 overflow-hidden p-2 sm:p-3">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-separate border-spacing-0 text-center text-xs sm:text-sm">
            <colgroup><col /><col className="w-[76px] sm:w-[120px]" /><col className="w-[84px] sm:w-[140px]" /><col className="w-[80px] sm:w-[104px]" /></colgroup>
            <thead className="text-[10px] font-semibold text-gold sm:text-xs"><tr>
              <th className="pemisah-kolom border-b border-gold/20 py-2"><Button variant="ghost" size="sm" className="h-8 w-full px-1 text-[10px] text-gold sm:text-xs" onClick={() => setUrutan('nama')}>NAMA TAMU</Button></th>
              <th className="pemisah-kolom border-b border-gold/20 py-2">WA</th>
              <th aria-sort={urutan === 'nama' ? 'none' : urutan === 'terbanyak' ? 'descending' : 'ascending'} className="pemisah-kolom border-b border-gold/20 py-2"><Button variant="ghost" size="sm" className="h-8 w-full gap-1 px-0 text-[10px] text-gold sm:text-xs" onClick={() => setUrutan(urutan === 'terbanyak' ? 'tersedikit' : 'terbanyak')}>KUNJUNGAN<ArrowDownUp className="size-3 shrink-0" /></Button></th>
              <th className="border-b border-gold/20 py-2">AKSI</th>
            </tr></thead>
            <tbody>{hasil.map(t => <tr key={t.id} className="hover:bg-gold/[0.04]">
              <td className="pemisah-kolom border-b border-border/60 px-2 py-2.5 text-left font-semibold"><span className="block break-words">{t.full_name}</span></td>
              <td className="pemisah-kolom whitespace-nowrap border-b border-border/60 px-1 py-2.5 font-mono text-[10px] tabular-nums sm:text-xs">•••• {empatDigitWA(t.phone)}</td>
              <td className="pemisah-kolom border-b border-border/60 px-1 py-2.5 tabular-nums">{transactions.loading ? '—' : jumlahKunjungan(t.id)}</td>
              <td className="border-b border-border/60 px-1 py-2"><div className="flex justify-center gap-1">
                <Button size="icon" variant="ghost" className="size-8 text-gold-light" title={`Lihat detail ${t.full_name}`} aria-label={`Lihat detail ${t.full_name}`} onClick={event => { detailTrigger.current = event.currentTarget; setOpen(false); setDetailTamu(t); }}><Eye className="size-4" /></Button>
                {!readOnly && <Button size="icon" variant="ghost" className="size-8 text-siap-foreground" title={`WhatsApp ${t.full_name}`} aria-label={`WhatsApp ${t.full_name}`} onClick={() => openWhatsApp(t.phone)}><MessageCircle className="size-4" /></Button>}
              </div></td>
            </tr>)}</tbody>
          </table>
        </div>
        {!loading && !hasil.length && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Tamu tidak ditemukan.</p>}
      </div>
      <Dialog.Root open={(!!detail || open) && !detailTransactionId} onOpenChange={value => { if (!value && !saving && !detailTransactionId) tutup(); }}>
        <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-navy-deep/75 backdrop-blur-sm" />
          <Dialog.Content aria-describedby={undefined} onCloseAutoFocus={event => { if (detailTransactionId) { event.preventDefault(); return; } if (detailTrigger.current?.isConnected) { event.preventDefault(); detailTrigger.current.focus(); } }} className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-gold/20 bg-background p-5 shadow-lembut sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-gold">{open ? editing ? 'Perbaharui Data' : 'Tambah Tamu' : 'Detail Tamu'}</p><Dialog.Title className="mt-1 break-words font-serif text-xl text-gold-light sm:text-2xl">{open ? editing?.full_name ?? 'Tambah Tamu' : detail?.full_name}</Dialog.Title></div><Button variant="ghost" size="icon" aria-label="Tutup detail tamu" disabled={saving} onClick={tutup}><X className="size-4" /></Button></div>
            {open && !readOnly ? <form onSubmit={save} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">{([['Nama lengkap', nama, setNama], ['Nomor HP/WhatsApp', telepon, setTelepon], ['Alamat', alamat, setAlamat]] as const).map(([label, value, setter]) => <label key={label} className={`block text-sm ${label === 'Alamat' ? 'sm:col-span-2' : ''}`}>{label}<input required value={value} onChange={e => setter(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3" /></label>)}</div>
              <label className="block text-sm">{editing ? 'Tambah Catatan' : 'Catatan'}<textarea value={catatan} onChange={e => setCatatan(e.target.value)} className="mt-1 min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2" /></label>
              {notes.error && <p className="text-xs text-muted-foreground">Riwayat catatan belum tersedia. Data lama tetap dipertahankan.</p>}
              {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => { setOpen(false); setEditing(null); if (!detail) tutup(); }}>Batal</Button><Button type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button></div>
            </form> : detail && <>
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">{[['Nomor WhatsApp', detail.phone], ['Alamat', detail.address || '—'], ['Tanggal terdaftar', tanggalWib(detail.created_at)], ['Kunjungan terakhir', terakhir ? tanggalWib(terakhir) : jumlahKunjungan(detail.id) ? 'Waktu check-in tidak tersedia' : 'Belum ada kunjungan'], ['Jumlah kunjungan', transactions.loading ? 'Memuat…' : `${jumlahKunjungan(detail.id)} kali`]].map(([label, value]) => <div key={label} className="border-b border-border/60 pb-2"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}</dl>
              <section className="mt-5"><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold uppercase text-gold">Catatan Tamu</h3>{daftarCatatan.length > 1 && <Button variant="ghost" size="sm" className="h-7 text-xs text-gold-light" onClick={() => setSemuaCatatan(!semuaCatatan)}>{semuaCatatan ? 'Ringkas' : 'Lihat Semua'}</Button>}</div>
                {notes.error && <p className="mt-2 text-xs text-muted-foreground">Riwayat catatan belum dapat dimuat; catatan terakhir tetap ditampilkan.</p>}
                <ul className={`mt-2 divide-y divide-border/60 ${semuaCatatan ? 'max-h-48 overflow-y-auto pr-3' : ''}`}>{(semuaCatatan ? daftarCatatan : daftarCatatan.slice(0, 1)).map(note => <li key={note.id} className="py-2"><p className="whitespace-pre-wrap break-words text-sm">{note.body}</p><p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">{note.author_role && <span className="rounded border border-gold/25 px-1.5 py-0.5 text-gold">{note.author_role}</span>}<span>{note.author_name ?? 'Pembuat tidak diketahui'}</span><span>•</span><span>{note.created_at ? waktuWib(note.created_at) : 'Waktu tidak diketahui'}</span></p></li>)}</ul>
                {!daftarCatatan.length && <p className="mt-2 text-sm text-muted-foreground">Belum ada catatan tamu</p>}
              </section>
              <section className="mt-5"><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold uppercase text-gold">Riwayat Transaksi</h3>{riwayat.length > 2 && <Button variant="ghost" size="sm" className="h-7 text-xs text-gold-light" onClick={() => setSemuaTransaksi(!semuaTransaksi)}>{semuaTransaksi ? 'Ringkas' : 'Lihat Semua'}</Button>}</div>
                {transactions.error && <p role="alert" className="mt-2 text-xs text-destructive">Riwayat transaksi belum dapat dimuat.</p>}
                <ul className={`mt-2 divide-y divide-border/60 ${semuaTransaksi ? 'max-h-48 overflow-y-auto pr-3' : ''}`}>{(semuaTransaksi ? riwayat : riwayat.slice(0, 2)).map(tr => <li key={tr.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2"><div><Button type="button" variant="link" className="h-auto p-0 font-mono text-xs text-primary sm:text-sm" onClick={() => setDetailTransactionId(tr.id)}>{tr.transaction_number}</Button><p className="mt-1 text-[11px] text-muted-foreground">{tanggalWib(tr.created_at)}</p></div><span className="text-[10px] font-semibold text-gold-light">{statusTransaksi[tr.status] ?? tr.status}</span></li>)}</ul>
                {!transactions.loading && !transactions.error && !riwayat.length && <p className="mt-2 text-sm text-muted-foreground">Belum ada riwayat transaksi</p>}
              </section>
              <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-gold/20 pt-4">{!readOnly && <><Button variant="outline" onClick={() => edit(detail)}><Pencil className="size-4" />Perbaharui Data</Button><Button onClick={() => openWhatsApp(detail.phone)}><MessageCircle className="size-4" />WhatsApp</Button></>}</div>
            </>}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {detailTransactionId && <DetailTransaksi transactionId={detailTransactionId} mode={posisiKode === 'housekeeping' ? 'housekeeping' : 'full'} onClose={() => setDetailTransactionId(null)} />}
    </Kerangka>
  );
}
