import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync('src/routes/index.tsx', 'utf8');
const queue = readFileSync('src/components/reservation-offer-queue.tsx', 'utf8');
const booking = readFileSync('src/components/formulir-pemesanan.tsx', 'utf8');
const reservationMessage = readFileSync('src/components/reservation-whatsapp-message.tsx', 'utf8');

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
  expect(queue).toContain('Unduh Kartu JPG');
  expect(queue).toContain('makeReservationCardJpg(item)');
  expect(queue).toContain('download={reservationCardFilename(item)}');
  expect(queue).toContain('<ReservationWhatsAppMessage offer={item} cardReady={Boolean(card?.url)} />');
  expect(queue).toContain('lampirkan JPG');
  expect(queue).not.toContain('<textarea aria-label="Pesan rincian reservasi"');
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

test('Kartu Reservasi is downloaded as JPG using official QRIS without auto-sending or paying', () => {
  const card = readFileSync('src/lib/reservation-card.ts', 'utf8');
  expect(card).toContain("'/assets/qris-resmi-baturaden25.png'");
  expect(card).toContain("'/assets/Logo_Resmi_BTRD25_Transparan.png'");
  expect(card).toContain("canvas.toBlob(resolve, 'image/jpeg', .96)");
  expect(card).toContain("reservationCardFields(offer)");
  expect(card).toContain('Alamat');
  expect(card).toContain('WhatsApp');
  expect(card).toContain('DP');
  expect(card).toContain('LUNAS');
  expect(card).toContain('Ini bukan bukti bahwa booking telah dilakukan.');
  expect(card).toContain('Reservasi baru tercatat setelah pembayaran kami terima.');
  expect(card).not.toContain("supabase.rpc(");
  expect(queue).toContain('URL.revokeObjectURL(objectUrl)');
  expect(queue).toContain('Tidak ada pesan atau gambar yang terkirim otomatis.');
});

test('Saving a reservation opens its QRIS card preview, never the old auto-WhatsApp text flow', () => {
  expect(booking).toContain('Simpan Reservasi & Lihat Kartu');
  expect(booking).not.toContain("window.open('about:blank', '_blank')");
  expect(booking).not.toContain('offerWhatsApp(item)');
  expect(dashboard).toContain('setSelectedOffer(offer.id)');
  expect(queue).toContain('makeReservationCardJpg(item)');
  expect(reservationMessage).toContain("'PENAWARAN_RESERVASI'");
});

test('QRIS download and WhatsApp stay disabled until JPG is ready; preview supports retry', () => {
  expect(queue).toContain("card?.url && <Button asChild");
  expect(queue).toContain("const webChatUrl = item ? whatsAppReservationWebUrl(item.phone) : undefined;");
  expect(queue).not.toContain("whatsAppReservationChatUrl(item.phone");
  expect(queue).not.toContain("whatsAppReservationWebUrl(item.phone, RESERVATION_CARD_CAPTION)");
  expect(queue).toContain("card?.url && webChatUrl && <Button asChild");
  expect(queue).toContain('<a href={webChatUrl} target="_blank" rel="noopener noreferrer">');
  expect(queue).toContain("Buka WhatsApp Web");
  expect(queue).toContain("Salin Link Chat");
  expect(queue).toContain("copyWhatsAppValue(webChatUrl, 'Link chat WhatsApp')");
  expect(queue).toContain("{webChatUrl && <p className=");
  expect(queue).toContain("Ctrl+T");
  expect(queue).toContain("Ctrl+V");
  expect(queue).toContain("Salin Nomor");
  expect(queue).toContain("Salin Nomor");
  expect(reservationMessage).toContain("Salin Pesan");
  expect(reservationMessage).toContain("Preview Template WhatsApp Reservasi");
  expect(reservationMessage).toContain("read_active_whatsapp_template");
  expect(reservationMessage).toContain("pendingReservationMessageFingerprint");
  expect(queue).toContain("card?.url && !webChatUrl");
  expect(queue).toContain("disabled={busy || !card?.url}");
  expect(queue).toContain("Coba Buat Ulang Kartu");
  expect(queue).toContain("setCardRetry(value => value + 1)");
  expect(queue).toContain("}, [item?.id, cardRetry])");
  expect(queue).toContain("URL.revokeObjectURL(objectUrl)");
});

test('Staff sees only the ACTIVE official template and copies manually without sending a payment or message', () => {
  const builder = readFileSync('src/lib/reservation-whatsapp-message.ts', 'utf8');
  expect(reservationMessage).toContain("queryFn: readActiveReservationTemplate");
  expect(reservationMessage).toContain("supabase.rpc('read_active_whatsapp_template'");
  expect(reservationMessage).toContain("renderPendingReservationMessage(offer, active.data.body)");
  expect(reservationMessage).toContain("readOffer(offer.id)");
  expect(reservationMessage).toContain("readActiveReservationTemplate()");
  expect(reservationMessage).toContain("await navigator.clipboard.writeText(message)");
  expect(reservationMessage).toContain("disabled={busy || !cardReady}");
  expect(reservationMessage).not.toContain("transition_reservation_offer");
  expect(reservationMessage).not.toContain("window.open(");
  expect(builder).toContain("renderWhatsAppTemplate('PENAWARAN_RESERVASI'");
  expect(builder).not.toContain("supabase.rpc(");
  expect(builder).not.toContain("window.open(");
});
