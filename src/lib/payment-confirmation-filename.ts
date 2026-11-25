import type { PaymentConfirmation } from './payment-confirmation';

/** Filename only: never changes payment data, renders or access decisions. */
export function confirmationDownloadFilename(
  data: Pick<PaymentConfirmation, 'origin' | 'guest' | 'transactionNumber'>,
  extension: 'pdf' | 'jpg',
) {
  const prefix = data.origin === 'BOOKING' ? 'RESERVASI' : data.origin === 'WALK_IN' ? 'CHECKIN' : null;
  if (!prefix) throw new Error('Jenis transaksi untuk nama bukti digital tidak dikenal.');
  const rawName = data.guest.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const name = rawName.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/g, '');
  if (!name) throw new Error('Nama tamu tidak valid untuk bukti digital.');
  const phoneDigits = (data.guest.phone ?? '').replace(/\D/g, '');
  const suffix = phoneDigits.length >= 4 ? phoneDigits.slice(-4) : 'TANPAWA';
  const trx = data.transactionNumber.trim().toUpperCase();
  if (!/^BTRDTRX-[0-9]{6,}$/.test(trx)) throw new Error('Nomor transaksi tidak valid untuk bukti digital.');
  return `${prefix}-${name}-${suffix}-${trx}.${extension}`;
}
