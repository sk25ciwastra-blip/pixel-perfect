import { expect, test } from 'bun:test';
import { buildPaymentConfirmation, type ConfirmationInput } from '../src/lib/payment-confirmation';
import { confirmationDownloadFilename } from '../src/lib/payment-confirmation-filename';

function source(scheduled: string | null = '2026-11-12T06:58:00+07:00'): ConfirmationInput {
  return {
    transaction: { id: 'tx', transaction_number: 'BTRDTRX-000025', status: 'check_in',
      guest_id: 'guest', room_id: 'room', package_id: 'pkg', price_snapshot: 80000,
      base_price_snapshot: 80000, extra_guest_charge: 0, extra_guest_count: 0,
      extra_guest_unit_price: 50000, guest_count: 2, scheduled_check_in: scheduled,
      scheduled_check_out: '2026-11-12T08:58:00+07:00',
      started_at: '2026-11-12T07:13:12+07:00', ends_at: '2026-11-12T08:58:00+07:00',
      checked_out_at: null, updated_at: '2026-11-12T07:13:12+07:00' },
    guest: { id: 'guest', full_name: 'Dewi Putri', phone: '+62 812-3456-7890' },
    room: { id: 'room', room_number: '03', room_type_id: 'type' },
    roomType: { id: 'type', name: 'Superior' },
    package: { id: 'pkg', name: 'Paket 2 Jam', time_mode: 'duration_midnight_cap' },
    payments: [], refunds: [], refundsComplete: true, canReadGuestPhone: true,
    business: { name: 'Baturaden 25 Homestay', address: 'Addr', city: 'Bandung', whatsapp: 'official' },
    generatedAt: '2026-11-12T07:14:00+07:00',
  };
}

test('Booking remains RESERVASI after check-in and checkout; PDF/JPG share naming', () => {
  const booking = buildPaymentConfirmation(source());
  expect(booking.origin).toBe('BOOKING');
  expect(confirmationDownloadFilename(booking, 'pdf')).toBe('RESERVASI-DEWI-PUTRI-7890-BTRDTRX-000025.pdf');
  expect(confirmationDownloadFilename(booking, 'jpg')).toBe('RESERVASI-DEWI-PUTRI-7890-BTRDTRX-000025.jpg');
  const completed = source();
  completed.transaction.status = 'check_out';
  completed.transaction.checked_out_at = '2026-11-12T08:45:00+07:00';
  expect(confirmationDownloadFilename(buildPaymentConfirmation(completed), 'pdf')).toBe('RESERVASI-DEWI-PUTRI-7890-BTRDTRX-000025.pdf');
});

test('Walk-in uses CHECKIN even when complete, and sanitizes unsafe guest names', () => {
  const walkIn = source(null);
  walkIn.guest.full_name = '  Rénée / ../ O\\Neil: * Test  ';
  expect(confirmationDownloadFilename(buildPaymentConfirmation(walkIn), 'pdf')).toBe('CHECKIN-RENEE-O-NEIL-TEST-7890-BTRDTRX-000025.pdf');
  walkIn.transaction.status = 'check_out';
  walkIn.transaction.checked_out_at = '2026-11-12T08:45:00+07:00';
  expect(confirmationDownloadFilename(buildPaymentConfirmation(walkIn), 'jpg')).toStartWith('CHECKIN-');
});

test('no invented four digits when guest phone is absent; invalid identity fails safely', () => {
  const input = source();
  input.guest.phone = null;
  expect(confirmationDownloadFilename(buildPaymentConfirmation(input), 'pdf')).toContain('-TANPAWA-');
  input.guest.full_name = '../../';
  expect(() => confirmationDownloadFilename(buildPaymentConfirmation(input), 'pdf')).toThrow('Nama tamu');
  const valid = buildPaymentConfirmation(source());
  expect(() => confirmationDownloadFilename({ ...valid, transactionNumber: 'other/path' }, 'pdf')).toThrow('Nomor transaksi');
  expect(() => confirmationDownloadFilename({ ...valid, origin: 'UNSUPPORTED' as 'BOOKING' }, 'pdf')).toThrow('Jenis transaksi');
});
