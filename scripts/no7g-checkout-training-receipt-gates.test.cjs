// Baturaden 25 Homestay — No7G targeted release-gate source contracts.
// Read-only; no checkout/refund/payment, new users, or Cloud data changes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = p => fs.readFileSync(p, 'utf8');
const dashboard=read('src/routes/index.tsx');
const sessions=read('src/lib/sesi-kas.ts');
const booking=read('src/routes/booking.tsx');
const finance=read('src/routes/keuangan.tsx');
const receipt=read('src/components/detail-transaksi.tsx');
const flags=read('src/lib/feature-flags.ts');
let pass=0;
function check(label, f){f();pass++;console.log('PASS',label);}
check('Checkout role list excludes Housekeeping and Investor',()=>{
 const segment=dashboard.slice(dashboard.indexOf('const checkoutRoleAllowed ='),dashboard.indexOf('function totalPaid('));
 for(const role of ['owner','receptionist','supervisor'])assert.ok(segment.includes('posisiKode === "'+role+'"'));
 assert.ok(segment.includes('isCheckoutTraining'));
 for(const role of ['housekeeping','investor','inspector'])assert.ok(!segment.includes('posisiKode === "'+role+'"'));
});
check('Checkout checks training session, payment loading, amount and room status',()=>{
 const seg=dashboard.slice(dashboard.indexOf('function checkoutDisabledReason('),dashboard.indexOf('async function checkOut('));
 for(const part of ['!checkoutSessionId','payments.loading','payments.error','item.status !== "check_in"','room.status !== "occupied"','totalPaid(item.id) < total'])assert.ok(seg.includes(part),part);
});
check('Checkout requires explicit confirmation and sends training session id',()=>{
 const seg=dashboard.slice(dashboard.indexOf('async function checkOut('),dashboard.indexOf('const jumlahTerisi'));
 assert.ok(seg.includes('window.confirm('));
 assert.ok(seg.includes('"check_out_training_transaction"'));
 assert.ok(seg.includes('"check_out_transaction"'));
 assert.ok(seg.includes('_session_id: checkoutSessionId'));
});
check('Trainee cash context is assigned OPEN session, never own',()=>{
 assert.ok(sessions.includes("session.status === 'OPEN'"));
 assert.ok(/const ownSession\s*=\s*training\.is_training\s*\?\s*undefined/.test(sessions));
 assert.ok(sessions.includes('canOpenSession: !training.is_training'));
 assert.ok(sessions.includes('training.session_id'));
});
check('Booking training uses training wrappers for payment and check-in',()=>{
 assert.ok(booking.includes("'record_training_transaction_payment'"));
 assert.ok(booking.includes("'check_in_training_booking'"));
 assert.ok(booking.includes('recordTrainingTransactionPaymentCombined'));
});
check('Trainee closing not rendered, refund Owner-only',()=>{
 assert.ok(finance.includes("!isTraining && <Button"));
 assert.ok(/disabled=\{!isOwner\s*\|\|\s*busy[^}]*\}\s+onClick=\{\(\) => void refund\(\)\}/.test(finance));
});
check('58mm receipt has fail-closed flag and disabled inactive control',()=>{
 assert.ok(receipt.includes('featureFlags.receipt58mm'));
 assert.ok(receipt.includes('<ReceiptTransactionButton'));
 assert.ok(receipt.includes('<button type="button" disabled title="Cetak struk pembayaran resmi belum diaktifkan.'));
});
check('Receipt activation depends on product/backend/Owner consent gates',()=>{
 for(const key of ['VITE_FEATURE_RECEIPT_58MM','VITE_FEATURE_RECEIPT_BACKEND_READY','VITE_FEATURE_RECEIPT_OWNER_APPROVED']) assert.ok(flags.includes(key));
 assert.ok(flags.includes('values.every(envTrue)'));
});
console.log('No7G checkout-training-receipt source guards',pass+'/'+pass,'PASS');
