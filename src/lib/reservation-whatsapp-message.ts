import { rupiah } from '@/lib/data-contoh';
import { reservationCardFields } from '@/lib/reservation-card';
import type { OfferDetail } from '@/lib/reservation-offers';
import { renderWhatsAppTemplate } from '@/lib/whatsapp-template-core';

/** Only the official ACTIVE reservation template may be rendered. No send or payment side effects. */
export function renderPendingReservationMessage(offer: OfferDetail, activeTemplateBody: string) {
  if (offer.status !== 'DRAFT' && offer.status !== 'SENT') {
    throw new Error('Reservasi tidak lagi menunggu pembayaran. Jangan kirim penawaran lama.');
  }
  const card = reservationCardFields(offer);
  return renderWhatsAppTemplate('PENAWARAN_RESERVASI', activeTemplateBody, {
    NAMA_TAMU: card.name,
    TIPE_KAMAR: card.roomType,
    NOMOR_KAMAR: card.roomNumber,
    PAKET: card.packageName.replace(/^Paket\s+/i, ''),
    CHECKIN_WIB: card.checkIn,
    CHECKOUT_WIB: card.checkOut,
    JUMLAH_TAMU: String(card.guestCount),
    HARGA_KAMAR: rupiah(card.roomPrice),
    BIAYA_TAMBAHAN: rupiah(card.extraCharge),
    TOTAL_TAGIHAN: rupiah(card.total),
    DP_MINIMUM: rupiah(card.minimumDp),
    DP_PERSEN: offer.minimum_dp_mode === 'PERCENTAGE' ? `${offer.minimum_dp_value}%` : null,
  });
}

/** Freeze all customer-facing fields, to reject a copy if the saved reservation changes. */
export function pendingReservationMessageFingerprint(offer: OfferDetail) {
  return JSON.stringify([
    offer.id, offer.status, offer.guest_name, offer.address, offer.phone,
    offer.room_id, offer.room_number, offer.room_type, offer.package_id,
    offer.package_name, offer.scheduled_check_in, offer.scheduled_check_out,
    offer.day_mode, offer.guest_count, offer.total, offer.minimum_dp,
    offer.minimum_dp_mode, offer.minimum_dp_value,
  ]);
}
