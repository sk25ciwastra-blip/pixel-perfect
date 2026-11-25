import { confirmationMoney, type PaymentConfirmation } from './payment-confirmation';
import { renderWhatsAppTemplate, type WhatsAppTemplateKind, type WhatsAppTemplateValues } from './whatsapp-template-core';

/**
 * Text-only WhatsApp placeholders from the same validated financial document as PDF/JPG.
 * Caller MUST first load with loadPaymentConfirmation (authorized, complete ledger).
 * No DB reads, monetary recalculation, WA sends or document mutations here.
 */
export function confirmationTemplateValues(
  kind: Extract<WhatsAppTemplateKind, 'KONFIRMASI_BOOKING' | 'KONFIRMASI_PEMBAYARAN'>,
  document: PaymentConfirmation,
): WhatsAppTemplateValues {
  if (!document.transactionId || !/^BTRDTRX-\d+$/.test(document.transactionNumber)) {
    throw new Error('Identitas transaksi resmi belum valid.');
  }
  if (document.transactionStatus === 'cancelled') {
    throw new Error('Transaksi dibatalkan; konfirmasi baru tidak boleh dibuat.');
  }
  if (!document.guest.name.trim() || !document.room.number || !document.room.type) {
    throw new Error('Identitas tamu atau kamar belum valid.');
  }
  const { totals, times } = document;
  if (!Number.isFinite(totals.bill) || !Number.isFinite(totals.netPaid) ||
      !Number.isFinite(totals.remaining) || !['PAID', 'PARTIALLY PAID', 'UNPAID'].includes(totals.status)) {
    throw new Error('Ledger pembayaran resmi belum valid.');
  }
  if (kind === 'KONFIRMASI_BOOKING') {
    // Booking must have a real scheduled slot. A walk-in must never be advertised as a reservation.
    if (times.scheduledCheckIn === 'Not available' || times.scheduledCheckOut === 'Not available') {
      throw new Error('Jadwal resmi Booking tidak tersedia; tidak boleh membuat konfirmasi Booking.');
    }
    if (!document.package.name || !Number.isSafeInteger(document.guests.total)) {
      throw new Error('Paket atau jumlah tamu belum valid.');
    }
    return {
      NAMA_TAMU: document.guest.name,
      NOMOR_TRANSAKSI: document.transactionNumber,
      TIPE_KAMAR: document.room.type,
      NOMOR_KAMAR: document.room.number,
      PAKET: document.package.name,
      CHECKIN_WIB: times.scheduledCheckIn,
      CHECKOUT_WIB: times.scheduledCheckOut,
      JUMLAH_TAMU: String(document.guests.total),
      TOTAL_TAGIHAN: confirmationMoney(totals.bill),
      // Refund entries do not uniquely identify which DP payment they reverse.
      // Never label gross DP as "received" after any refund; omit the token
      // until a transaction-scoped net DP allocation can be verified.
      DP_DITERIMA: totals.refunded > 0 ? null : confirmationMoney(document.history
        .filter(entry => entry.type === 'payment' && entry.kind === 'Deposit (DP)')
        .reduce((value, entry) => value + entry.amount, 0)),
      SISA_TAGIHAN: confirmationMoney(totals.remaining),
      STATUS_PEMBAYARAN: totals.status,
    };
  }
  return {
    NAMA_TAMU: document.guest.name,
    NOMOR_TRANSAKSI: document.transactionNumber,
    TOTAL_TAGIHAN: confirmationMoney(totals.bill),
    TOTAL_DIBAYAR_BERSIH: confirmationMoney(totals.netPaid),
    SISA_TAGIHAN: confirmationMoney(totals.remaining),
    STATUS_PEMBAYARAN: totals.status,
  };
}

export function renderConfirmationTemplate(
  kind: Extract<WhatsAppTemplateKind, 'KONFIRMASI_BOOKING' | 'KONFIRMASI_PEMBAYARAN'>,
  body: string,
  document: PaymentConfirmation,
): string {
  return renderWhatsAppTemplate(kind, body, confirmationTemplateValues(kind, document));
}
