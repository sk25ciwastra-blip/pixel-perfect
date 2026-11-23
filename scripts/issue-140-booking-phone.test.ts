import { expect, test } from 'bun:test';
import { bookingPhoneInput, canonicalIndonesianWhatsApp } from '../src/lib/guest-search';

test('Booking preserves valid 08/62/+62 request inputs, while offer keys are canonical', () => {
  for (const phone of ['081234567890', '6281234567890', '+6281234567890']) {
    expect(bookingPhoneInput(phone)).toBe(phone);
    expect(canonicalIndonesianWhatsApp(phone)).toBe('6281234567890');
  }
  expect(bookingPhoneInput('+1 212 555 1234')).toBe('+1 212 555 1234');
});

test('legacy display separators convert without mutating the stored identity', () => {
  expect(bookingPhoneInput('+62 812-3456-7890')).toBe('6281234567890');
  expect(canonicalIndonesianWhatsApp('(0812) 3456-7890')).toBe('6281234567890');
  expect(canonicalIndonesianWhatsApp('abc081234567890')).toBeNull();
  expect(canonicalIndonesianWhatsApp('62')).toBeNull();
});
