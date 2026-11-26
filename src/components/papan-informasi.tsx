import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Megaphone, Pencil, Plus, Settings2, Sparkles, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { usePeran } from '@/lib/peran';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ActionResultDialog, type ActionResultState } from '@/components/action-result-dialog';
import { ROTATION_MS, TRANSITION_MS, urutPengumuman, indeksBerikut, bolehBerputar } from '@/lib/pengumuman-rotasi.mjs';
import { MAKS_HURUF, rapikanTeks, bolehDisimpan } from '@/lib/pengumuman-batas.mjs';

type Pengumuman = Database['public']['Tables']['operational_announcements']['Row'];
const waktu = (value: string) => new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(value)) + ' WIB';


export function PapanInformasi() {
  const { peran, posisiKode, siap, masuk } = usePeran();
  const owner = peran === 'owner';
  const enabled = siap && masuk && (owner || ['receptionist', 'housekeeping', 'supervisor', 'inspector'].includes(posisiKode ?? ''));
  const [rows, setRows] = useState<Pengumuman[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [manage, setManage] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionResult, setActionResult] = useState<ActionResultState | null>(null);
  const generation = useRef(0);
  const content = useRef<HTMLDivElement>(null);
  const channelId = useId();

  // Range reads include every stored announcement, beyond the Data API page limit.
  const refresh = useCallback(async () => {
    const requestId = ++generation.current;
    if (!enabled) { setRows([]); setLoading(false); return null; }
    const all: Pengumuman[] = [];
    try {
      for (let from = 0; ; from += 500) {
        const result = await supabase.from('operational_announcements').select('*')
          .order('created_at').order('id').range(from, from + 499);
        if (result.error) throw result.error;
        const page = result.data ?? [];
        all.push(...page);
        if (page.length < 500) break;
      }
      if (requestId !== generation.current) return null;
      const latest = urutPengumuman(all);
      setRows(latest); setError('');
      return latest;
    } catch {
      if (requestId === generation.current) setError('Pengumuman belum dapat dimuat.');
      return null;
    } finally {
      if (requestId === generation.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
    if (!enabled) return;
    const channel = supabase.channel(`announcements-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operational_announcements' }, () => { void refresh(); })
      .subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); });
    const onFocus = () => { void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { generation.current++; void supabase.removeChannel(channel); window.removeEventListener('focus', onFocus); };
  }, [refresh, enabled, channelId]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const index = Math.max(0, rows.findIndex(row => row.id === selectedId));
  const current = rows[index];
  const next = useCallback((step: number) => {
    const row = rows[indeksBerikut(index, rows.length, step)];
    setSelectedId(row?.id ?? null);
  }, [rows, index]);

  useEffect(() => {
    if (!bolehBerputar(rows.length, hovered || focused || manage)) return;
    const timer = window.setTimeout(() => next(1), ROTATION_MS);
    return () => window.clearTimeout(timer);
  }, [rows.length, current?.id, hovered, focused, manage, next]);

  useEffect(() => {
    if (reduced || rows.length <= 1 || !content.current) return;
    const animation = content.current.animate([
      { opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' },
    ], { duration: TRANSITION_MS, easing: 'ease-out' });
    return () => animation.cancel();
  }, [current?.id, reduced, rows.length]);

  const editing = useMemo(() => rows.find(row => row.id === editId), [rows, editId]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!owner || busy || !bolehDisimpan(body)) return;
    setBusy(true); setActionResult(null);
    const editingId = editId;
    const bersih = rapikanTeks(body).trim();
    let writeAcknowledged = false;
    try {
      const result = editingId
        ? await supabase.from('operational_announcements').update({ body: bersih }).eq('id', editingId).select('id').single()
        : await supabase.from('operational_announcements').insert({ body: bersih }).select('id').single();
      if (result.error || !result.data?.id) throw new Error('Write not confirmed');
      writeAcknowledged = true;
      const latest = await refresh();
      if (!latest?.some(item => item.id === result.data.id && item.body === bersih)) {
        setActionResult({
          kind: 'error',
          title: 'Periksa kembali pengumuman',
          description: 'Penyimpanan diterima sistem, tetapi data terbaru belum berhasil diverifikasi. Periksa daftar pengumuman sebelum mengulangi.',
        });
        return;
      }
      setEditId(null); setBody('');
      setActionResult({
        kind: 'success',
        title: editingId ? 'Pengumuman berhasil diperbarui' : 'Pengumuman berhasil ditambahkan',
        description: 'Pengumuman Owner telah disimpan dan tampil pada daftar pengumuman terbaru.',
      });
    } catch {
      setActionResult({
        kind: 'error',
        title: 'Periksa hasil penyimpanan pengumuman',
        description: writeAcknowledged
          ? 'Perubahan mungkin sudah tersimpan, tetapi hasilnya belum dapat diperiksa. Muat ulang daftar sebelum mengulangi.'
          : 'Hasil penyimpanan belum dapat dipastikan. Periksa daftar pengumuman sebelum mencoba kembali.',
      });
    } finally { setBusy(false); }
  }
  async function remove(row: Pengumuman) {
    // Confirmation BEFORE deletion remains separate from the result popup.
    if (!owner || busy || !window.confirm('Hapus pengumuman ini?')) return;
    setBusy(true); setActionResult(null);
    let writeAcknowledged = false;
    try {
      const result = await supabase.from('operational_announcements').delete().eq('id', row.id).select('id').single();
      if (result.error || !result.data?.id) throw new Error('Delete not confirmed');
      writeAcknowledged = true;
      const latest = await refresh();
      if (!latest || latest.some(item => item.id === row.id)) {
        setActionResult({
          kind: 'error',
          title: 'Periksa kembali penghapusan',
          description: 'Permintaan penghapusan diterima sistem, tetapi hasil terbaru belum dapat diverifikasi. Periksa daftar sebelum melakukan tindakan lain.',
        });
        return;
      }
      if (editId === row.id) { setEditId(null); setBody(''); }
      setActionResult({
        kind: 'success',
        title: 'Pengumuman berhasil dihapus',
        description: 'Pengumuman telah dihapus dan daftar pengumuman berhasil diperbarui.',
      });
    } catch {
      setActionResult({
        kind: 'error',
        title: 'Periksa hasil penghapusan',
        description: writeAcknowledged
          ? 'Pengumuman mungkin sudah dihapus, tetapi hasil terbaru belum dapat diperiksa. Muat ulang daftar sebelum mencoba kembali.'
          : 'Hasil penghapusan belum dapat dipastikan. Periksa daftar pengumuman sebelum mengulangi.',
      });
    } finally { setBusy(false); }
  }

  return (
    <section className="panel-mewah relative mt-5 flex flex-col justify-center gap-3 px-4 py-3 sm:flex-row sm:items-center" aria-labelledby="judul-papan-informasi"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="flex min-w-0 items-center gap-3 sm:w-[35%] sm:shrink-0">
        <span className="ikon-bulat size-10 shrink-0 text-gold"><Megaphone className="size-5" strokeWidth={1.6} /></span>
        <div className="min-w-0"><h2 id="judul-papan-informasi" className="font-serif text-lg font-semibold">Papan Informasi</h2>
          <p className="text-xs text-muted-foreground">Informasi dan pengumuman operasional</p></div>
      </div>
      {owner && <Button variant="ghost" size="icon" className="absolute right-2 top-2 z-10 size-7 text-gold" title="Kelola pengumuman" aria-label="Kelola pengumuman" onClick={() => setManage(true)}><Settings2 className="size-4" /></Button>}
      <div className="relative min-w-0 flex-1 border border-transparent px-1 sm:border-l-gold/15 sm:border-t-0 sm:pl-6 sm:pr-8">
        {current && enabled && !error ? <>
          <div ref={content}>
            <p className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-gold"><Sparkles className="size-3.5 shrink-0" aria-hidden="true" />PENGUMUMAN OWNER</p>
            <p className="mt-0.5 line-clamp-4 min-h-10 whitespace-pre-wrap break-words text-[14px] leading-5 text-foreground sm:line-clamp-2" tabIndex={0}>{current.body}</p>
          </div>
          <div className="mt-1.5 flex justify-end">
            <p className="text-[10px] tabular-nums text-muted-foreground">{waktu(current.created_at)}{current.updated_at !== current.created_at ? ` · Diubah ${waktu(current.updated_at)}` : ''}</p>
          </div>
        </> : <div className="flex min-h-12 items-center justify-center gap-2.5 text-center sm:text-left">
          <Megaphone className="size-4 shrink-0 text-gold/50" strokeWidth={1.5} aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{error || (loading && enabled ? 'Memuat pengumuman…' : enabled ? 'Belum ada pengumuman operasional' : 'Pengumuman hanya untuk tim operasional berwenang.')}</p>
          {error && <Button variant="ghost" size="sm" onClick={() => void refresh()}>Coba lagi</Button>}
        </div>}
      </div>
      {owner && <Dialog open={manage} onOpenChange={setManage}>
        <DialogContent className="max-h-[90svh] overflow-y-auto border-gold/30 sm:max-w-2xl">
          <DialogHeader><DialogTitle className="font-serif text-gold">Kelola Pengumuman</DialogTitle><DialogDescription>Pengumuman Baturaden 25 Homestay</DialogDescription></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <label htmlFor="isi-pengumuman" className="text-sm">{editing ? 'Edit pengumuman' : 'Pengumuman baru'}</label>
            <Textarea id="isi-pengumuman" value={body} onChange={event => setBody(rapikanTeks(event.target.value))} required disabled={busy} maxLength={MAKS_HURUF} className="min-h-24 border-gold/25 bg-navy-deep/40" />
            <p className={`text-[10px] ${body.length >= MAKS_HURUF - 20 ? 'text-gold' : 'text-muted-foreground'}`}>{body.length}/{MAKS_HURUF} karakter{body.length >= MAKS_HURUF ? ' — batas tercapai' : ''}</p>
            <div className="flex gap-2"><Button type="submit" disabled={busy || !bolehDisimpan(body)}><Plus className="size-4" />{busy ? 'Menyimpan…' : editId ? 'Simpan perubahan' : 'Tambah pengumuman'}</Button>
              {editId && <Button type="button" variant="outline" disabled={busy} onClick={() => { setEditId(null); setBody(''); }}>Batal edit</Button>}</div>
          </form>
          <div className="border-t border-gold/15 pt-3">
            <h3 className="mb-2 text-sm font-semibold">Daftar Pengumuman ({rows.length})</h3>
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            {!rows.length && <p className="text-xs text-muted-foreground">Belum ada pengumuman operasional</p>}
            <ol className="max-h-64 overflow-y-auto divide-y divide-gold/15">
              {rows.map(row => <li key={row.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1"><p className="whitespace-pre-wrap break-words text-sm">{row.body}</p><p className="mt-1 text-[10px] text-muted-foreground">{waktu(row.created_at)}</p></div>
                <Button size="icon" variant="ghost" className="size-8 shrink-0 text-gold" disabled={busy} title="Edit pengumuman" aria-label="Edit pengumuman" onClick={() => { setEditId(row.id); setBody(row.body); setActionResult(null); }}><Pencil className="size-3.5" /></Button>
                <Button size="icon" variant="ghost" className="size-8 shrink-0 text-destructive" disabled={busy} title="Hapus pengumuman" aria-label="Hapus pengumuman" onClick={() => void remove(row)}><Trash2 className="size-3.5" /></Button>
              </li>)}
            </ol>
          </div>
        </DialogContent>
      </Dialog>}
      {owner && <ActionResultDialog result={actionResult} onClose={() => setActionResult(null)} />}
    </section>
  );
}