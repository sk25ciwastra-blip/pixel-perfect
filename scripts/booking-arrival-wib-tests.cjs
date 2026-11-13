const assert = require("node:assert/strict");
const { isBookingArrivalDay } = require("../src/lib/booking-arrival-wib.ts");
const booking = (scheduled_check_in, status = "booking") => ({ status, scheduled_check_in });
const cases = [
  ["2026-11-13T22:00:00+07:00","2026-11-13T23:59:59+07:00",true,"Malam arrival"],
  ["2026-11-13T22:00:00+07:00","2026-11-14T00:00:00+07:00",false,"Malam checkout day"],
  ["2026-11-13T13:00:00+07:00","2026-11-14T11:59:00+07:00",false,"Harian checkout day"],
  ["2026-11-13T08:30:00+07:00","2026-11-13T00:00:00+07:00",true,"Pagi before arrival"],
  ["2026-11-13T22:00:00+07:00","2026-11-12T23:59:59+07:00",false,"Malam previous date"],
  ["2026-11-13T00:00:00+07:00","2026-11-13T23:59:59+07:00",true,"midnight arrival"],
  ["2026-12-31T23:30:00+07:00","2027-01-01T00:00:00+07:00",false,"New year boundary"],
  ["2026-11-13T22:00:00+07:00","2026-11-13T16:00:00Z",true,"UTC timestamp same WIB date"],
];
for (const [arrival,now,expected,label] of cases) {
  assert.equal(isBookingArrivalDay(booking(arrival), Date.parse(now)),expected,label);
}
assert.equal(isBookingArrivalDay(booking(null),Date.now()),false);
assert.equal(isBookingArrivalDay(booking("invalid"),Date.now()),false);
assert.equal(isBookingArrivalDay(booking("2026-11-13T08:30:00+07:00","check_in"),Date.parse("2026-11-13T12:00:00+07:00")),false);
assert.equal(isBookingArrivalDay(booking("2026-11-13T08:30:00+07:00"),NaN),false);
console.log("PASS Booking arrival-only WIB: Pagi/Malam/Harian, midnight/year rollover, invalid/inactive, UTC");
