/** Owner-approved Reservation Summary, supplied 25 Nov 2026.
 * This is only a default in the Owner editor, not an ACTIVE database version.
 * The Owner must explicitly save it using the audited RPC.
 * Price/DP and dates are sourced from validated quote placeholders.
 */
export const OWNER_APPROVED_QUOTE_TEMPLATE = [
  '*BATURADEN 25 HOMESTAY*',
  '*— RINCIAN PENAWARAN RESERVASI —*',
  '',
  'Halo Kak [NAMA_TAMU],',
  'Berikut rincian reservasi yang Kakak ajukan.',
  '',
  '*DETAIL RESERVASI*',
  'Tipe Kamar : [TIPE_KAMAR]',
  'No. Kamar : [NOMOR_KAMAR]',
  'Paket : [PAKET]',
  'Check-in : [CHECKIN_WIB]',
  'Check-out : [CHECKOUT_WIB]',
  'Jumlah Tamu : [JUMLAH_TAMU] Orang',
  '',
  '*RINCIAN PEMBAYARAN*',
  'Harga Kamar : [HARGA_KAMAR]',
  'Biaya Tambahan : [BIAYA_TAMBAHAN]',
  '*Total Tagihan : [TOTAL_TAGIHAN]*',
  '',
  'Minimum DP : *[DP_MINIMUM]*',
  'Pembayaran Lunas : *[TOTAL_TAGIHAN]*',
  '',
  '*INFORMASI RESERVASI*',
  'Reservasi akan dikonfirmasi setelah pembayaran diverifikasi oleh Admin. Ketersediaan kamar dapat berubah sebelum Booking dikonfirmasi.',
  '',
  'Terima kasih telah memilih *Baturaden 25 Homestay*.',
  'Kami menantikan kedatangan Kakak! ✨',
].join('\n');
