import type { PaymentConfirmation } from './payment-confirmation';

/** Local download name only; never includes full telephone number or a guest address. */
export function confirmationFilename(data: Pick<PaymentConfirmation, 'transactionNumber' | 'guest' | 'documentKind'>, extension: 'pdf' | 'jpg') {
  const name = data.guest.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/g, '');
  const phoneDigits = (data.guest.phone ?? '').replace(/\D/g, '');
  const trx = data.transactionNumber.replace(/[^a-zA-Z0-9-]/g, '');
  if (!name || phoneDigits.length < 4 || !/^BTRDTRX-\d+$/.test(trx) ||
    !['RESERVASI', 'CHECKIN'].includes(data.documentKind)) {
    throw new Error('Identitas bukti digital belum lengkap; nama file tidak dapat dibuat.');
  }
  return `${data.documentKind}-${name}-${phoneDigits.slice(-4)}-${trx}.${extension}`;
}
