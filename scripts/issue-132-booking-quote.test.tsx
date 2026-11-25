import { afterEach, beforeEach, expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { act } from 'react';
import { canPreviewBookingQuote, formatBookingQuote, quoteCheckInWib, validateBookingQuote, type BookingQuoteDraft } from '../src/lib/booking-quote';
import { whatsAppDraftUrl } from '../src/lib/whatsapp';

const require = createRequire(import.meta.url);
const { Window } = await import(require.resolve('happy-dom', { paths: [resolve('node_modules/.issue-132-tools')] }));
const browser = new Window({ url: 'https://example.test/booking' });
const globals = ['document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'Element',
  'Node', 'NodeFilter', 'MutationObserver', 'CustomEvent', 'Event', 'MouseEvent', 'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame'] as const;
for (const key of globals) {
  const value = browser[key];
  Object.defineProperty(globalThis, key, { configurable: true, value: typeof value === 'function' && /^[a-z]/.test(key) ? value.bind(browser) : value });
}
Object.assign(globalThis, { window: browser, IS_REACT_ACT_ENVIRONMENT: true });

const { createRoot } = await import('react-dom/client');
const { minimumDpAmount } = await import('../src/lib/combined-payments');
const { BookingQuote } = await import('../src/components/booking-quote');

const schedule = {
  scheduled_check_in: '2026-11-28T13:00:00+07:00',
  scheduled_check_out: '2026-11-29T12:00:00+07:00',
  has_conflict: false,
};
const dpSetting = { minimum_dp_mode: 'PERCENTAGE', minimum_dp_value: 50 };
const draft: BookingQuoteDraft = {
  name: 'Rani & Dwi', phone: '081234567890', roomNumber: '07', roomType: 'Superior',
  packageName: 'Paket Harian', checkIn: schedule.scheduled_check_in, guestCount: 2,
  dayMode: 'weekend', roomPrice: 400001, extraCharge: 0, total: 400001,
  minimumDp: minimumDpAmount(400001, dpSetting), dpMode: dpSetting.minimum_dp_mode, dpValue: dpSetting.minimum_dp_value,
};

let root: ReturnType<typeof createRoot>;
let container: HTMLElement;
beforeEach(() => {
  container = document.createElement('form');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
function render(candidate = draft, dayReady = true, loading = false, loadError = false) {
  return act(async () => {
    root.render(<BookingQuote key={JSON.stringify([candidate, dayReady, loading, loadError])}
      draft={candidate} dayReady={dayReady} loading={loading} loadError={loadError} />);
  });
}

test('roles, date validation and 2-guest Booking parity', () => {
  for (const role of ['owner', 'supervisor', 'receptionist']) {
    expect(canPreviewBookingQuote('booking', role, true)).toBe(true);
    expect(canPreviewBookingQuote('booking', role, false)).toBe(false);
  }
  for (const role of ['housekeeping', 'inspector', 'investor', null]) expect(canPreviewBookingQuote('booking', role, true)).toBe(false);
  expect(canPreviewBookingQuote('check_in', 'owner', true)).toBe(false);
  expect(quoteCheckInWib('2026-02-29', '13:00')).toBeNull();
  expect(quoteCheckInWib('2026-11-28', '24:01')).toBeNull();
  expect(quoteCheckInWib('2026-11-28', '13:00')).toBe(schedule.scheduled_check_in);
  for (const guestCount of [1, 3]) expect(validateBookingQuote({ ...draft, guestCount })).toContain('2 tamu');
  for (const phone of ['++6281234567890', '00000000000', '620812345678', '0812']) {
    expect(validateBookingQuote({ ...draft, phone })).toContain('nomor WhatsApp');
  }
  expect(validateBookingQuote({ ...draft, minimumDp: null })).toContain('Pengaturan DP resmi');
  expect(validateBookingQuote({ ...draft, name: '   ' })).toContain('nama tamu');
  expect(validateBookingQuote({ ...draft, packageName: '' })).toContain('kamar dan paket aktif');
  expect(validateBookingQuote({ ...draft, roomPrice: NaN })).toContain('Harga resmi');
});

test('formats official timestamp values as WIB, with configured percentage or fixed DP', () => {
  const { message, phone } = formatBookingQuote(draft, schedule);
  expect(phone).toBe('6281234567890');
  expect(message).toContain('Sabtu, 28 Nov 2026 • 13.00 WIB');
  expect(message).toContain('Minggu, 29 Nov 2026 • 12.00 WIB');
  expect(message).toContain('Harga Kamar (Weekend) : Rp 400.001');
  expect(message).toContain('Minimum DP (50%) : *Rp 200.001*');
  expect(message).not.toMatch(/TRX|undefined|Sisa Tagihan/i);
  expect(message).toContain('*— RINCIAN PENAWARAN RESERVASI —*');
  expect(message).toContain('*DETAIL RESERVASI*');
  expect(message).toContain('Tipe Kamar : Superior');
  expect(message).toContain('No. Kamar : 07');
  expect(message).toContain('Paket : Harian');
  expect(message).toContain('*RINCIAN PEMBAYARAN*');
  expect(message).toContain('*Total Tagihan : Rp 400.001*');
  expect(message).toContain('*INFORMASI RESERVASI*');
  expect(message).toContain('Ketersediaan kamar dapat berubah sebelum Booking dikonfirmasi.');
  expect(message).not.toMatch(/Konfirmasi Pesanan|&#x|\\\\/);

  const fixed = { minimum_dp_mode: 'AMOUNT', minimum_dp_value: 57500.25 };
  const weekday = { ...draft, dayMode: 'weekday' as const, phone: '+6281234567890', roomPrice: 300000, total: 300000,
    minimumDp: Math.ceil(minimumDpAmount(300000, fixed)!), dpMode: fixed.minimum_dp_mode, dpValue: fixed.minimum_dp_value };
  const result = formatBookingQuote(weekday, schedule);
  expect(result.message).toContain('Harga Kamar (Weekday) : Rp 300.000');
  expect(result.message).toContain('Minimum DP : *Rp 57.501*');
  const url = new URL(whatsAppDraftUrl(result.phone, result.message)!);
  expect(url.searchParams.get('text')).toBe(result.message);
  expect(url.searchParams.get('phone')).toBe(result.phone);
  expect(() => formatBookingQuote(draft, { ...schedule, scheduled_check_out: schedule.scheduled_check_in })).toThrow('Jadwal');
});

test('Booking only shows official price summary, never a second offer or WhatsApp action', async () => {
  let submits = 0;
  container.addEventListener('submit', event => { event.preventDefault(); submits++; });
  await render();
  expect(container.querySelector('section[aria-label="Ringkasan Harga Booking"]')).not.toBeNull();
  const text = container.textContent ?? '';
  expect(text).toContain('Ringkasan Harga Booking');
  expect(text).toContain('Harga kamar (Weekend)');
  expect(text).toContain('400.001');
  expect(text).toContain('Minimum DP (50%)');
  expect(text).toContain('200.001');
  expect(container.querySelector('button')).toBeNull();
  expect(container.querySelector('textarea')).toBeNull();
  expect(container.querySelector('a[href*="whatsapp"]')).toBeNull();
  expect(text).not.toContain('Preview Penawaran');
  expect(submits).toBe(0);
});

test('Booking price summary preserves missing-DP, incomplete pricing and loading states', async () => {
  await render({ ...draft, minimumDp: null });
  expect(container.textContent).toContain('Pengaturan DP resmi belum dapat dibaca');
  await render(draft, false);
  expect(container.textContent).toContain('Pilih tanggal, kamar, dan paket dengan harga resmi');
  await render(draft, true, true);
  expect(container.textContent).toContain('Memuat data harga resmi');
  await render(draft, true, false, true);
  expect(container.textContent).toContain('Data harga resmi gagal dimuat');
  expect(container.querySelector('button')).toBeNull();
});
