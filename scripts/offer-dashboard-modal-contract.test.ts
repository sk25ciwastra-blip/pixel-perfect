import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/routes/index.tsx', 'utf8');
const queue = readFileSync('src/components/reservation-offer-queue.tsx', 'utf8');
const booking = readFileSync('src/components/formulir-pemesanan.tsx', 'utf8');

test('Aksi Cepat has one RESERVASI entry, never duplicate PENAWARAN or paid Booking', () => {
  const start = dashboard.indexOf('{/* KPI + Aksi Cepat */}');
  const end = dashboard.indexOf('{/* Tabel kamar', start);
  const block = dashboard.slice(start, end);
  expect(start).toBeGreaterThan(-1);
  expect(block.indexOf('judul="CHECK-IN"')).toBeLessThan(block.indexOf('judul="RESERVASI"'));
  expect(block.indexOf('judul="RESERVASI"')).toBeLessThan(block.indexOf('judul="EXPENSE"'));
  expect(block).not.toContain('judul="PENAWARAN"');
  expect(block).toContain('judul="RESERVASI" rapat onClick={() => setModal("offer")}');
  expect(block).toContain('canQuote && <OfferQueue');
  expect(dashboard).not.toContain('modal === "booking"');
});
test('clickable Reservasi Menunggu opens pending payment queue, not an official Booking', () => {
  for (const text of ['Reservasi Menunggu', 'aria-haspopup="dialog"', 'onClick={openList}',
    'open={listOpen && !selected}', 'Tidak ada reservasi yang menunggu pembayaran.',
    'Kamar / Tipe', 'Check-in', 'Status', 'Aksi', 'Lihat Semua Reservasi',
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
  expect(queue).toContain('Telah Dibayar · Verifikasi');
  expect(queue).toContain('convert(item)');
  expect(dashboard).toContain('setConvertOffer(offer)');
  expect(dashboard).toContain('mode="booking" offer={convertOffer}');
  expect(booking).toContain('Saya sudah memverifikasi pembayaran yang benar-benar diterima.');
  expect(booking).toContain("if (!paymentVerified || isTraining || methods.length !== 1)");
  expect(booking).toContain("'transition_reservation_offer'");
  expect(booking).toContain("_payment_verified: paymentVerified");
  expect(booking).toContain("result.status !== 'CONVERTED' || !result.transaction_number");
  expect(booking).toContain('Verifikasi Pembayaran & Terbitkan TRX');
  expect(queue).toContain('Lampirkan QRIS resmi secara manual');
});
test('dashboard continues using real room occupancy and housekeeping action indicator', () => {
  expect(dashboard).toContain('nilai: String(jumlahTerisi)');
  expect(dashboard).toContain('nilai: indikator.perluTindakan === null ? "—"');
  expect(dashboard).toContain('canQuote ? [');
  expect(dashboard).toContain('label: "Kamar Terisi"');
  expect(dashboard).toContain('label: "Perlu Tindakan"');
  expect(dashboard).toContain('label: "Booking Aktif"'); // unchanged fallback for other roles
});

test('No duplicate Penawaran language leaks into the one-door Reservation interface', () => {
  expect(dashboard).not.toContain('judul="PENAWARAN"');
  expect(queue).not.toContain('Penawaran Menunggu');
  expect(queue).not.toContain('Detail Penawaran');
  expect(queue).toContain('Ya, batalkan reservasi');
  expect(booking).not.toContain('Ringkasan Penawaran');
  expect(booking).toContain('Ringkasan Reservasi');
});
