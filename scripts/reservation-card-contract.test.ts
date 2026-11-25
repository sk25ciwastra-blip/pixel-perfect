import { test, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { reservationCardFields, reservationCardFilename, RESERVATION_CARD_CAPTION } from '../src/lib/reservation-card';
import { whatsAppReservationChatUrl, whatsAppReservationRecipient, whatsAppReservationWebUrl } from '../src/lib/whatsapp';
import type { OfferDetail } from '../src/lib/reservation-offers';
import { renderPendingReservationMessage, pendingReservationMessageFingerprint } from '../src/lib/reservation-whatsapp-message';
import { OWNER_APPROVED_QUOTE_TEMPLATE } from '../src/lib/whatsapp-template-approved';

const pending = {
  id: 'bcc96661-b33a-45ab-8d99-35368e6e8c0e',
  guest_name: 'Saipul', address: 'Jl. Ciwastra, Bandung', phone: '081234567890',
  phone_last4: '7890', room_id: 'room-uuid', package_id: 'package-uuid',
  room_number: '05', room_type: 'Deluxe', package_name: 'Paket 2 Jam',
  scheduled_check_in: '2026-11-27T10:10:00+07:00',
  scheduled_check_out: '2026-11-27T12:10:00+07:00',
  day_mode: 'weekend', guest_count: 2, total: 90_000, minimum_dp: 45_000,
  minimum_dp_mode: 'PERCENTAGE', minimum_dp_value: 50,
  status: 'DRAFT', created_at: '2026-11-26T00:00:00+07:00',
  sent_marked_at: null, transaction_number: null, reason: null,
} satisfies OfferDetail;

test('Card uses stored reservation snapshot, 50 percent DP and WIB times', () => {
  const card = reservationCardFields(pending);
  expect(card.name).toBe('Saipul');
  expect(card.address).toBe('Jl. Ciwastra, Bandung');
  expect(card.phone).toBe('081234567890');
  expect(card.roomNumber).toBe('05');
  expect(card.roomPrice).toBe(90_000);
  expect(card.extraCharge).toBe(0);
  expect(card.total).toBe(90_000);
  expect(card.minimumDp).toBe(45_000);
  expect(card.dpLabel).toContain('50%');
  expect(card.checkIn).toContain('10.10');
  expect(card.checkOut).toContain('12.10');
  expect(card.checkIn).toContain('WIB');
  expect(card.checkInDate).toContain('27 Nov 2026');
  expect(card.checkInTime).toBe('10.10 WIB');
  expect(card.checkOutDate).toContain('27 Nov 2026');
  expect(card.checkOutTime).toBe('12.10 WIB');
  expect(reservationCardFilename(pending)).toBe('RESERVASI-Saipul-bcc96661.jpg');
  expect(RESERVATION_CARD_CAPTION).toContain('Halo Kak');
});

test('Card separately shows room rate and extra-guest fee; does not invent payment', () => {
  const card = reservationCardFields({ ...pending, guest_count: 3, total: 140_000, minimum_dp: 70_000 });
  expect(card.roomPrice).toBe(90_000);
  expect(card.extraCharge).toBe(50_000);
  expect(card.total).toBe(140_000);
  expect(card.minimumDp).toBe(70_000);
});

test('Card rejects contradictory snapshots and schedules', () => {
  expect(() => reservationCardFields({ ...pending, minimum_dp: 95_000 })).toThrow();
  expect(() => reservationCardFields({ ...pending, scheduled_check_out: pending.scheduled_check_in })).toThrow();
  expect(() => reservationCardFields({ ...pending, address: '' })).toThrow();
});

test('Embedded QRIS asset matches the Owner-supplied independently decoded source', () => {
  const qr = readFileSync('public/assets/qris-resmi-baturaden25.png');
  expect(qr.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(qr.length).toBe(1590);
  expect(createHash('sha256').update(qr).digest('hex'))
    .toBe('be77190994647e9408859ecf62a9a0f5a6e5f1ac39be0c28e1ddf9e903b8f42a');
});

test('Approved staff illustrations load from the official QRIS artwork', () => {
  for (const name of ['staff-reservasi-pria.webp', 'staff-reservasi-wanita.webp']) {
    const photo = readFileSync('public/assets/' + name);
    expect(photo.subarray(0, 4).toString()).toBe('RIFF');
    expect(photo.subarray(8, 12).toString()).toBe('WEBP');
  }
});


test('approved navy/gold visual anatomy keeps an unpaid warning, never a paid checkmark', () => {
  const source = readFileSync('src/lib/reservation-card.ts', 'utf8');
  expect(source).toContain("text(ctx, 'QRIS'");
  expect(source).toContain("text(ctx, 'Pembayaran Reservasi'");
  expect(source).toContain("panelTitle(ctx, 'PILIHAN PEMBAYARAN'");
  expect(source).toContain("text(ctx, 'atau'");
  expect(source).toContain('Shield is decorative; never render a paid/confirmed tick');
  expect(source).toContain('Ini bukan bukti bahwa booking telah dilakukan.');
  expect(source).toContain('Reservasi baru tercatat setelah pembayaran kami terima.');
  expect(source).toContain("ctx.imageSmoothingEnabled = false");
  expect(source).not.toContain("text(ctx, '✓'");
});

test('Reservation WhatsApp opens the intended Indonesian recipient with a short unsent caption', () => {
  for (const phone of ['081234567890', '+6281234567890', '6281234567890', '81234567890', '08 1234-567890']) {
    const href = whatsAppReservationChatUrl(phone, RESERVATION_CARD_CAPTION);
    expect(href).toBeDefined();
    const link = new URL(href!);
    expect(link.origin).toBe('https://wa.me');
    expect(link.pathname).toBe('/6281234567890');
    expect(link.searchParams.get('text')).toBe(RESERVATION_CARD_CAPTION);
  }
  expect(whatsAppReservationChatUrl('081234567890')).toBe('https://wa.me/6281234567890');
  for (const phone of ['0812', '', '0000000000', '62081234567890', '++6281234567890', '081234abc567']) {
    expect(whatsAppReservationChatUrl(phone, 'halo')).toBeUndefined();
  }
});

test('Desktop WhatsApp Web recipient-only link matches Owner-proven URL without extra parameters', () => {
  for (const phone of ['081234567890', '+6281234567890', '6281234567890', '81234567890', '08 1234-567890']) {
    const href = whatsAppReservationWebUrl(phone);
    expect(href).toBeDefined();
    const link = new URL(href!);
    expect(link.origin).toBe('https://web.whatsapp.com');
    expect(link.pathname).toBe('/send');
    expect(link.searchParams.get('phone')).toBe('6281234567890');
    expect(link.search).toBe('?phone=6281234567890');
    expect(link.searchParams.get('text')).toBeNull();
    expect(whatsAppReservationRecipient(phone)).toBe('6281234567890');
  }
  for (const phone of ['', '0812', '62081234567890', '++6281234567890', '081234abc567']) {
    expect(whatsAppReservationWebUrl(phone, 'halo')).toBeUndefined();
    expect(whatsAppReservationRecipient(phone)).toBeUndefined();
  }
  expect(whatsAppReservationWebUrl('081234567890')).toBe('https://web.whatsapp.com/send?phone=6281234567890');
});

test('official reservation template uses saved price, guest count and 50 percent DP without creating TRX', () => {
  const message = renderPendingReservationMessage(pending, OWNER_APPROVED_QUOTE_TEMPLATE);
  expect(message).toContain('Halo Kak Saipul');
  expect(message).toContain('Rp 90.000');
  expect(message).toContain('Rp 45.000');
  expect(message).toContain('05');
  expect(message).toContain('WIB');
  expect(message).not.toContain('TRX');
  const extra = renderPendingReservationMessage(
    { ...pending, guest_count: 3, total: 140000, minimum_dp: 70000 },
    OWNER_APPROVED_QUOTE_TEMPLATE,
  );
  expect(extra).toContain('Rp 50.000');
  expect(extra).toContain('Rp 140.000');
  expect(extra).toContain('3 Orang');
  expect(() => renderPendingReservationMessage(
    { ...pending, status: 'CONVERTED' }, OWNER_APPROVED_QUOTE_TEMPLATE,
  )).toThrow('tidak lagi menunggu pembayaran');
  expect(() => renderPendingReservationMessage(pending, 'Halo [NOMOR_TRANSAKSI]')).toThrow();
  expect(pendingReservationMessageFingerprint(pending)).not.toBe(
    pendingReservationMessageFingerprint({ ...pending, total: 140000 }),
  );
});
