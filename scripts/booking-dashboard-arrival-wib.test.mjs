import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/routes/index.tsx', import.meta.url), 'utf8');
const block = source.match(/  const bookingHariIni = useMemo\(\(\) => \{([\s\S]*?)\n  \}, \[bookingAktif, sekarang\]\);/);
assert.ok(block, 'Dashboard booking filter should be present');
assert.match(block[1], /tanggalWib\(mulai\) === hariKedatanganWib/);
assert.doesNotMatch(block[1], /mulai < akhirHari|akhir > awalHari/);

// Representative filter using identical predicate and the existing WIB date formatter.
function tanggalWib(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}
function todayBookings(bookings, now) {
  const hariKedatanganWib = tanggalWib(now);
  return bookings.filter((item) => {
    const mulai = item.scheduled_check_in ? new Date(item.scheduled_check_in).getTime() : NaN;
    const akhir = item.scheduled_check_out ? new Date(item.scheduled_check_out).getTime() : NaN;
    return Number.isFinite(mulai) && Number.isFinite(akhir) && akhir > mulai && tanggalWib(mulai) === hariKedatanganWib;
  });
}
const booking = (id, checkIn, checkOut) => ({
  id, scheduled_check_in: checkIn, scheduled_check_out: checkOut,
});
test('Pagi: appears on arrival day WIB but not prior day', () => {
  const b = booking('pagi','2026-11-17T08:30:00+07:00','2026-11-17T16:00:00+07:00');
  assert.deepEqual(todayBookings([b],'2026-11-17T00:01:00+07:00').map(x=>x.id), ['pagi']);
  assert.deepEqual(todayBookings([b],'2026-11-16T23:59:00+07:00'), []);
});
test('Malam: appears on arrival day even when checkout crosses midnight', () => {
  const b = booking('malam','2026-11-17T22:00:00+07:00','2026-11-18T08:00:00+07:00');
  assert.deepEqual(todayBookings([b],'2026-11-17T23:59:00+07:00').map(x=>x.id), ['malam']);
  assert.deepEqual(todayBookings([b],'2026-11-18T00:01:00+07:00'), []);
});
test('Harian: only day of scheduled check-in, not checkout date', () => {
  const b = booking('harian','2026-11-17T13:00:00+07:00','2026-11-18T12:00:00+07:00');
  assert.equal(todayBookings([b],'2026-11-17T01:00:00+07:00').length,1);
  assert.equal(todayBookings([b],'2026-11-18T01:00:00+07:00').length,0);
});
test('timezone offset near midnight is normalized to Asia/Jakarta', () => {
  const b = booking('offset','2026-11-16T17:30:00Z','2026-11-17T05:00:00Z');
  assert.deepEqual(todayBookings([b],'2026-11-17T10:00:00+07:00').map(x=>x.id),['offset']);
});
test('invalid or absent checkout time does not generate phantom booking', () => {
  const bs=[booking('missing','2026-11-17T22:00:00+07:00',null),booking('backward','2026-11-17T22:00:00+07:00','2026-11-17T21:00:00+07:00'),booking('bad','garbage','garbage')];
  assert.deepEqual(todayBookings(bs,'2026-11-17T12:00:00+07:00'),[]);
});
test('two valid bookings for same room are not duplicated by date selection', () => {
  const bs=[booking('A','2026-11-17T22:00:00+07:00','2026-11-18T08:00:00+07:00'),booking('B','2026-11-18T22:00:00+07:00','2026-11-19T08:00:00+07:00')];
  assert.deepEqual(todayBookings(bs,'2026-11-17T20:00:00+07:00').map(x=>x.id),['A']);
  assert.deepEqual(todayBookings(bs,'2026-11-18T20:00:00+07:00').map(x=>x.id),['B']);
});
