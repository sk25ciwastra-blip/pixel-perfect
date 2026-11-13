// Focused view contract only; never connects to Cloud or reruns previous backend suites.
const assert = require("node:assert/strict");
const { roomOvertimeIndicator } = require("../src/lib/room-overtime.ts");
const deadline = "2026-11-13T15:00:00+07:00";
const threshold = Date.parse(deadline) + 120 * 60_000;
for (const [offset, expected] of [[-1,false],[0,false],[1,true]]) {
  const state = roomOvertimeIndicator({ status: "check_in", ends_at: deadline }, threshold + offset);
  assert.equal(state.needsAction, expected);
  assert.equal(state.excludeFromRoomStatus, expected);
  assert.equal(state.cardIndicator, expected ? "red" : null);
  assert.equal(state.area, expected ? "PERLU TINDAKAN" : null);
}
for (const status of ["booking","check_out","cancelled"]) {
  assert.equal(roomOvertimeIndicator({ status, ends_at: deadline }, threshold + 1).needsAction, false);
}
assert.equal(roomOvertimeIndicator({ status: "check_in", ends_at: null }, threshold + 1).deadlineKnown, false);
assert.equal(roomOvertimeIndicator({ status: "check_in", ends_at: "invalid" }, threshold + 1).needsAction, false);
assert.equal(roomOvertimeIndicator({ status: "check_in", ends_at: deadline }, NaN).needsAction, false);
assert.equal(roomOvertimeIndicator({ status: "check_in", ends_at: "2026-12-31T23:00:00+07:00" }, Date.parse("2027-01-01T01:00:00.001+07:00")).needsAction, true);
console.log("PASS overtime presentation: 120/-1/0/+1ms, booking unchanged, checkout, missing deadlines and WIB rollover");
