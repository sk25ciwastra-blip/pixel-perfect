// Baturaden 25 Homestay — offline turnover threshold tests.
// Run using Node 22+ --experimental-strip-types; no Cloud or browser APIs.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  KUNCI_TARGET_LEGACY, KUNCI_TARGET_TAHAPAN,
  bacaTargetOmzet, validasiTargetOmzet, zonaTargetOmzet, progresOmzetBonus,
} from "../src/lib/target-omzet.ts";

let passed = 0;
function test(label, action) {
  action();
  passed++;
  console.log("PASS:", label);
}
const store = (map) => ({ getItem: (key) => Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null });

test("Example: before Rp40M is red", () => {
  assert.equal(zonaTargetOmzet(188000, 40000000, 70000000), "merah");
  assert.equal(zonaTargetOmzet(39999999, 40000000, 70000000), "merah");
});
test("Exactly Rp40M through just below Rp70M is green", () => {
  assert.equal(zonaTargetOmzet(40000000, 40000000, 70000000), "hijau");
  assert.equal(zonaTargetOmzet(69999999, 40000000, 70000000), "hijau");
});
test("Exactly Rp70M and greater is blue", () => {
  assert.equal(zonaTargetOmzet(70000000, 40000000, 70000000), "biru");
  assert.equal(zonaTargetOmzet(100000000, 40000000, 70000000), "biru");
});
test("Unconfigured thresholds never claim red green or blue", () => {
  assert.equal(zonaTargetOmzet(188000, 0, 0), "belum_diatur");
  assert.equal(zonaTargetOmzet(80000000, 0, 70000000), "belum_diatur");
  assert.equal(zonaTargetOmzet(NaN, 40000000, 70000000), "merah");
});
test("Bonus progress caps at 100% and respects zero", () => {
  assert.equal(progresOmzetBonus(0, 40000000, 70000000), 0);
  assert.equal(progresOmzetBonus(40000000, 40000000, 70000000),
    40000000 / 70000000 * 100);
  assert.equal(progresOmzetBonus(90000000, 40000000, 70000000), 100);
  assert.equal(progresOmzetBonus(-1000, 40000000, 70000000), 0);
  assert.equal(progresOmzetBonus(188000, 0, 0), 0);
});
test("Standard must be positive integer and bonus strictly higher", () => {
  assert.equal(validasiTargetOmzet(40000000, 70000000), null);
  for (const pair of [[0,70000000], [40000000,40000000], [70000000,40000000],
    [1.2,70000000], [NaN,70000000], [40000000,Infinity]]) {
    assert.equal(typeof validasiTargetOmzet(...pair), "string");
  }
});
test("Existing legacy target is read-only and not an approved two-tier setting", () => {
  const old = bacaTargetOmzet(store({ [KUNCI_TARGET_LEGACY]: "70000000" }));
  assert.deepEqual(old, { standard: 0, bonus: 70000000, legacy: true });
  assert.equal(zonaTargetOmzet(80000000, old.standard, old.bonus), "belum_diatur");
});
test("Full two-tier setting supersedes legacy without erasing it", () => {
  const now = bacaTargetOmzet(store({
    [KUNCI_TARGET_LEGACY]: "55000000",
    [KUNCI_TARGET_TAHAPAN]: JSON.stringify({ standard: 40000000, bonus: 70000000 }),
  }));
  assert.deepEqual(now, { standard: 40000000, bonus: 70000000, legacy: false });
});
test("Invalid new config doesn't fall back to stale target and pretend it was approved", () => {
  assert.deepEqual(bacaTargetOmzet(store({
    [KUNCI_TARGET_LEGACY]: "60000000",
    [KUNCI_TARGET_TAHAPAN]: JSON.stringify({ standard: 90000000, bonus: 70000000 }),
  })), { standard: 0, bonus: 0, legacy: false });
});
test("Blocked browser storage is treated as unconfigured safely", () => {
  const result = bacaTargetOmzet({ getItem: () => { throw Error("blocked"); } });
  assert.deepEqual(result, { standard: 0, bonus: 0, legacy: false });
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "src/routes/index.tsx"), "utf8");
test("Only Owner renders the target card", () => {
  assert.ok(source.includes('{peran === "owner" && ('));
  assert.ok(source.includes("<TargetOmzet"));
});
test("Target form is a Dialog, not an inline full-width form", () => {
  const component = source.split("function TargetOmzet(")[1]?.split("function FormulirPengeluaran(")[0];
  assert.ok(component);
  assert.ok(component.includes('<Dialog open={ubah} onOpenChange={setUbah}>'));
  assert.ok(component.includes('max-h-[90dvh]'));
  assert.ok(component.includes('overflow-y-auto'));
  assert.ok(component.includes('DialogTitle className="font-serif text-xl text-gold-light">Atur Target Omzet Bulanan'));
  assert.ok(component.includes("01 · Realisasi"));
  assert.ok(component.includes("02 · Standard Operasional"));
  assert.ok(component.includes("03 · Target Bonus"));
  assert.ok(component.includes('type="number" min="1" step="1" required'));
  assert.ok(component.includes('role="alert"'));
  assert.ok(component.includes("validasiTargetOmzet(nilaiStandard, nilaiBonus)"));
  assert.ok(!component.includes("window.localStorage"));
});
test("Realisasi is displayed only and not editable; payout isn't automatic", () => {
  const component = source.split("function TargetOmzet(")[1]?.split("function FormulirPengeluaran(")[0];
  assert.ok(component.includes("<output"));
  assert.ok(component.includes("Tidak dapat diubah di sini."));
  assert.ok(component.includes("bukan pembayaran bonus otomatis"));
});
test("Only approved owner action writes new browser key; no SQL or Cloud calls", () => {
  assert.ok(source.includes("window.localStorage.setItem(KUNCI_TARGET_TAHAPAN, JSON.stringify(nilai))"));
  assert.ok(source.includes("setTargetLegacy(false);"));
  assert.ok(source.includes("return false;"));
  const component = source.split("function TargetOmzet(")[1]?.split("function FormulirPengeluaran(")[0];
  assert.ok(!component.includes("rpc("));
  assert.ok(!component.includes("supabase."));
});
console.log(passed + " three-tier omzet tests PASS");
