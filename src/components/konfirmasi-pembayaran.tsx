import { useState } from 'react';
import { CheckCircle2, Download, Printer, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePeran } from '@/lib/peran';
import type { usePaymentConfirmation } from '@/lib/use-payment-confirmation';

type Hook = ReturnType<typeof usePaymentConfirmation>;
const wib = (v: string | null) => v ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) + ' WIB' : '—';

/** PDF + WhatsApp manual steps. PDF is Owner-only (refund visibility); staff see an honest notice. */
export function AksiPdfStruk({ hook, transactionId }: { hook: Hook; transactionId: string }) {
  const { peran } = usePeran();
  const [busy, setBusy] = useState<'' | 'pdf' | 'wa'>('');
  const [unduh, setUnduh] = useState(false);
  const [pesan, setPesan] = useState('');
  if (peran !== 'owner') return <p className="rounded-lg border border-gold/25 px-3 py-2 text-xs text-muted-foreground">PDF sementara hanya untuk Owner; Cetak Struk/Selesai tetap tersedia.</p>;
  const jalankan = async (jenis: 'pdf' | 'wa') => {
    if (busy) return; setBusy(jenis); setPesan('');
    try {
      if (jenis === 'pdf') { await hook.download(transactionId); setUnduh(true); setPesan('PDF dibuat. Periksa folder unduhan perangkat.'); }
      else await hook.openWhatsApp(transactionId);
    } catch (e) { if (jenis === 'pdf') setUnduh(false); setPesan(e instanceof Error ? e.message : 'Gagal.'); }
    finally { setBusy(''); }
  };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => void jalankan('pdf')}><Download />{busy === 'pdf' ? 'Menyiapkan...' : '1. Unduh PDF'}</Button>
        <Button type="button" variant="outline" size="sm" disabled={!!busy || !unduh} onClick={() => void jalankan('wa')}><MessageCircle />2. Buka WhatsApp</Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Lampirkan PDF secara manual. Belum otomatis terkirim.</p>
      {pesan && <p role="status" className="text-xs text-foreground/90">{pesan}</p>}
    </div>
  );
}

export function TombolCetakStruk({ hook, transactionNumber }: { hook: Hook; transactionNumber: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!hook.thermalAvailable) return <Button type="button" variant="outline" disabled className="w-full"><Printer />Cetak Struk belum aktif</Button>;
  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={async () => { if (busy) return; setBusy(true); setErr(''); try { await hook.print(transactionNumber); } catch (e) { setErr(e instanceof Error ? e.message : 'Cetak gagal.'); } finally { setBusy(false); } }}><Printer />{busy ? 'Mencetak...' : 'Cetak Struk'}</Button>
      {err && <p role="alert" className="text-xs text-bahaya-foreground">{err}</p>}
    </div>
  );
}

/** Shown from hook state after the existing check-in RPC succeeded; never re-runs check-in. */
export function DialogCheckInBerhasil({ hook }: { hook: Hook }) {
  const { state } = hook;
  const [kirim, setKirim] = useState(false);
  if (state.status === 'closed' || !state.identity) return null;
  const id = state.identity;
  const selesai = () => { setKirim(false); hook.clear(); };
  return (
    <Dialog open onOpenChange={(o) => { if (!o) selesai(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader className="items-center text-center">
          <span className="grid size-11 place-items-center rounded-full border border-gold/50 text-gold"><CheckCircle2 className="size-6" strokeWidth={1.6} /></span>
          <DialogTitle className="font-serif text-xl">Check-in Berhasil</DialogTitle>
          <DialogDescription className="font-mono text-gold">{id.transactionNumber}</DialogDescription>
        </DialogHeader>
        {state.status === 'loading' && <p className="text-center text-sm text-muted-foreground">Check-in berhasil; menyiapkan informasi...</p>}
        {state.status === 'error' && (
          <div className="space-y-2 rounded-lg border border-v0-warning/40 px-3 py-2 text-sm">
            <p>Check-in <b>SUDAH BERHASIL</b>. Data refresh belum tersedia: {state.error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void hook.captureCheckInSuccess(id)}>Muat ulang informasi</Button>
          </div>
        )}
        {state.status === 'ready' && state.checkIn && (
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-gold/25 p-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Check-in</dt><dd className="font-semibold">{wib(state.checkIn.started_at)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Batas Check-out</dt><dd className="font-semibold">{wib(state.checkIn.ends_at)}</dd></div>
          </dl>
        )}
        <div className="grid grid-cols-3 gap-2">
          <TombolCetakStruk hook={hook} transactionNumber={id.transactionNumber} />
          <Button type="button" variant="outline" onClick={() => setKirim((k) => !k)}><MessageCircle />Kirim Struk</Button>
          <Button type="button" onClick={selesai}>Selesai</Button>
        </div>
        {kirim && <AksiPdfStruk hook={hook} transactionId={id.transactionId} />}
      </DialogContent>
    </Dialog>
  );
}
