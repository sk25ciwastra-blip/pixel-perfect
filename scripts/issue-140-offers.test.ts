import { expect, test } from 'bun:test';
import { findSameGuest, suggestGuests } from '../src/lib/guest-search';
import { offerWhatsApp, offerWibFields, type OfferDetail } from '../src/lib/reservation-offers';
import { kunjunganTamu } from '../src/lib/tamu-tampilan';

const guest = { id: 'guest', full_name: 'Rani Setia', phone: '081234567890', address: 'Alamat tersimpan' };
const other = { id: 'other', full_name: 'Made Wijaya', phone: '+628222222222', address: 'Alamat lain' };

test('shared search matches partial names and both Indonesian phone formats', () => {
  expect(suggestGuests([guest, other], 'name', 'ANI SE', '').map(row => row.id)).toEqual(['guest']);
  for (const phone of ['08123', '628123', '+628123', '1234']) {
    expect(suggestGuests([guest, other], 'phone', '', phone).map(row => row.id)).toEqual(['guest']);
  }
  for (const phone of ['081234567890', '6281234567890', '+6281234567890']) {
    expect(findSameGuest([guest, other], phone)?.address).toBe(guest.address);
  }
  expect(suggestGuests([guest], 'name', 'x', '')).toEqual([]);
  expect(suggestGuests([guest], null, '', '')).toEqual([]);
  expect(findSameGuest([guest], '081234567899')).toBeUndefined();
});

test('persisted offer generates a draft without claiming sent, payment or official TRX', () => {
  const offer: OfferDetail = {
    id: 'quote', guest_name: guest.full_name, phone: guest.phone, address: guest.address, phone_last4: '7890',
    room_id: 'room', package_id: 'package', room_number: '07', room_type: 'Superior', package_name: 'Paket Harian',
    scheduled_check_in: '2099-11-28T06:00:00Z', scheduled_check_out: '2099-11-29T05:00:00Z',
    day_mode: 'weekend', guest_count: 2, total: 100001, minimum_dp: 50001, minimum_dp_mode: 'PERCENTAGE',
    minimum_dp_value: 50, status: 'DRAFT', created_at: '2099-11-18T06:00:00Z',
    sent_marked_at: null, transaction_number: null, reason: null,
  };
  const { message, url } = offerWhatsApp(offer);
  expect(new URL(url!).searchParams.get('text')).toBe(message);
  expect(new URL(url!).searchParams.get('phone')).toBe('6281234567890');
  expect(message).toContain('50.001');
  expect(message).not.toContain('BTRDTRX');
  expect(offerWibFields(offer.scheduled_check_in)).toEqual({ date: '2099-11-28', time: '13:00' });
  expect(offer.status).toBe('DRAFT');
  expect(offer.sent_marked_at).toBeNull();
});

test('guest history remains zero visits through quote and official Booking', () => {
  expect(kunjunganTamu([], guest.id)).toHaveLength(0);
  expect(kunjunganTamu([{ guest_id: guest.id, status: 'booking' }], guest.id)).toHaveLength(0);
  expect(kunjunganTamu([{ guest_id: guest.id, status: 'check_in' }], guest.id)).toHaveLength(1);
});
