import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { loadPaymentConfirmation } from '@/lib/payment-confirmation-data';
import { renderConfirmationTemplate } from '@/lib/whatsapp-confirmation-template';

type Kind = 'KONFIRMASI_BOOKING' | 'KONFIRMASI_PEMBAYARAN';

/**
 * Optional text companion to the already downloaded PDF.
 * Uses the same revalidated payment ledger as PDF; does not send,
 * create payments/receipts, or automatically attach a file.
 */
export function PesanTemplateKonfirmasi({ transactionId, pdfReady, expectedLedgerRevision }: {
  transactionId: string;
  pdfReady: boolean;
  expectedLedgerRevision: string;
}) {
  const [kind, setKind] = useState<Kind>('KONFIRMASI_PEMBAYARAN');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);

  async function preview() {
    if (!pdfReady || busy) return;
    setBusy(true); setError(''); setCopied(false); setMessage(''); setPreviewVersion(null);
    try {
      // RLS and transaction-scoped refund RPC are checked before any customer text.
      const document = await loadPaymentConfirmation(transactionId, supabase);
      if (document.transactionId !== transactionId || document.ledgerRevision !== expectedLedgerRevision) {
        throw new Error('Data pembayaran berubah sejak PDF diunduh. Unduh PDF terbaru sebelum membuat pesan.');
      }
      const response = await supabase.rpc('read_active_whatsapp_template', { _kind: kind });
      if (response.error) throw new Error('Template resmi belum dapat diakses. Periksa izin dan aktivasi Owner.');
      const active = response.data?.[0];
      const template = active?.body;
      if (!template || !Number.isSafeInteger(active.revision) || active.revision <= 0) {
        throw new Error('Owner belum mengaktifkan template resmi untuk jenis pesan ini.');
      }
      const rendered = renderConfirmationTemplate(kind, template, document);
      const latest = await loadPaymentConfirmation(transactionId, supabase);
      if (latest.transactionId !== transactionId || latest.ledgerRevision !== expectedLedgerRevision ||
          latest.transactionStatus !== document.transactionStatus || latest.guest.phone !== document.guest.phone) {
        throw new Error('Data pembayaran atau hak akses berubah; muat ulang dokumen sebelum membuat pesan.');
      }
      setPreviewVersion(active.revision);
      setMessage(rendered);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pesan konfirmasi gagal dibuat.');
    } finally { setBusy(false); }
  }

  async function copy() {
    if (!pdfReady || !message || busy || previewVersion === null) return;
    setBusy(true); setCopied(false); setError('');
    try {
      // Refresh authority, ledger and template just before releasing customer-facing text.
      const latest = await loadPaymentConfirmation(transactionId, supabase);
      if (latest.transactionId !== transactionId || latest.ledgerRevision !== expectedLedgerRevision) {
        throw new Error('Data pembayaran berubah sejak PDF diunduh. Unduh PDF dan buat preview terbaru.');
      }
      const active = await supabase.rpc('read_active_whatsapp_template', { _kind: kind });
      if (active.error || active.data?.[0]?.revision !== previewVersion) {
        throw new Error('Template WhatsApp telah berubah. Buat preview baru.');
      }
      const currentMessage = renderConfirmationTemplate(kind, active.data[0].body, latest);
      if (currentMessage !== message) throw new Error('Isi pesan resmi berubah. Buat preview baru.');
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch (failure) {
      setMessage(''); setPreviewVersion(null);
      setError(failure instanceof Error ? failure.message : 'Salin gagal. Buat preview baru.');
    } finally { setBusy(false); }
  }

  return <section className="space-y-2 rounded-lg border border-gold/20 p-3 text-sm">
    <p className="font-semibold">Pesan WhatsApp resmi (opsional)</p>
    <p className="text-xs text-muted-foreground">Setelah unduh PDF, buat teks dari data keuangan terverifikasi. Salin lalu tempel ke chat WhatsApp. Lampirkan PDF sendiri; belum otomatis terkirim.</p>
    <label className="block text-xs" htmlFor="wa-confirmation-kind">Jenis konfirmasi</label>
    <select id="wa-confirmation-kind" className="min-h-9 w-full rounded-md border border-input bg-background px-2"
      disabled={busy || !pdfReady} value={kind} onChange={event => {
        setKind(event.target.value as Kind); setMessage(''); setPreviewVersion(null); setCopied(false); setError('');
      }}>
      <option value="KONFIRMASI_PEMBAYARAN">Konfirmasi Pembayaran</option>
      <option value="KONFIRMASI_BOOKING">Konfirmasi Booking (hanya reservasi)</option>
    </select>
    <Button type="button" variant="outline" size="sm" disabled={!pdfReady || busy}
      onClick={() => void preview()}>{busy ? 'Memverifikasi ledger…' : 'Preview Pesan'}</Button>
    {message && <>
      <textarea readOnly value={message} aria-label="Preview pesan WhatsApp resmi"
        className="min-h-28 w-full rounded-md border border-input bg-background p-2 text-xs" />
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void copy()}>{busy ? 'Memverifikasi…' : 'Salin Pesan'}</Button>
      {copied && <p role="status" className="text-xs">Pesan tersalin. Tempel manual pada chat WhatsApp.</p>}
    </>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </section>;
}
