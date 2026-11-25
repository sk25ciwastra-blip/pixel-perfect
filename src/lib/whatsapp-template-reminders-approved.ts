/** Owner approved both manual reminder messages, 25 Nov 2026.
 * Text is loaded as a draft only; no active version until Owner explicitly saves.
 */
export const OWNER_APPROVED_BOOKING_30_MIN_REMINDER = [
  '*BATURADEN 25 HOMESTAY*',
  '*— PENGINGAT RESERVASI —*',
  '',
  'Halo Kak [NAMA_TAMU],',
  '',
  'Kami ingin mengingatkan bahwa jadwal Check-in reservasi Kakak akan tiba dalam *30 menit lagi*.',
  '',
  '*DETAIL RESERVASI*',
  'No. Transaksi : [NOMOR_TRANSAKSI]',
  'Tipe Kamar : [TIPE_KAMAR]',
  'No. Kamar : [NOMOR_KAMAR]',
  'Check-in : [CHECKIN_WIB]',
  '',
  'Kami menantikan kedatangan Kakak di Baturaden 25 Homestay.',
  '',
  'Sampai bertemu! ✨',
].join('\n');

export const OWNER_APPROVED_STAY_END_REMINDER = [
  '*BATURADEN 25 HOMESTAY*',
  '*— PENGINGAT BATAS WAKTU —*',
  '',
  'Halo Kak [NAMA_TAMU],',
  '',
  'Kami ingin menginformasikan bahwa waktu menginap Kakak telah berakhir.',
  '',
  '*DETAIL KAMAR*',
  'No. Transaksi : [NOMOR_TRANSAKSI]',
  'No. Kamar : [NOMOR_KAMAR]',
  'Batas Check-out : [BATAS_CHECKOUT_WIB]',
  '',
  'Kami memberikan *waktu toleransi 15 menit* setelah batas Check-out sebelum dikenakan biaya overtime sesuai ketentuan yang berlaku.',
  '',
  'Mohon segera menghubungi Receptionist apabila Kakak membutuhkan bantuan.',
  '',
  'Terima kasih telah memilih Baturaden 25 Homestay. ✨',
].join('\n');
