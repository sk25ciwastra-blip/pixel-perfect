import { describe, expect, it } from 'bun:test';
import { isBookingRescheduleWindowClosed, isNewBookingCheckInTooNear } from '../src/lib/booking-reschedule-window';

const original = '2026-11-25T13:00:00+07:00';
const originalMs = Date.parse(original);
const deadline = originalMs - 2 * 60 * 60 * 1000;

describe('Booking Owner two-hour reschedule boundary (pure, no Cloud)', () => {
  it('allows exactly two hours before original check-in', () => {
    expect(isBookingRescheduleWindowClosed(original, deadline)).toBe(false);
    expect(isBookingRescheduleWindowClosed(original, deadline - 1)).toBe(false);
  });
  it('rejects even one millisecond past the original cutoff', () => {
    expect(isBookingRescheduleWindowClosed(original, deadline + 1)).toBe(true);
    expect(isBookingRescheduleWindowClosed(original, originalMs)).toBe(true);
  });
  it('fails closed on missing, malformed, or impossible schedule timestamps', () => {
    expect(isBookingRescheduleWindowClosed(null, deadline)).toBe(true);
    expect(isBookingRescheduleWindowClosed('NOT_A_DATE', deadline)).toBe(true);
    expect(isBookingRescheduleWindowClosed(original, Number.NaN)).toBe(true);
  });
  it('requires new check-in at least two hours ahead and preserves equality', () => {
    expect(isNewBookingCheckInTooNear(deadline + 2 * 60 * 60 * 1000, deadline)).toBe(false);
    expect(isNewBookingCheckInTooNear(deadline + 2 * 60 * 60 * 1000 - 1, deadline)).toBe(true);
    expect(isNewBookingCheckInTooNear(Number.NaN, deadline)).toBe(true);
  });
  it('treats explicit WIB offsets as absolute timestamps across midnight', () => {
    const midnight = '2026-11-26T00:30:00+07:00';
    const boundary = Date.parse(midnight) - 2 * 60 * 60 * 1000;
    expect(isBookingRescheduleWindowClosed(midnight, boundary)).toBe(false);
    expect(isBookingRescheduleWindowClosed(midnight, boundary + 1)).toBe(true);
  });
});
