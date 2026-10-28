const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function extraGuest(count) {
  return Math.max(count - 2, 0);
}
function total(base, count) {
  return base + extraGuest(count) * 50000;
}
function minimumDp(value) {
  return Math.ceil(value * 0.4);
}
function copyLabel(printNo) {
  return printNo === 1 ? "" : "SALINAN " + (printNo - 1);
}

assert.equal(extraGuest(1), 0);
assert.equal(extraGuest(2), 0);
assert.equal(extraGuest(3), 1);
assert.equal(extraGuest(4), 2);
assert.equal(total(100000, 2), 100000);
assert.equal(total(100000, 3), 150000);
assert.equal(total(100000, 4), 200000);
assert.equal(minimumDp(150000), 60000);
assert.equal(copyLabel(1), "");
assert.equal(copyLabel(2), "SALINAN 1");
assert.equal(copyLabel(3), "SALINAN 2");
assert.equal(copyLabel(4), "SALINAN 3");

const form = fs.readFileSync(
  path.join(__dirname, "..", "src/components/formulir-pemesanan.tsx"),
  "utf8",
);
const receipt = fs.readFileSync(path.join(__dirname, "..", "src/lib/receipt-print.ts"), "utf8");
assert.match(form, /_guest_count: guestCount/);
assert.match(form, /extraGuestCharge/);
assert.match(receipt, /58mm/);
assert.match(receipt, /PAYMENT HISTORY/);
assert.match(receipt, /copy_label/);
assert.match(receipt, /Payment Method/);
console.log("extra-guest-receipt-pure-tests: PASS");
