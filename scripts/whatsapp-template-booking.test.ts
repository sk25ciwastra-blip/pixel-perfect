import { describe, expect, it } from 'bun:test';
import { formatBookingQuote, type BookingQuoteDraft } from '../src/lib/booking-quote';
import { renderWhatsAppTemplate } from '../src/lib/whatsapp-template-core';

const booking: BookingQuoteDraft = {
  name: 'Andin', phone: '081234567890', roomNumber: '03', roomType: 'Superior A',
  packageName: 'Paket 2 Jam', checkIn: '2026-11-25T11:00:00+07:00',
  guestCount: 2, dayMode: 'weekday', roomPrice: 100000, extraCharge: 0, total: 100000,
  minimumDp: 50000, dpMode: 'PERCENTAGE', dpValue: 50,
};
const schedule = {
  scheduled_check_in: '2026-11-25T11:00:00+07:00',
  scheduled_check_out: '2026-11-25T13:00:00+07:00',
};

describe('Booking quote / Owner template integration values', () => {
  it('uses existing quote values and official schedule, without another price engine', () => {
    const verified = formatBookingQuote(booking, schedule);
    const message = renderWhatsAppTemplate('PENAWARAN_RESERVASI',
      'Halo [NAMA_TAMU]. Kamar [NOMOR_KAMAR]. [CHECKIN_WIB] - [CHECKOUT_WIB]. Total [TOTAL_TAGIHAN], DP [DP_MINIMUM].',
      verified.templateValues);
    expect(message).toContain('Halo Andin. Kamar 03.');
    expect(message).toContain('Rp 100.000');
    expect(message).toContain('Rp 50.000');
    expect(message).toContain('WIB');
    expect(verified.message).toContain('Ketersediaan kamar dapat berubah');
    expect(verified.phone).toBe('6281234567890');
  });
  it('refuses unsupported DP percent when minimum DP mode is fixed nominal', () => {
    const verified = formatBookingQuote({ ...booking, dpMode: 'AMOUNT', dpValue: 50000 }, schedule);
    expect(() => renderWhatsAppTemplate('PENAWARAN_RESERVASI',
      'Minimum DP [DP_PERSEN]', verified.templateValues)).toThrow();
  });
  it('never fabricates booking TRX in quote templates', () => {
    const verified = formatBookingQuote(booking, schedule);
    expect(() => renderWhatsAppTemplate('PENAWARAN_RESERVASI',
      '[NAMA_TAMU] - [NOMOR_TRANSAKSI]', verified.templateValues)).toThrow();
  });
});
