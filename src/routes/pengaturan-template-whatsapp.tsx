import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Kerangka } from '@/components/kerangka';
import { SubPengaturan } from '@/components/pengaturan-sub';
import { Button } from '@/components/ui/button';
import { usePeran } from '@/lib/peran';
import { supabase } from '@/integrations/supabase/client';
import {
  WHATSAPP_TEMPLATE_FIELDS, validateWhatsAppTemplate,
  type WhatsAppTemplateKind,
} from '@/lib/whatsapp-template-core';
import { meta } from '@/lib/meta';

export const Route = createFileRoute('/pengaturan-template-whatsapp')({
  head: () => meta('Template WhatsApp', 'Pengaturan template pesan khusus Owner Baturaden 25 Homestay.'),
  component: PengaturanTemplateWhatsApp,
});

type Version = {
  id: string; kind: WhatsAppTemplateKind; revision: number; body: string;
  status: string; created_at: string;
};
const kinds: { key: WhatsAppTemplateKind; title: string; description: string }[] = [
  { key: 'PENAWARAN_RESERVASI', title: 'Penawaran Reservasi', description: 'Sebelum DP diverifikasi; bukan Booking resmi dan tidak boleh memuat nomor TRX.' },
  { key: 'KONFIRMASI_BOOKING', title: 'Konfirmasi Booking', description: 'Setelah Booking resmi dengan nomor transaksi yang telah tersimpan.' },
  { key: 'KONFIRMASI_PEMBAYARAN', title: 'Konfirmasi Pembayaran', description: 'Hanya setelah data pembayaran/refund terverifikasi.' },
];
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) + ' WIB';

function PengaturanTemplateWhatsApp() {
  const { siap, masuk, posisiKode, training } = usePeran();
  const owner = siap && masuk && posisiKode === 'owner' && !training.is_training;
  const [kind, setKind] = useState<WhatsAppTemplateKind>('PENAWARAN_RESERVASI');
  const [versions, setVersions] = useState<Version[]>([]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [error, setError] = useState('');
  const readGeneration = useRef(0);

  async function reload(selectedKind: WhatsAppTemplateKind) {
    if (!owner) return;
    const request = ++readGeneration.current;
    setLoading(true); setError(''); setBackendReady(false);
    try {
      const { data, error: readError } = await supabase.from('whatsapp_template_versions')
        .select('id,kind,revision,body,status,created_at')
        .eq('kind', selectedKind).order('revision', { ascending: false });
      if (readError) throw readError;
      if (request !== readGeneration.current) return;
      const list = (data ?? []) as Version[];
      setVersions(list);
      setBody(list.find(item => item.status === 'ACTIVE')?.body ?? '');
      setBackendReady(true);
    } catch {
      if (request !== readGeneration.current) return;
      setVersions([]); setBody('');
      setError('Penyimpanan template WhatsApp belum tersedia atau akses ditolak. SQL pending belum boleh dianggap aktif.');
    } finally { if (request === readGeneration.current) setLoading(false); }
  }

  useEffect(() => {
    if (owner) void reload(kind);
    else { ++readGeneration.current; setVersions([]); setBody(''); setBackendReady(false); }
  }, [owner, kind]);
  const validation = validateWhatsAppTemplate(kind, body);
  const active = versions.find(item => item.status === 'ACTIVE');
  const unchanged = body === (active?.body ?? '');

  async function save() {
    if (!owner || !backendReady || busy || unchanged || validation.length) return;
    setBusy(true); setError('');
    try {
      const { error: saveError } = await supabase.rpc('owner_save_whatsapp_template', {
        _kind: kind, _body: body,
      });
      if (saveError) throw saveError;
      await reload(kind);
      toast.success('Template baru berhasil disimpan dengan riwayat versi.');
    } catch {
      setError('Template belum dapat disimpan. Periksa akses Owner dan status migrasi, lalu muat ulang sebelum mencoba.');
      toast.error('Penyimpanan template gagal');
    } finally { setBusy(false); }
  }

  return <Kerangka judul="Template WhatsApp" keterangan="Atur pesan resmi per fitur. Hanya Owner yang boleh mengubah.">
    <SubPengaturan>
      {!siap ? <p className="panel-mewah p-5">Memeriksa akses…</p>
        : !owner ? <p className="panel-mewah p-5">Halaman ini khusus Owner.</p>
        : <div className="space-y-5">
          <section className="panel-mewah p-5">
            <h2 className="font-serif text-xl">Jenis Template</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {kinds.map(item => <Button key={item.key} type="button" variant={kind === item.key ? 'default' : 'outline'}
                disabled={busy} onClick={() => { ++readGeneration.current; setBackendReady(false); setKind(item.key); }}>{item.title}</Button>)}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{kinds.find(item => item.key === kind)?.description}</p>
          </section>
          <section className="panel-mewah space-y-3 p-5">
            <h2 className="font-serif text-xl">Isi Pesan</h2>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {loading ? <p>Memuat template…</p> : <>
              <label htmlFor="wa-template-body" className="text-sm">Teks WhatsApp (maksimal 4.000 karakter)</label>
              <textarea id="wa-template-body" className="min-h-60 w-full rounded-lg border border-input bg-background p-3 text-sm"
                value={body} onChange={event => setBody(event.target.value)}
                maxLength={4000} disabled={!backendReady || busy} />
              <p className="text-xs text-muted-foreground">Variabel yang diizinkan:</p>
              <div className="flex flex-wrap gap-2">
                {WHATSAPP_TEMPLATE_FIELDS[kind].map(token =>
                  <code key={token} className="rounded bg-secondary px-2 py-1 text-xs">[{token}]</code>)}
              </div>
              {backendReady && validation.length > 0 && body.trim() && <p role="alert" className="text-sm text-destructive">{validation.join(' ')}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={!backendReady || busy || unchanged || validation.length > 0}
                  onClick={() => void save()}>{busy ? 'Menyimpan…' : 'Simpan Versi Baru'}</Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void reload(kind)}>Muat Ulang</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Mengubah template tidak mengirim WhatsApp atau membuat Booking/pembayaran. Integrasi pengiriman operasional belum diaktifkan.
              </p>
            </>}
          </section>
          <section className="panel-mewah p-5">
            <h2 className="font-serif text-xl">Riwayat Versi</h2>
            {!versions.length ? <p className="mt-2 text-sm text-muted-foreground">Belum ada versi tersimpan.</p>
              : <ul className="mt-3 space-y-2 text-sm">
                {versions.map(version => <li key={version.id} className="rounded-lg bg-secondary p-3">
                  Versi {version.revision} · {version.status === 'ACTIVE' ? 'Aktif' : 'Riwayat'}
                  {' · '}{formatDate(version.created_at)}
                </li>)}
              </ul>}
          </section>
        </div>}
    </SubPengaturan>
  </Kerangka>;
}
