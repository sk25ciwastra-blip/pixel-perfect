import { describe, expect, it } from 'bun:test';
import type { PaymentConfirmation } from '../src/lib/payment-confirmation';
import { confirmationTemplateValues, renderConfirmationTemplate } from '../src/lib/whatsapp-confirmation-template';

const document = {
  transactionId: 'tx-1',
  transactionNumber: 'BTRDTRX-000027',
  transactionStatus: 'booking',
  guest: { name: 'Andin', phone: '081234567890' },
  room: { number: '03', type: 'Superior A' },
  package: { code: 'P2', name: 'Paket 2 Jam' },
  guests: { total: 2, extra: 0, unitPrice: 0 },
  times: {
    scheduledCheckIn: '25 Nov 2026, 08:30 WIB',
    scheduledCheckOut: '25 Nov 2026, 10:30 WIB',
    actualCheckIn: 'Not available',
    checkoutDeadline: '25 Nov 2026, 10:30 WIB',
    actualCheckOut: 'Not available',
  },
  totals: {
    room: 120000, extraGuest: 0, bill: 120000, grossPaid: 60000,
    refunded: 0, netPaid: 60000, remaining: 60000, credit: 0,
    status: 'PARTIALLY PAID',
  },
  history: [{
    id: 'pay-1', type: 'payment', date: '25 Nov 2026 07:00 WIB',
    kind: 'Deposit (DP)', method: 'QRIS', amount: 60000,
  }],
} as PaymentConfirmation;

describe('Poin4 WhatsApp confirmed financial values', () => {
  it('uses validated official booking details and payment snapshot', () => {
    const message = renderConfirmationTemplate('KONFIRMASI_BOOKING',
      'Booking [NOMOR_TRANSAKSI] [NAMA_TAMU] [CHECKIN_WIB] total [TOTAL_TAGIHAN] DP [DP_DITERIMA] sisa [SISA_TAGIHAN].',
      document);
    expect(message).toContain('BTRDTRX-000027');
    expect(message).toContain('08:30 WIB');
    expect(message.replaceAll('\u00a0', ' ')).toContain('Rp 120.000');
    expect(message.replaceAll('\u00a0', ' ')).toContain('Rp 60.000');
    expect(message).not.toContain('[SISA_TAGIHAN]');
  });
  it('reports NET paid and outstanding from ledger, not gross when refunded', () => {
    const refunded = { ...document, totals: { ...document.totals,
      grossPaid: 120000, refunded: 30000, netPaid: 90000, remaining: 30000 } } as PaymentConfirmation;
    const values = confirmationTemplateValues('KONFIRMASI_PEMBAYARAN', refunded);
    expect(String(values.TOTAL_DIBAYAR_BERSIH).replaceAll('\u00a0', ' ')).toBe('Rp 90.000');
    expect(String(values.SISA_TAGIHAN).replaceAll('\u00a0', ' ')).toBe('Rp 30.000');
  });
  it('does not claim refunded gross DP as net DP received', () => {
    const withRefund = { ...document, totals: { ...document.totals,
      refunded: 30000, grossPaid: 60000, netPaid: 30000, remaining: 90000 } } as PaymentConfirmation;
    const values = confirmationTemplateValues('KONFIRMASI_BOOKING', withRefund);
    expect(values.DP_DITERIMA).toBeNull();
    expect(() => renderConfirmationTemplate('KONFIRMASI_BOOKING',
      'DP netto [DP_DITERIMA]', withRefund)).toThrow();
    expect(renderConfirmationTemplate('KONFIRMASI_BOOKING',
      'Sisa [SISA_TAGIHAN]', withRefund)).toContain('90.000');
  });
  it('never describes walk-in as Booking confirmed', () => {
    const walkin = { ...document, times: { ...document.times,
      scheduledCheckIn: 'Not available', scheduledCheckOut: 'Not available' } } as PaymentConfirmation;
    expect(() => confirmationTemplateValues('KONFIRMASI_BOOKING', walkin)).toThrow();
    expect(confirmationTemplateValues('KONFIRMASI_PEMBAYARAN', walkin).NOMOR_TRANSAKSI).toBe('BTRDTRX-000027');
  });
  it('denies cancelled transactions and missing ledger identity', () => {
    expect(() => confirmationTemplateValues('KONFIRMASI_PEMBAYARAN',
      { ...document, transactionStatus: 'cancelled' })).toThrow();
    expect(() => confirmationTemplateValues('KONFIRMASI_PEMBAYARAN',
      { ...document, transactionNumber: 'INVALID' })).toThrow();
    expect(() => confirmationTemplateValues('KONFIRMASI_PEMBAYARAN',
      { ...document, totals: { ...document.totals, netPaid: NaN } })).toThrow();
  });
  it('does not allow unauthorized placeholder even with official data', () => {
    expect(() => renderConfirmationTemplate('KONFIRMASI_PEMBAYARAN',
      'Payment [NOMOR_TRANSAKSI] [NO_WHATSAPP]', document)).toThrow();
  });
});
