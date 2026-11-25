/** Owner-requested Overtime WhatsApp COPY draft, 26 Nov 2026.
 * NOT an authorization to calculate, post, or automatically send any overtime charge.
 * Only manual Receptionist handling after the 15-minute notification window.
 * No ACTIVE version until Owner saves through the separately authorized RPC.
 */
export const OWNER_OVERTIME_NOTIFICATION_DRAFT = [
  '*BATURADEN 25 HOMESTAY*',
  '*— PEMBERITAHUAN OVERTIME —*',
  '',
  'Halo Kak [NAMA_TAMU] 👋',
  '',
  'Kami informasikan bahwa masa menginap Kakak telah melewati batas Check-out beserta waktu toleransi 15 menit, sehingga saat ini telah memasuki *waktu overtime*.',
  '',
  '*DETAIL MENGINAP*',
  'No. Transaksi : [NOMOR_TRANSAKSI]',
  'No. Kamar : [NOMOR_KAMAR]',
  'Batas Check-out : [BATAS_CHECKOUT_WIB]',
  '',
  '*PILIHAN LAYANAN*',
  '',
  '*Overtime:* Rp50.000 per jam, dengan konfirmasi dari admin.',
  '',
  '*Perpanjangan Menginap:* Menyesuaikan paket, tarif, dan ketersediaan kamar.',
  '',
  'Mohon segera menghubungi Receptionist untuk mengonfirmasi pilihan Kakak agar biaya dan waktu menginap dapat ditangani dengan tepat.',
  '',
  'Terima kasih atas pengertian dan kerja sama Kakak. 🙏',
  '',
  '*Baturaden 25 Homestay*',
].join('\n');
