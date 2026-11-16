import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(new URL('../src/routes/index.tsx', import.meta.url), 'utf8');
const helper = readFileSync(new URL('../src/lib/room-overtime.ts', import.meta.url), 'utf8');
const roomRoute = readFileSync(new URL('../src/routes/kamar.tsx', import.meta.url), 'utf8');
const ms120 = 120 * 60_000;
function classification(stay, nowMs) {
  const deadline = stay.ends_at === null ? NaN : Date.parse(stay.ends_at);
  const needsAction = stay.status === 'check_in' &&
    Number.isFinite(nowMs) && Number.isFinite(deadline) &&
    nowMs - deadline > ms120;
  return {needsAction, excludeFromRoomStatus: needsAction};
}
const active = (ends_at) => ({status:'check_in',ends_at});
const at = (time) => Date.parse(time);

test('Dashboard imports existing backend-aligned helper; does not redefine threshold', () => {
  assert.match(route, /import \{ roomOvertimeIndicator \} from "@\/lib\/room-overtime"/);
  assert.match(route, /roomOvertimeIndicator\(transaksi, sekarang\)\.needsAction/);
  assert.match(route, /!roomOvertimeIndicator\(item\.transaksi, sekarang\)\.excludeFromRoomStatus/);
  assert.match(helper, /nowMs - deadline > 120 \* 60_000/);
});
test('exactly 120 minutes does NOT leave occupied Status Kamar', () => {
  assert.equal(classification(active('2026-11-16T22:00:00+07:00'), at('2026-11-17T00:00:00+07:00')).needsAction, false);
});
test('120 minutes and 1 ms moves to PERLU TINDAKAN', () => {
  assert.equal(classification(active('2026-11-16T22:00:00+07:00'), at('2026-11-17T00:00:00.001+07:00')).needsAction,true);
});
test('invalid deadline and Booking never trigger an invented overtime case', () => {
  assert.equal(classification(active('invalid'),at('2026-11-17T10:00:00+07:00')).needsAction,false);
  assert.equal(classification({status:'booking',ends_at:'2026-11-16T00:00:00+07:00'},at('2026-11-17T10:00:00+07:00')).needsAction,false);
});
test('case panel preserves existing Check-out guard and transaction detail', () => {
  assert.match(route, /overtimePerluTindakan\.map\(/);
  assert.match(route, /const alasan = checkoutDisabledReason\(item, room\)/);
  assert.match(route, /onClick=\{\(\) => void checkOut\(item\.id\)\}/);
  assert.match(route, /onClick=\{\(\) => setDetailTransactionId\(item\.id\)\}/);
  assert.match(route, /disabled=\{Boolean\(alasan\) \|\| checkingOutId !== null\}/);
});
test('KPI overtime counts action queue, not all expired timers', () => {
  assert.match(route, /overtime: overtimePerluTindakan\.length/);
  assert.match(route, /terisi: kamarTerisi\.length/);
  assert.doesNotMatch(route, /overtime: statusKamarBaris\.filter\(/);
});
test('no new database status/RPC/override or replacement of Booking UI', () => {
  assert.match(route, /const bookings = bookingHariIni/);
  assert.match(route, /if \(!terisi && bookings\.length === 0\) return \[\]/);
  assert.doesNotMatch(route, /override_room_ready|release_overtime_guard/);
});

test('ROOM card derives red PERLU TINDAKAN from the same helper and preserves transaction link', () => {
  assert.match(roomRoute, /import \{ roomOvertimeIndicator \} from "@\/lib\/room-overtime"/);
  assert.match(roomRoute, /const overtime = transaction \? roomOvertimeIndicator\(transaction, waktuSekarang\)\.needsAction : false/);
  assert.match(roomRoute, /PERLU TINDAKAN · Overtime lebih dari 120 menit/);
  assert.match(roomRoute, /setDetailTransactionId\(transaction\.id\)/);
  assert.match(roomRoute, /room\.status/);
});
test('ROOM indicator refreshes its local clock without modifying live data', () => {
  assert.match(roomRoute, /window\.setInterval\(\(\) => setWaktuSekarang\(Date\.now\(\)\), 30_000\)/);
  assert.match(roomRoute, /window\.clearInterval\(tick\)/);
  assert.doesNotMatch(roomRoute, /release_overtime_guard|override_overtime/);
});
