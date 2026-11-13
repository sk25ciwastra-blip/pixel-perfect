const assert = require("node:assert/strict");
const { hasOvertimeOccupant, showEmptyRoomState } = require("../src/lib/room-overtime-view.ts");
const end = "2026-11-13T15:00:00+07:00";
const threshold = Date.parse(end) + 120 * 60_000;
const stays = [
  { id: "A", room_id: "01", status: "check_in", ends_at: end },
  { id: "B", room_id: "02", status: "booking", ends_at: end },
];
assert.equal(hasOvertimeOccupant(stays, "01", threshold), false);
assert.equal(hasOvertimeOccupant(stays, "01", threshold + 1), true);
assert.equal(hasOvertimeOccupant(stays, "02", threshold + 1), false);
assert.equal(hasOvertimeOccupant(stays, "03", threshold + 1), false);
assert.equal(hasOvertimeOccupant([{ ...stays[0], status: "check_out" }], "01", threshold + 1), false);
assert.equal(showEmptyRoomState(false, "", 0, 0), true);
assert.equal(showEmptyRoomState(false, "", 0, 1), false);
assert.equal(showEmptyRoomState(false, "", 1, 0), false);
assert.equal(showEmptyRoomState(true, "", 0, 0), false);
assert.equal(showEmptyRoomState(false, "RLS denied", 0, 0), false);
console.log("PASS overtime vs Booking coexistence, strict 120ms boundary, no contradictory empty-state, fail-closed loading/error");
