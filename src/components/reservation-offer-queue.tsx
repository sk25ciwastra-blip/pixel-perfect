import { useEffect, useState } from 'react';
import { ChevronRight, FileText } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { rupiah } from '@/lib/data-contoh';
import { supabase } from '@/integrations/supabase/client';
import { offerQueryKey, offerStatus, offerWhatsApp, offerWib, readOffer, readOffers, type Offer, type OfferDetail } from '@/lib/reservation-offers';

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
  if (history.isPending) return <p role="status">Memuat riwayat penawaran…</p>;
  if (history.isError) return <p role="alert">Riwayat penawaran gagal dimuat.</p>;
  return <div className="space-y-3 py-3 text-sm">
    <p>{history.data.count} penawaran · {history.data.failed_count ?? 0} gagal karena kamar tidak tersedia</p>
    {!history.data.rows.length && <p>Belum ada penawaran pada halaman ini.</p>}
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
      className="panel-mewah group relative flex min-w-0 flex-row items-center gap-2.5 overflow-hidden px-3.5 py-4 text-left transition hover:-translate-y-0.5 hover:border-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      aria-haspopup="dialog"
      aria-label="Buka daftar Penawaran Menunggu"
      onClick={openList}
    >
      <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-gold/[0.07] blur-2xl" />
      <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold/10 text-gold"><FileText className="size-6" strokeWidth={1.5} aria-hidden="true" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.8rem] leading-tight text-foreground/85">Penawaran Menunggu</span>
        <span className="mt-1.5 block truncate text-[1.6rem] font-bold leading-none tabular-nums text-foreground">{list.isSuccess ? list.data.count : '—'}</span>
        <span className="mt-1.5 block text-[11px] leading-snug text-gold-light">{list.isError ? 'Gagal memuat · klik untuk mencoba lagi' : 'perlu tindak lanjut'}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-gold" />
    </button>

    <Dialog open={listOpen && !selected} onOpenChange={open => { if (!open) setListOpen(false); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-[var(--premium-line)] bg-[var(--success-paper)] text-[var(--premium-ink)]">
        <DialogTitle className="font-serif text-xl">Penawaran Menunggu</DialogTitle>
        <DialogDescription className="text-[var(--premium-ink)]">Daftar penawaran yang perlu ditindaklanjuti. Penawaran belum mengunci kamar dan belum menjadi Booking resmi.</DialogDescription>
        {list.isPending && <p role="status" className="py-6 text-sm">Memuat penawaran…</p>}
        {list.isError && <p role="alert" className="py-3 text-sm">Daftar penawaran gagal dimuat. <button type="button" className="font-semibold underline" onClick={() => void list.refetch()}>Coba lagi</button></p>}
        {list.isSuccess && <>
          <p className="text-xs">{list.data.count} penawaran aktif</p>
          {!list.data.rows.length && <p className="rounded-xl border border-[var(--premium-line)] p-5 text-center text-sm">Belum ada penawaran yang menunggu.</p>}
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
                {(showAll ? list.data.rows : list.data.rows.slice(0, 5)).map(item => <tr key={item.id} className="bg-[#fffaf0] text-[#28231c]">
                  <td className="break-words px-3 py-3 font-semibold">{item.guest_name}</td>
                  <td className="px-3 py-3 tabular-nums">••••{item.phone_last4}</td>
                  <td className="break-words px-3 py-3">{item.room_number} · {item.room_type}</td>
                  <td className="px-3 py-3 tabular-nums">{offerWib.format(new Date(item.scheduled_check_in))} WIB</td>
                  <td className="px-3 py-3">{offerStatus[item.status]}</td>
                  <td className="px-3 py-3"><Button type="button" size="sm" className="h-8 px-3" onClick={() => { setListOpen(false); select(item.id); }}>Lihat</Button></td>
                </tr>)}
              </tbody>
            </table>
          </div>}
          {showAll && <PageActions page={page} count={list.data.count} setPage={setPage} />}
        </>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#d8cab1] pt-4">
          <Button type="button" variant="outline" onClick={() => setListOpen(false)}>Tutup</Button>
          {list.isSuccess && list.data.count > 5 && <Button type="button" onClick={() => { setShowAll(true); setPage(0); }}>Lihat Semua Penawaran</Button>}
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
  let draft: ReturnType<typeof offerWhatsApp> | null = null;
  if (item) {
    try { draft = offerWhatsApp(item); } catch { /* A changed guest record can make a saved draft invalid. */ }
  }
  async function transition(action: 'sent' | 'cancel') {
    if (busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('transition_reservation_offer', { _id: id, _action: action });
      if (error || !data) throw new Error(error?.message ?? 'Status penawaran belum dapat dikonfirmasi.');
      const result = data as unknown as Offer;
      if (action === 'sent' && result.status === 'SENT') toast.success('Ditandai sudah dikirim oleh petugas.');
      else if (action === 'cancel' && result.status === 'CANCELLED') { toast.success('Penawaran dibatalkan.'); close(); }
      else { toast.error(result.reason ?? 'Penawaran tidak lagi aktif.'); close(); }
      void client.invalidateQueries({ queryKey: offerQueryKey });
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Gagal memperbarui penawaran.');
    } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto rounded-xl bg-[var(--success-paper)] text-[var(--premium-ink)]">
      <DialogTitle>Detail Penawaran</DialogTitle>
      <DialogDescription className="text-[var(--premium-ink)]">Penawaran tidak menahan kamar. Tandai dikirim hanya setelah mengirim pesan di WhatsApp.</DialogDescription>
      {detail.isPending && <p role="status">Memuat penawaran…</p>}
      {detail.isError && <p role="alert">Detail penawaran gagal dimuat. <button type="button" className="underline" onClick={() => void detail.refetch()}>Coba lagi</button></p>}
      {detail.isSuccess && !item && <p>Penawaran tidak lagi aktif. Lihat Riwayat Penawaran di Detail Tamu.</p>}
      {item && <>
        <p className="break-words text-sm"><strong>{item.guest_name}</strong> · {offerStatus[item.status]}<br />
          Kamar {item.room_number} · {item.room_type} · {item.package_name}<br /><Slot offer={item} /><br />
          {rupiah(item.total)} · DP {rupiah(item.minimum_dp)}</p>
        {draft ? <textarea aria-label="Pesan penawaran" readOnly value={draft.message} className="h-40 min-w-0 rounded-lg border border-[var(--premium-line)] p-2 text-sm" />
          : <p role="alert">Pesan tidak dapat dibuat dari data tamu saat ini.</p>}
        <div className="flex flex-wrap gap-2">
          {draft?.url && <Button asChild variant="outline"><a href={draft.url} target="_blank" rel="noopener noreferrer">{item.status === 'SENT' ? 'Buka Ulang WhatsApp' : 'Buka WhatsApp'}</a></Button>}
          {draft && <Button type="button" variant="outline" onClick={async () => {
            try { await navigator.clipboard.writeText(draft.message); toast.success('Pesan disalin.'); }
            catch { toast.error('Pilih dan salin teks di atas.'); }
          }}>Salin Pesan</Button>}
          {item.status === 'DRAFT' && <Button type="button" variant="outline" disabled={busy} onClick={() => void transition('sent')}>Sudah Dikirim</Button>}
          {canConvert && <Button type="button" disabled={busy} onClick={() => convert(item)}>Konfirmasi Pembayaran & Booking</Button>}
          {owner && <Button type="button" variant="outline" disabled={busy} onClick={() => {
            if (confirmCancel) void transition('cancel'); else setConfirmCancel(true);
          }}>{confirmCancel ? 'Ya, batalkan penawaran' : 'Batalkan'}</Button>}
        </div>
      </>}
    </DialogContent>
  </Dialog>;
}
