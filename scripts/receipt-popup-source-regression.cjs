const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(path.join(root, "src/lib/receipt-print.ts"), "utf8");
const actions = fs.readFileSync(path.join(root, "src/components/receipt-actions.tsx"), "utf8");

assert.match(renderer, /function paymentRow\(payment: JsonRecord, showMethod = true\)/);
assert.match(renderer, /history\.map\(\(payment: JsonRecord\) => paymentRow\(payment, false\)\)/);
assert.match(renderer, /export function openReceiptPrintWindow\(\)/);
assert.match(renderer, /if \(!popup\) throw new Error\("Print preview was blocked by the browser"\)/);
assert.match(actions, /popup = openReceiptPrintWindow\(\)/);
assert.ok(actions.indexOf("popup = openReceiptPrintWindow()") < actions.indexOf("const receipt = await prepareReceiptPrint(paymentId)"));
assert.ok(actions.lastIndexOf("popup = openReceiptPrintWindow()") < actions.indexOf("for (const paymentId of paymentIds)"));
assert.ok(actions.indexOf("openReceiptPrintPreview([receipt], popup)") < actions.indexOf('const result = await rpc("record_receipt_print_result"'));
assert.ok(actions.indexOf("openReceiptPrintPreview(receipts, popup)") < actions.indexOf("const printResults = await Promise.all("));
assert.doesNotMatch(actions, /openReceiptPrintPreview\(\[receipt\]\);/);
console.log("receipt-popup-source-regression: PASS (source assertions only)");
