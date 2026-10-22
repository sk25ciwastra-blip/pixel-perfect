import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { MessageCircle, Eye, X, Phone, MapPin, CalendarDays, Search, Plus } from 'lucide-react';
import { Kerangka } from '@/components/kerangka';
import { Button } from '@/components/ui/button';
import { useTable, type Guest } from '@/lib/data-live';
import { supabase } from '@/integrations/supabase/client';
import { meta } from '@/lib/meta';
import { usePeran } from '@/lib/peran';
import { openWhatsApp } from '@/lib/whatsapp';
import { DetailTransaksi } from '@/components/detail-transaksi';

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

function HalamanTamu() {
  const { posisiKode } = usePeran();
  const readOnly = posisiKode === 'inspector';
  const { rows, loading, error, refresh } = useTable('guests');
  const transactions = useTable('transactions');
  const [cari, setCari] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [nama, setNama] = useState('');
  const [alamat, setAlamat] = useState('');
  const [telepon, setTelepon] = useState('');
  const [catatan, setCatatan] = useState('');
  const [message, setMessage] = useState('');
  const [detailTamu, setDetailTamu] = useState<Guest | null>(null);
  const [detailTransactionId, setDetailTransactionId] = useState<string | null>(null);

  const queryText = cari.trim().toLocaleLowerCase('id-ID');
  const queryDigits = normalisasiNomor(cari);
  const hasil = rows.filter(
    (t) => t.full_name.toLocaleLowerCase('id-ID').includes(queryText) || (queryDigits.length > 0 && normalisasiNomor(t.phone).includes(queryDigits)),
  );

  function edit(t?: Guest) {
    setEditing(t ?? null);
    setNama(t?.full_name ?? '');
    setAlamat(t?.address ?? '');
    setTelepon(t?.phone ?? '');
    setCatatan(t?.notes ?? '');
    setMessage('');
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const match = rows.find((t) => t.phone === telepon.trim() && t.id !== editing?.id);
    if (match) { setMessage(`Nomor sudah tercatat atas nama ${match.full_name}. Gunakan data tamu tersebut.`); return; }
    if (!/^[0-9+]{8,16}$/.test(telepon.trim())) { setMessage('Nomor HP harus 8–16 digit.'); return; }
    const payload = { full_name: nama.trim(), address: alamat.trim(), phone: telepon.trim(), notes: catatan };
    const result = editing ? await supabase.from('guests').update(payload).eq('id', editing.id) : await supabase.from('guests').insert(payload);
    if (result.error) setMessage(result.error.code === '23505' ? 'Nomor HP sudah tercatat. Gunakan data tamu tersebut.' : result.error.message);
    else { setOpen(false); await refresh(); }
  }

  const transaksiTamu = (id: string) =>
    transactions.rows.filter((t) => t.guest_id === id).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  // Kunjungan = transaksi yang benar-benar sudah check-in (bukan sekadar booking/batal).
  const jumlahKunjungan = (id: string) => transaksiTamu(id).filter((t) => t.status === 'check_in' || t.status === 'check_out').length;

  return (
    <Kerangka judul="Daftar Tamu" keterangan={`${rows.length} tamu tercatat`} aksi={!readOnly && <Button className="h-11 shrink-0 gap-2 rounded-xl px-5" onClick={() => edit()}><Plus className="size-4" /><span className="leading-none">Tambah Tamu</span></Button>}>
      <form onSubmit={(e) => e.preventDefault()} className="flex w-full min-w-0 items-center gap-2 rounded-full border border-gold/25 bg-navy-deep/70 py-1.5 pl-4 pr-1.5 backdrop-blur-md sm:max-w-md">
        <Search className="size-4 shrink-0 text-foreground/90" aria-hidden="true" />
        <input aria-label="Pencarian tamu" placeholder="Cari Nama atau Nomor Whatsapp...." value={cari} onChange={(e) => setCari(e.target.value)} className="h-8 w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-gold/50" />
        <Button type="submit" size="sm" className="shrink-0 rounded-full px-4"><Search className="size-4" />Cari</Button>
      </form>
      {loading && <p className="mt-4 text-sm">Memuat tamu…</p>}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="panel-mewah mt-5 overflow-hidden p-0">
        <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,.9fr)_236px] gap-4 border-b border-gold/20 px-5 py-3 text-center text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-gold md:grid">
          <span>Nama</span><span>Nomor Telepon</span><span>Alamat</span><span>Terdaftar</span><span>Aksi</span>
        </div>
        <ul className="divide-y divide-border/60">
          {hasil.map((t) => (
            <li key={t.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-4 py-4 text-center transition hover:bg-gold/[0.04] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,.9fr)_236px] md:gap-4 md:px-5">
              <div className="col-span-2 flex min-w-0 items-center justify-start gap-3 md:col-span-1">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border border-gold/40 bg-gradient-to-b from-navy-soft to-navy-deep font-serif text-base text-gold-light">{t.full_name[0]?.toUpperCase()}</span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.full_name}</p>
                  <p className="text-xs text-muted-foreground">{jumlahKunjungan(t.id)} kunjungan</p>
                </div>
              </div>
              <p className="col-span-2 flex items-center justify-center gap-2 font-mono text-sm tabular-nums md:col-span-1"><Phone className="size-3.5 text-gold md:hidden" />{t.phone}</p>
              <p className="col-span-2 flex min-w-0 items-center justify-center gap-2 text-sm text-muted-foreground md:col-span-1"><MapPin className="size-3.5 shrink-0 text-gold md:hidden" /><span className="truncate">{t.address || '—'}</span></p>
              <p className="col-span-2 flex items-center justify-center gap-2 text-xs text-muted-foreground md:col-span-1"><CalendarDays className="size-3.5 text-gold md:hidden" />{tanggalWib(t.created_at)}</p>
              <div className="col-span-2 flex justify-center gap-2 md:col-span-1">
                {!readOnly && (
                  <Button size="sm" variant="outline" className="border-siap-foreground/40 text-siap-foreground" onClick={() => openWhatsApp(t.phone)}>
                    <MessageCircle className="mr-1.5 size-4" />Hubungi
                  </Button>
                )}
                <Button size="sm" variant="outline" className="border-gold/40 text-gold-light" onClick={() => setDetailTamu(t)}>
                  <Eye className="mr-1.5 size-4" />Lihat Detail
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {!loading && !hasil.length && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Tamu tidak ditemukan.</p>}
      </div>

      {detailTamu && (
        <div className="fixed inset-0 z-50 flex justify-end bg-navy-deep/75 backdrop-blur-sm" onClick={() => setDetailTamu(null)}>
          <aside role="dialog" aria-label="Detail tamu" onClick={(e) => e.stopPropagation()} className="panel-mewah h-full w-full max-w-md overflow-y-auto rounded-none p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-gold">Detail Tamu</p>
                <h2 className="mt-1 font-serif text-2xl text-gold-light">{detailTamu.full_name}</h2>
              </div>
              <button type="button" aria-label="Tutup" onClick={() => setDetailTamu(null)} className="rounded-full border border-gold/30 p-2 text-gold"><X className="size-4" /></button>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              {[
                ['Nomor telepon', detailTamu.phone],
                ['Alamat', detailTamu.address || '—'],
                ['Terdaftar sejak', tanggalWib(detailTamu.created_at)],
                ['Total kunjungan', `${jumlahKunjungan(detailTamu.id)} kali`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-border/60 pb-2"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-gold">Catatan</p>
            <p className="mt-1 text-sm text-muted-foreground">{detailTamu.notes?.trim() || 'Belum ada catatan'}</p>
            <p className="mt-5 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-gold">Nomor Transaksi</p>
            <ul className="mt-2 space-y-1.5">
              {transaksiTamu(detailTamu.id).map((tr) => (
                <li key={tr.id}>
                  <button type="button" className="font-mono text-sm font-semibold text-primary hover:underline" onClick={() => setDetailTransactionId(tr.id)}>{tr.transaction_number}</button>
                  <span className="ml-2 text-xs text-muted-foreground">{tanggalWib(tr.created_at)}</span>
                </li>
              ))}
              {!transaksiTamu(detailTamu.id).length && <li className="text-sm text-muted-foreground">—</li>}
            </ul>
            <div className="mt-6 flex gap-2">
              {!readOnly && <Button variant="outline" onClick={() => { const t = detailTamu; setDetailTamu(null); edit(t); }}>Ubah</Button>}
              {!readOnly && <Button onClick={() => openWhatsApp(detailTamu.phone)}><MessageCircle className="mr-1.5 size-4" />Hubungi WhatsApp</Button>}
            </div>
          </aside>
        </div>
      )}

      {open && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-deep/75 p-4 backdrop-blur-sm">
          <form onSubmit={save} className="w-full max-w-md space-y-3 rounded-2xl bg-background p-5 shadow-lembut">
            <h2 className="text-lg font-bold">{editing ? 'Ubah tamu' : 'Tambah tamu'}</h2>
            {([['Nama lengkap', nama, setNama], ['Alamat', alamat, setAlamat], ['Nomor HP/WhatsApp', telepon, setTelepon], ['Catatan', catatan, setCatatan]] as const).map(([label, value, setter]) => (
              <label key={label} className="block text-sm">{label}
                <input required={label !== 'Catatan'} value={value} onChange={(e) => setter(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3" />
              </label>
            ))}
            {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button type="submit">Simpan</Button></div>
          </form>
        </div>
      )}
      {detailTransactionId && <DetailTransaksi transactionId={detailTransactionId} mode={posisiKode === 'housekeeping' ? 'housekeeping' : 'full'} onClose={() => setDetailTransactionId(null)} />}
    </Kerangka>
  );
}
