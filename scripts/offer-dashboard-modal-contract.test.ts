import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/routes/index.tsx', 'utf8');
const queue = readFileSync('src/components/reservation-offer-queue.tsx', 'utf8');
const booking = readFileSync('src/components/formulir-pemesanan.tsx', 'utf8');

test('Aksi Cepat has four actions, Penawaran between Reservasi and Expense', () => {
  const start = dashboard.indexOf('{/* KPI + Aksi Cepat */}');
  const end = dashboard.indexOf('{/* Tabel kamar', start);
  const block = dashboard.slice(start, end);
  expect(start).toBeGreaterThan(-1);
  expect(block.indexOf('judul="CHECK-IN"')).toBeLessThan(block.indexOf('judul="RESERVASI"'));
  expect(block.indexOf('judul="RESERVASI"')).toBeLessThan(block.indexOf('judul="PENAWARAN"'));
  expect(block.indexOf('judul="PENAWARAN"')).toBeLessThan(block.indexOf('judul="EXPENSE"'));
  expect(block).toContain('canQuote && <OfferQueue');
  expect(block).not.toContain('BUAT PENAWARAN');
});
test('clickable Penawaran Menunggu opens a table modal, not a booking', () => {
  for (const text of ['Penawaran Menunggu', 'aria-haspopup="dialog"', 'onClick={openList}',
    'open={listOpen && !selected}', 'Belum ada penawaran yang menunggu.',
    'Kamar / Tipe', 'Check-in', 'Status', 'Aksi', 'Lihat Semua Penawaran',
    'onClick={() => { setListOpen(false); select(item.id); }}']) {
    expect(queue).toContain(text);
  }
  expect(queue).toContain('list.data.rows.slice(0, 5)');
  expect(queue).toContain('••••{item.phone_last4}');
  expect(queue).toContain('const list = useQuery');
  expect(queue).toContain("queryFn: () => readOffers(page)");
  expect(queue).not.toContain('create_reservation(');
});
test('Lihat detail leads to verified official Booking flow, never auto converts', () => {
  expect(queue).toContain('Konfirmasi Pembayaran & Booking');
  expect(queue).toContain('convert(item)');
  expect(dashboard).toContain('setConvertOffer(offer)');
  expect(dashboard).toContain('mode="booking" offer={convertOffer}');
  expect(booking).toContain('Saya sudah memverifikasi pembayaran yang benar-benar diterima.');
  expect(booking).toContain("if (!paymentVerified || isTraining || methods.length !== 1)");
  expect(booking).toContain("'transition_reservation_offer'");
  expect(booking).toContain("_payment_verified: paymentVerified");
  expect(booking).toContain("result.status !== 'CONVERTED' || !result.transaction_number");
});
test('dashboard continues using real room occupancy and housekeeping action indicator', () => {
  expect(dashboard).toContain('nilai: String(jumlahTerisi)');
  expect(dashboard).toContain('nilai: indikator.perluTindakan === null ? "—"');
  expect(dashboard).toContain('canQuote ? [');
  expect(dashboard).toContain('label: "Kamar Terisi"');
  expect(dashboard).toContain('label: "Perlu Tindakan"');
  expect(dashboard).toContain('label: "Booking Aktif"'); // unchanged fallback for other roles
});
