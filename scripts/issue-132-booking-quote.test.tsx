import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
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
const schedule = {
  scheduled_check_in: '2026-11-28T13:00:00+07:00',
  scheduled_check_out: '2026-11-29T12:00:00+07:00',
  has_conflict: false,
};
const dpSetting = { minimum_dp_mode: 'PERCENTAGE', minimum_dp_value: 40 };
const draft: BookingQuoteDraft = {
  name: 'Rani & Dwi', phone: '081234567890', roomNumber: '07', roomType: 'Superior',
  packageName: 'Paket Harian', checkIn: schedule.scheduled_check_in, guestCount: 2,
  dayMode: 'weekend', roomPrice: 400001, extraCharge: 0, total: 400001,
  minimumDp: minimumDpAmount(400001, dpSetting), dpMode: dpSetting.minimum_dp_mode, dpValue: dpSetting.minimum_dp_value,
};

let response: { data: (typeof schedule)[] | null; error: { code: string; message: string } | null };
let unblock: (() => void) | undefined;
let scheduleGate: Promise<void> | undefined;
const calls: unknown[][] = [];
mock.module('../src/integrations/supabase/client', () => ({
  supabase: {
    async rpc(name: string, args: object) {
      calls.push(['rpc', name, args]);
      await scheduleGate;
      return response;
    },
    from(table: string) { throw new Error('Unexpected direct table access: ' + table); },
  },
}));
const { BookingQuote } = await import('../src/components/booking-quote');
let root: ReturnType<typeof createRoot>;
let container: HTMLElement;

beforeEach(() => {
  calls.length = 0;
  scheduleGate = undefined;
  unblock = undefined;
  response = { data: [schedule], error: null };
  container = document.createElement('form');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  unblock?.();
  await act(async () => root.unmount());
  container.remove();
});

function render(candidate = draft, dayReady = true) {
  return act(async () => {
    root.render(<BookingQuote key={JSON.stringify([candidate, dayReady])} draft={candidate} roomId="room"
      packageId="package" dayReady={dayReady} loading={false} loadError={false} />);
  });
}

function button(label: string) {
  const target = [...document.querySelectorAll('button')].find(item => item.textContent === label);
  if (!target) throw new Error('Missing button ' + label);
  expect(target.type).toBe('button');
  return target;
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
  expect(message).toContain('Minimum DP (40%) : *Rp 160.001*');
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

test('preview is read-only, suppresses duplicate clicks and sends the exact draft to WhatsApp', async () => {
  let officialSubmits = 0;
  container.addEventListener('submit', event => { event.preventDefault(); officialSubmits++; });
  const copied: string[] = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied.push(text); } } });
  await render();
  scheduleGate = new Promise(resolve => { unblock = resolve; });
  await act(async () => { button('Preview Penawaran').click(); button('Preview Penawaran').click(); });
  expect(calls).toHaveLength(1);
  await act(async () => unblock?.());

  const message = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Pesan penawaran"]')!;
  expect(message.readOnly).toBe(true);
  const link = document.querySelector<HTMLAnchorElement>('a[href*="web.whatsapp.com"]')!;
  expect(link.target).toBe('_blank');
  expect(link.rel).toBe('noopener noreferrer');
  expect(new URL(link.href).searchParams.get('text')).toBe(message.value);
  await act(async () => button('Salin Pesan').click());
  expect(copied).toEqual([message.value]);
  expect(officialSubmits).toBe(0);
  expect(calls).toEqual([
    ['rpc', 'check_booking_quote_schedule', { _room_id: 'room', _package_id: 'package', _scheduled_check_in: draft.checkIn }],
  ]);

  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Denied'); } } });
  await act(async () => button('Salin Pesan').click());
  expect(document.body.textContent).toContain('Salin teks yang dipilih');
  expect(document.activeElement).toBe(message);
  await render({ ...draft, name: 'Tamu lain' });
  expect(document.querySelector('a[href*="web.whatsapp.com"]')).toBeNull();
});

test('blocks unknown DP, stale day mode, invalid package schedule and room overlap', async () => {
  await render({ ...draft, minimumDp: null });
  await act(async () => button('Preview Penawaran').click());
  expect(container.textContent).toContain('Pengaturan DP resmi');
  expect(calls).toHaveLength(0);
  await render(draft, false);
  await act(async () => button('Preview Penawaran').click());
  expect(container.textContent).toContain('Jenis hari belum dapat ditentukan');
  expect(calls).toHaveLength(0);
  await render();
  response = { data: null, error: { code: 'P0001', message: 'Check-in di luar jam yang diizinkan untuk paket ini' } };
  await act(async () => button('Preview Penawaran').click());
  expect(container.textContent).toContain('Check-in di luar jam');
  response = { data: [{ ...schedule, has_conflict: true }], error: null };
  await act(async () => button('Preview Penawaran').click());
  expect(container.textContent).toContain('Jadwal kamar bentrok');
  expect(document.querySelector('a[href*="web.whatsapp.com"]')).toBeNull();
});
