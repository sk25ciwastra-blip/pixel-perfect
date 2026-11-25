import { useEffect, useState } from 'react';
import { CheckCheck, ChevronRight, CreditCard, Download, FileText, Image as ImageIcon, MessageCircle, XCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { rupiah } from '@/lib/data-contoh';
import { supabase } from '@/integrations/supabase/client';
import { offerQueryKey, offerStatus, offerWib, readOffer, readOffers, type Offer, type OfferDetail } from '@/lib/reservation-offers';
import { makeReservationCardJpg, reservationCardFilename, RESERVATION_CARD_CAPTION } from '@/lib/reservation-card';
import { whatsAppReservationChatUrl } from '@/lib/whatsapp';

function Slot({ offer }: { offer: Offer }) {
  return <span>{offerWib.format(new Date(offer.scheduled_check_in))} – {offerWib.format(new Date(offer.scheduled_check_out))} WIB</span>;
}

function PageActions({ page, count, setPage }: { page: number; count: number; setPage: (page: number) => void }) {
  if (!page && count <= 15) return null;
  return <div className="flex gap-2">
    <Button type="button" size="sm" variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
    <Button type="button" size="sm" variant="outline" disabled={(page + 1) * 15 >= count} onClick={() => setPage(page + 1)}>Berikutnya</Button>
  </div>;
}

export function OfferHistory({ guest }: { guest: string }) {
  const [page, setPage] = useState(0);
  const history = useQuery({ queryKey: [...offerQueryKey, guest, page], queryFn: () => readOffers(page, guest) });
  if (history.isPending) return <p role="status">Memuat riwayat reservasi…</p>;
  if (history.isError) return <p role="alert">Riwayat reservasi gagal dimuat.</p>;
  return <div className="space-y-3 py-3 text-sm">
    <p>{history.data.count} reservasi · {history.data.failed_count ?? 0} gagal karena kamar tidak tersedia</p>
    {!history.data.rows.length && <p>Belum ada riwayat reservasi pada halaman ini.</p>}
    <ul className="divide-y divide-border">
      {history.data.rows.map(item => <li key={item.id} className="space-y-1 py-2">
        <p><strong>{offerStatus[item.status]}</strong> · {offerWib.format(new Date(item.created_at))} WIB</p>
        <p>Kamar {item.room_number} · {item.room_type} · {item.package_name}</p>
        <p><Slot offer={item} /></p>
        {item.reason && <p>{item.reason}</p>}
        {item.transaction_number && <p>Booking {item.transaction_number}</p>}
      </li>)}
    </ul>
    <PageActions page={page} count={history.data.count} setPage={setPage} />
  </div>;
}

export function OfferQueue({ selected, select, owner, conversionAllowed, convert }: {
  selected: string | null;
  select: (id: string | null) => void;
  owner: boolean;
  conversionAllowed: boolean;
  convert: (offer: OfferDetail) => void;
}) {
  const client = useQueryClient();
  const [page, setPage] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const list = useQuery({
    queryKey: [...offerQueryKey, 'queue', page],
    queryFn: () => readOffers(page),
    refetchInterval: 5000,
  });
  useEffect(() => {
    const refresh = () => void client.invalidateQueries({ queryKey: offerQueryKey });
    const channel = supabase.channel('dashboard-reservation-offers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms' }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [client]);

  function openList() {
    setPage(0);
    setShowAll(false);
    setListOpen(true);
  }

  return <>
    <button
      type="button"
      className="panel-mewah group relative flex min-w-0 flex-row items-center gap-2.5 overflow-hidden border border-gold/30 bg-gradient-to-br from-[#fffaf0] via-[#fffdf8] to-[#f4e9d5] px-3.5 py-3.5 text-left shadow-[0_8px_20px_rgba(33,24,13,.09)] transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/70 hover:shadow-[0_12px_28px_rgba(33,24,13,.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:from-[#29241c] dark:via-[#29251f] dark:to-[#332a1e]"
      aria-haspopup="dialog"
      aria-label="Buka Antrean Reservasi Menunggu Pembayaran"
      onClick={openList}
    >
      <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-gold/[0.07] blur-2xl" />
      <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#c5a268]/35 bg-[#2c241b] text-[#ecd19c] shadow-md"><FileText className="size-6" strokeWidth={1.5} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.75rem] font-semibold uppercase tracking-[.06em] leading-tight text-[#4e4030] dark:text-[#e5cda2]">Reservasi Menunggu</span>
        <span className="mt-1.5 block truncate text-[1.7rem] font-bold leading-none tabular-nums text-[#2d2419] dark:text-[#fff0d5]">{list.isSuccess ? list.data.count : '—'}</span>
        <span className="mt-1.5 block text-[11px] leading-snug text-gold-light">{list.isError ? 'Gagal memuat · klik untuk mencoba lagi' : 'perlu tindak lanjut'}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-gold" />
    </button>

    <Dialog open={listOpen && !selected} onOpenChange={open => { if (!open) setListOpen(false); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1.25rem)] max-w-4xl overflow-y-auto rounded-[22px] border border-[#deca9f] bg-[#fffaf0] text-[#2c251b] shadow-[0_22px_60px_rgba(22,17,12,.26)]">
        <div className="rounded-xl bg-[#292119] px-4 py-4 text-[#fff5e5]"><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.16em] text-[#dabc7e]">Baturaden 25 Homestay · Operasional</p><DialogTitle className="font-serif text-xl">Reservasi Menunggu</DialogTitle></div>
        <DialogDescription className="text-[var(--premium-ink)]">Antrean permintaan reservasi yang belum menjadi Booking resmi. Kamar tetap tersedia hingga pembayaran diverifikasi.</DialogDescription>
        {list.isPending && <p role="status" className="py-6 text-sm">Memuat reservasi…</p>}
        {list.isError && <p role="alert" className="py-3 text-sm">Daftar reservasi gagal dimuat. <button type="button" className="font-semibold underline" onClick={() => void list.refetch()}>Coba lagi</button></p>}
        {list.isSuccess && <>
          <p className="text-xs">{list.data.count} reservasi menunggu pembayaran</p>
          {!list.data.rows.length && <p className="rounded-xl border border-[var(--premium-line)] p-5 text-center text-sm">Tidak ada reservasi yang menunggu pembayaran.</p>}
          {list.data.rows.length > 0 && <div className="overflow-x-auto rounded-xl border border-[var(--premium-line)]">
            <table className="w-full min-w-[630px] table-fixed border-collapse text-left text-xs">
              <thead className="bg-[#302619] text-[#fff4d5]"><tr>
                <th className="w-[19%] px-3 py-3">Nama</th>
                <th className="w-[15%] px-3 py-3">WA</th>
                <th className="w-[22%] px-3 py-3">Kamar / Tipe</th>
                <th className="w-[15%] px-3 py-3">Check-in</th>
                <th className="w-[17%] px-3 py-3">Status</th>
                <th className="w-[12%] px-3 py-3">Aksi</th>
              </tr></thead>
              <tbody className="divide-y divide-[#d8cab1]">
                {(showAll ? list.data.rows : list.data.rows.slice(0, 5)).map(item => <tr key={item.id} className="bg-[#fffdf8] text-[#28231c] transition-colors hover:bg-[#f5ebd9]">
                  <td className="break-words px-3 py-3 font-semibold">{item.guest_name}</td>
                  <td className="px-3 py-3 tabular-nums">••••{item.phone_last4}</td>
                  <td className="break-words px-3 py-3"><span className="inline-block min-w-8 rounded-md bg-[#30251b] px-2 py-1 text-center font-bold tabular-nums text-[#f6db9e]">{item.room_number}</span><span className="ml-2 text-[#57483a]">{item.room_type}</span></td>
                  <td className="px-3 py-3 tabular-nums">{offerWib.format(new Date(item.scheduled_check_in))} WIB</td>
                  <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-1 font-semibold ${item.status === 'SENT' ? 'border-[#accdb9] bg-[#e9f6ed] text-[#27654c]' : 'border-[#e2c58e] bg-[#fff1d4] text-[#84632c]'}`}>{offerStatus[item.status]}</span></td>
                  <td className="px-3 py-3"><Button type="button" size="sm" className="h-8 px-3" onClick={() => { setListOpen(false); select(item.id); }}>Lihat</Button></td>
                </tr>)}
              </tbody>
            </table>
          </div>}
          {showAll && <PageActions page={page} count={list.data.count} setPage={setPage} />}
        </>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#d8cab1] pt-4">
          <Button type="button" variant="outline" onClick={() => setListOpen(false)}>Tutup</Button>
          {list.isSuccess && list.data.count > 5 && <Button type="button" onClick={() => { setShowAll(true); setPage(0); }}>Lihat Semua Reservasi</Button>}
        </div>
      </DialogContent>
    </Dialog>

    {selected && <OfferDialog key={selected} id={selected} owner={owner} canConvert={conversionAllowed} close={() => select(null)} convert={convert} />}
  </>;
}

function OfferDialog({ id, owner, canConvert, close, convert }: {
  id: string; owner: boolean; canConvert: boolean; close: () => void; convert: (offer: OfferDetail) => void;
}) {
  const client = useQueryClient();
  const detail = useQuery({ queryKey: [...offerQueryKey, 'detail', id], queryFn: () => readOffer(id), refetchInterval: 5000 });
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const item = detail.isSuccess ? detail.data : null;
  const chatUrl = item ? whatsAppReservationChatUrl(item.phone, RESERVATION_CARD_CAPTION) : undefined;
  const [card, setCard] = useState<{ url: string; error: string } | null>(null);
  const [cardRetry, setCardRetry] = useState(0);
  // One immutable JPG per detail popup. Polling status never changes the image or its QRIS.
  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setCard(null);
    void makeReservationCardJpg(item).then(blob => {
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setCard({ url: objectUrl, error: '' });
    }).catch(error => {
      if (!cancelled) setCard({ url: '', error: error instanceof Error ? error.message : 'Kartu reservasi gagal dibuat.' });
    });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    // The reservation snapshot remains constant within the current detail popup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, cardRetry]);
  async function transition(action: 'sent' | 'cancel') {
    if (busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('transition_reservation_offer', { _id: id, _action: action });
      if (error || !data) throw new Error(error?.message ?? 'Status reservasi belum dapat dikonfirmasi.');
      const result = data as unknown as Offer;
      if (action === 'sent' && result.status === 'SENT') toast.success('Ditandai sudah dikirim oleh petugas.');
      else if (action === 'cancel' && result.status === 'CANCELLED') { toast.success('Reservasi dibatalkan.'); close(); }
      else { toast.error(result.reason ?? 'Reservasi tidak lagi aktif.'); close(); }
      void client.invalidateQueries({ queryKey: offerQueryKey });
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Gagal memperbarui reservasi.');
    } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-1.25rem)] max-w-xl overflow-y-auto rounded-[22px] border border-[#deca9f] bg-[#fffaf0] text-[#2c251b] shadow-[0_22px_60px_rgba(22,17,12,.26)]">
      <div className="rounded-xl bg-[#292119] px-4 py-4 text-[#fff5e5]"><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.16em] text-[#dabc7e]">Baturaden 25 Homestay</p><DialogTitle className="font-serif text-xl">Detail Reservasi</DialogTitle></div>
      <DialogDescription className="text-[var(--premium-ink)]">Permintaan ini belum mengunci kamar. Kirim rincian harga dan instruksi pembayaran melalui WhatsApp sebelum menandai terkirim.</DialogDescription>
      {detail.isPending && <p role="status">Memuat reservasi…</p>}
      {detail.isError && <p role="alert">Detail reservasi gagal dimuat. <button type="button" className="underline" onClick={() => void detail.refetch()}>Coba lagi</button></p>}
      {detail.isSuccess && !item && <p>Reservasi tidak lagi aktif. Lihat Riwayat Reservasi di Detail Tamu.</p>}
      {item && <>
        <div className="space-y-3 rounded-xl border border-[#e4d1af] bg-[#fffdf8] p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="font-serif text-lg">{item.guest_name}</strong><span className="rounded-full border border-[#dfc48d] bg-[#fff2d5] px-2 py-1 text-[11px] font-semibold">{offerStatus[item.status]}</span></div><p className="text-[#514131]"><span className="mr-2 inline-block rounded-md bg-[#30251b] px-2 py-1 font-bold text-[#f6db9e]">{item.room_number}</span>{item.room_type} · {item.package_name}</p><p className="text-xs text-[#685640]"><Slot offer={item} /></p><div className="grid grid-cols-2 gap-2 border-t border-[#e9d9bb] pt-3"><p><span className="block text-xs text-[#826c50]">Total Tagihan</span><strong>{rupiah(item.total)}</strong></p><p><span className="block text-xs text-[#826c50]">Minimum DP</span><strong>{rupiah(item.minimum_dp)}</strong></p></div></div>
        <section aria-label="Preview Kartu Reservasi QRIS" className="space-y-2">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#6f5738]"><ImageIcon aria-hidden="true" className="size-4" /> Kartu Reservasi & Pembayaran</p>
          {card?.error && <div role="alert" className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <p>{card.error} Kartu belum siap dikirim ke tamu.</p>
            <Button type="button" variant="outline" size="sm" className="border-red-400 bg-white text-red-800 hover:bg-red-100" onClick={() => setCardRetry(value => value + 1)}>Coba Buat Ulang Kartu</Button>
          </div>}
          {!card && <p role="status" className="rounded-xl border border-[#e3cda8] bg-[#fffdf8] p-8 text-center text-sm">Membuat kartu reservasi dengan QRIS resmi…</p>}
          {card?.url && <img src={card.url} alt={`Kartu reservasi ${item.guest_name}, kamar ${item.room_number}, QRIS Baturaden 25 Homestay`} className="mx-auto max-h-[56vh] w-auto max-w-full rounded-xl border border-[#d9b573] object-contain shadow-[0_8px_25px_rgba(23,17,8,0.18)]" />}
          <p className="text-xs leading-relaxed text-[#765c3a]">Kartu ini belum menjadi bukti Booking resmi. Data diambil dari reservasi yang tersimpan; pembayaran masih harus diverifikasi.</p>
        </section>
        <div className="space-y-3 border-t border-[#e3d0af] pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6f5738]">Kirim kartu reservasi & QRIS</p>
          <div className="flex flex-wrap gap-2">
            {card?.url && <Button asChild variant="outline" className="min-h-10 border-[#bf933e] bg-[#f3d590] px-4 text-[#332411] hover:bg-[#e9c270] hover:text-[#332411]"><a href={card.url} download={reservationCardFilename(item)}><Download aria-hidden="true" />Unduh Kartu JPG</a></Button>}
            {card?.url && chatUrl && <Button asChild variant="outline" className="min-h-10 border-[#188347] bg-[#168844] px-4 text-white hover:border-[#126938] hover:bg-[#126938] hover:text-white"><a href={chatUrl} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Buka WhatsApp</a></Button>}
            {item.status === 'DRAFT' && <Button type="button" variant="outline" className="min-h-10 border-[#bd8c39] bg-[#e6b75f] px-4 text-[#30200c] hover:bg-[#d6a246] hover:text-[#30200c]" disabled={busy || !card?.url} onClick={() => void transition('sent')}><CheckCheck aria-hidden="true" />Sudah Dikirim</Button>}
          </div>
          {card?.url && !chatUrl && <p role="alert" className="text-xs text-red-800">Nomor WhatsApp tujuan belum valid. Periksa nomor tamu sebelum mengirim kartu.</p>}
          <p className="text-xs leading-relaxed text-[#7c6545]"><strong>Urutan kirim:</strong> unduh JPG, buka WhatsApp dengan caption singkat, lampirkan file JPG, kirim manual, lalu tandai <strong>Sudah Dikirim</strong>. Tombol WhatsApp tidak melampirkan gambar secara otomatis.</p>
          {(canConvert || owner) && <div className="flex flex-wrap items-center gap-2 border-t border-[#e3d0af] pt-3">
            {canConvert && <Button type="button" variant="outline" className="min-h-10 border-[#54422c] bg-[#30271d] px-4 text-[#f8deb0] hover:bg-[#483521] hover:text-[#fff1d5]" disabled={busy} onClick={() => convert(item)}><CreditCard aria-hidden="true" />Telah Dibayar · Verifikasi</Button>}
            {owner && <Button type="button" variant="outline" className={confirmCancel ? 'min-h-10 border-[#a92e28] bg-[#ac302b] px-4 text-white hover:bg-[#8e251f] hover:text-white' : 'min-h-10 border-[#d9b9ae] bg-[#fff9f4] px-4 text-[#973b2d] hover:bg-[#fce9e4] hover:text-[#872d22]'} disabled={busy} onClick={() => {
              if (confirmCancel) void transition('cancel'); else setConfirmCancel(true);
            }}><XCircle aria-hidden="true" />{confirmCancel ? 'Ya, batalkan reservasi' : 'Batalkan'}</Button>}
          </div>}
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}
