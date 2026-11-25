import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { formatBookingQuote, validateBookingQuote, type BookingQuoteDraft } from '@/lib/booking-quote';
import { rupiah } from '@/lib/data-contoh';
import { renderWhatsAppTemplate } from '@/lib/whatsapp-template-core';
import { whatsAppDraftUrl } from '@/lib/whatsapp';

export function BookingQuote({ draft, roomId, packageId, dayReady, loading, loadError }: {
  draft: BookingQuoteDraft;
  roomId: string;
  packageId: string;
  dayReady: boolean;
  loading: boolean;
  loadError: boolean;
}) {
  const [preview, setPreview] = useState<ReturnType<typeof formatBookingQuote> | null>(null);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const requestActive = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const messageField = useRef<HTMLTextAreaElement>(null);
  const priceReady = dayReady && Boolean(draft.roomNumber && draft.packageName)
    && Number.isFinite(draft.roomPrice) && draft.roomPrice > 0;
  const dpWarning = priceReady && draft.minimumDp === null && !loading && !loadError;

  async function previewQuote() {
    if (requestActive.current) return;
    setError('');
    setCopyStatus('');
    const validation = loading ? 'Tunggu sampai data penawaran selesai dimuat.'
      : loadError ? 'Data resmi penawaran gagal dimuat. Coba buka ulang formulir.'
      : !draft.checkIn ? 'Pilih tanggal dan jam check-in WIB yang valid.'
      : !dayReady ? 'Jenis hari belum dapat ditentukan dari kalender operasional.'
      : validateBookingQuote(draft);
    if (validation) { setError(validation); return; }

    requestActive.current = true;
    setBusy(true);
    try {
      const { data, error: scheduleError } = await supabase.rpc('check_booking_quote_schedule', {
        _room_id: roomId,
        _package_id: packageId, _scheduled_check_in: draft.checkIn,
      });
      if (scheduleError || !data?.[0]) {
        setError(scheduleError?.code === 'P0001' ? scheduleError.message : 'Jadwal resmi paket gagal diperiksa. Coba lagi.');
        return;
      }

      const schedule = data[0];
      if (typeof schedule.has_conflict !== 'boolean') {
        setError('Konflik jadwal kamar gagal diperiksa. Coba lagi.');
      } else if (schedule.has_conflict) {
        setError('Jadwal kamar bentrok atau okupansi belum dapat dipastikan. Pilih kamar atau jadwal berbeda.');
      } else {
        const base = formatBookingQuote(draft, schedule);
        // A missing new RPC means the pending migration is not yet released:
        // retain the existing verified Booking quote. Never bypass a real denial.
        const { data: activeTemplates, error: templateError } = await supabase.rpc(
          'read_active_whatsapp_template', { _kind: 'PENAWARAN_RESERVASI' },
        );
        if (templateError && templateError.code !== 'PGRST202') {
          throw new Error('Template resmi belum dapat diperiksa. Hubungi Owner.');
        }
        const active = activeTemplates?.[0];
        const message = active
          ? renderWhatsAppTemplate('PENAWARAN_RESERVASI', active.body, base.templateValues)
          : base.message;
        setPreview({ ...base, message });
      }
    } catch (failure) {
      setError(failure instanceof Error && (
        failure.message.startsWith('Jadwal resmi paket') ||
        failure.message.startsWith('Template resmi') ||
        failure.message.startsWith('Data [') ||
        failure.message.startsWith('Variabel [')
      ) ? failure.message : 'Penawaran gagal disiapkan. Coba lagi.');
    } finally {
      requestActive.current = false;
      setBusy(false);
    }
  }

  async function copyMessage() {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview.message);
      setCopyStatus('Pesan disalin.');
    } catch {
      messageField.current?.focus();
      messageField.current?.select();
      setCopyStatus('Salin teks yang dipilih dengan menu Salin perangkat.');
    }
  }

  return <div className="ci-notice space-y-2">
    <h4 className="font-semibold">Ringkasan Harga Booking</h4>
    {loading ? <p>Memuat data harga resmi…</p> : loadError ? <p>Data resmi penawaran gagal dimuat.</p> : priceReady ? (
      <dl className="space-y-1">
        <div className="flex flex-wrap justify-between gap-x-3"><dt>Harga kamar ({draft.dayMode === 'weekday' ? 'Weekday' : 'Weekend'})</dt><dd>{rupiah(draft.roomPrice)}</dd></div>
        <div className="flex flex-wrap justify-between gap-x-3"><dt>Biaya tambahan</dt><dd>{rupiah(draft.extraCharge)}</dd></div>
        <div className="flex flex-wrap justify-between gap-x-3 font-semibold"><dt>Total tagihan</dt><dd>{rupiah(draft.total)}</dd></div>
        {draft.minimumDp !== null && <div className="flex flex-wrap justify-between gap-x-3">
          <dt>Minimum DP{draft.dpMode === 'PERCENTAGE' ? ` (${draft.dpValue?.toLocaleString('id-ID')}%)` : ''}</dt>
          <dd>{rupiah(draft.minimumDp)}</dd>
        </div>}
      </dl>
    ) : <p>Pilih tanggal, kamar, dan paket dengan harga resmi.</p>}
    {dpWarning && <p>Pengaturan DP resmi belum dapat dibaca untuk akun ini.</p>}
    <Button ref={trigger} type="button" variant="outline" disabled={busy || loading} onClick={() => void previewQuote()}>
      {busy ? 'Memeriksa jadwal…' : 'Preview Penawaran'}
    </Button>
    {error && <p role="alert" className="text-destructive">{error}</p>}

    <Dialog open={Boolean(preview)} onOpenChange={open => { if (!open) setPreview(null); }}>
      {preview && <DialogContent
        className="z-[60] max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-lg min-w-0 overflow-y-auto rounded-xl border-[var(--premium-line)] bg-[var(--success-paper)] text-[var(--premium-ink)]"
        onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }}
      >
        <DialogTitle className="pr-6">Preview Penawaran</DialogTitle>
        <DialogDescription className="break-words text-[var(--premium-ink)]">
          Tujuan +{preview.phone}. Kirim pesan secara manual di WhatsApp. Penawaran tidak mengunci kamar.
        </DialogDescription>
        <textarea
          ref={messageField}
          aria-label="Pesan penawaran"
          className="h-[min(42dvh,22rem)] w-full min-w-0 resize-y rounded-lg border border-[var(--premium-line)] bg-transparent p-3 text-sm leading-relaxed"
          readOnly
          value={preview.message}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void copyMessage()}>Salin Pesan</Button>
          <Button asChild>
            <a href={whatsAppDraftUrl(preview.phone, preview.message)} target="_blank" rel="noopener noreferrer"
              className="h-auto min-h-9 max-w-full whitespace-normal text-center">
              Kirim Penawaran via WhatsApp
            </a>
          </Button>
        </div>
        {copyStatus && <p role="status" className="text-sm">{copyStatus}</p>}
      </DialogContent>}
    </Dialog>
  </div>;
}
