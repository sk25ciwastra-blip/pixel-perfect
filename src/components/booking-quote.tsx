import { rupiah } from '@/lib/data-contoh';
import type { BookingQuoteDraft } from '@/lib/booking-quote';

// Booking forms only display the verified pricing summary. Drafting and sending
// reservation offers is exclusively handled by Dashboard > PENAWARAN.
export function BookingQuote({ draft, dayReady, loading, loadError }: {
  draft: BookingQuoteDraft;
  dayReady: boolean;
  loading: boolean;
  loadError: boolean;
}) {
  const priceReady = dayReady && Boolean(draft.roomNumber && draft.packageName)
    && Number.isFinite(draft.roomPrice) && draft.roomPrice > 0;
  const dpWarning = priceReady && draft.minimumDp === null && !loading && !loadError;

  return <section aria-label="Ringkasan Harga Booking" className="ci-notice space-y-2">
    <h4 className="font-semibold">Ringkasan Harga Booking</h4>
    {loading ? <p>Memuat data harga resmi…</p> : loadError ? <p>Data harga resmi gagal dimuat.</p> : priceReady ? (
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
  </section>;
}
