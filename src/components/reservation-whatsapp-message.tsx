import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { readOffer, type OfferDetail } from '@/lib/reservation-offers';
import {
  pendingReservationMessageFingerprint, renderPendingReservationMessage,
} from '@/lib/reservation-whatsapp-message';

type ActiveTemplate = { body: string; revision: number };

async function readActiveReservationTemplate(): Promise<ActiveTemplate> {
  const { data, error } = await supabase.rpc('read_active_whatsapp_template', {
    _kind: 'PENAWARAN_RESERVASI',
  });
  if (error) throw new Error('Template resmi tidak dapat diakses. Hubungi Owner.');
  const active = data?.[0];
  if (!active || typeof active.body !== 'string' || !active.body.trim() ||
      !Number.isSafeInteger(active.revision) || active.revision <= 0) {
    throw new Error('Belum ada template Penawaran Reservasi ACTIVE yang dapat digunakan.');
  }
  return { body: active.body, revision: active.revision };
}

export function ReservationWhatsAppMessage({ offer, cardReady }: {
  offer: OfferDetail; cardReady: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [copyError, setCopyError] = useState('');
  const active = useQuery({
    queryKey: ['active-reservation-whatsapp-template', 'PENAWARAN_RESERVASI'],
    queryFn: readActiveReservationTemplate,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  let message = '';
  let renderError = '';
  if (active.isSuccess) {
    try {
      message = renderPendingReservationMessage(offer, active.data.body);
    } catch (failure) {
      renderError = failure instanceof Error ? failure.message : 'Template tidak dapat dibuat dari data reservasi.';
    }
  }

  async function copyOfficialMessage() {
    if (busy || !cardReady || !message || !active.data) return;
    setBusy(true);
    setCopyError('');
    try {
      // Revalidate both the ACTIVE version and the saved reservation right before copying.
      const [latestOffer, latestTemplate] = await Promise.all([
        readOffer(offer.id), readActiveReservationTemplate(),
      ]);
      if (!latestOffer ||
          pendingReservationMessageFingerprint(latestOffer) !== pendingReservationMessageFingerprint(offer) ||
          latestTemplate.revision !== active.data.revision ||
          latestTemplate.body !== active.data.body ||
          renderPendingReservationMessage(latestOffer, latestTemplate.body) !== message) {
        throw new Error('Data reservasi atau template resmi berubah. Muat ulang detail sebelum menyalin.');
      }
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard tidak tersedia. Pilih teks pada preview, lalu salin secara manual.');
      }
      await navigator.clipboard.writeText(message);
      setCopyError('');
      toast.success('Pesan reservasi berhasil disalin. Tempel ke WhatsApp dan lampirkan JPG secara manual.');
    } catch (failure) {
      setCopyError(failure instanceof Error ? failure.message : 'Gagal menyalin pesan.');
      void active.refetch();
    } finally {
      setBusy(false);
    }
  }

  return <section aria-label="Template WhatsApp Reservasi" className="space-y-2 rounded-xl border border-[#d8c49c] bg-[#fffdf8] p-3 text-sm">
    <h3 className="font-semibold text-[#342819]">Template WhatsApp — Penawaran Reservasi</h3>
    <p className="text-xs text-[#755e42]">Teks dari template ACTIVE milik Owner dan data reservasi tersimpan. Belum menjadi Booking resmi.</p>
    {active.isPending && <p role="status">Memuat template resmi…</p>}
    {active.isError && <p role="alert" className="text-red-800">{active.error instanceof Error ? active.error.message : 'Template gagal dimuat.'} <Button type="button" size="sm" variant="outline" onClick={() => void active.refetch()}>Coba lagi</Button></p>}
    {renderError && <p role="alert" className="text-red-800">{renderError}</p>}
    {message && <>
      <label htmlFor={`reservation-message-${offer.id}`} className="text-xs font-semibold">Preview Pesan WhatsApp Resmi (versi {active.data?.revision})</label>
      <textarea id={`reservation-message-${offer.id}`} aria-label="Preview Template WhatsApp Reservasi" readOnly value={message} rows={11}
        className="max-h-72 w-full resize-y rounded-lg border border-[#d7c7ab] bg-white p-3 text-xs leading-relaxed text-[#2d251b]" />
      <Button type="button" variant="outline" className="border-[#bd8c39] bg-[#f7e8c8] text-[#342819]" disabled={busy || !cardReady}
        onClick={() => void copyOfficialMessage()}><Copy aria-hidden="true" className="mr-1 size-4" />{busy ? 'Memeriksa…' : 'Salin Pesan'}</Button>
      {!cardReady && <p className="text-xs text-[#755e42]">Pastikan JPG/QRIS berhasil dibuat sebelum menyalin pesan.</p>}
      <p className="text-xs text-[#755e42]">Tempel pesan ke chat tamu dan lampirkan kartu JPG secara manual. Tidak otomatis terkirim.</p>
    </>}
    {copyError && <p role="alert" className="text-xs text-red-800">{copyError}</p>}
  </section>;
}
