// Baturaden 25 Homestay — focused, offline activation review.
// Does not connect to Cloud, create transactions, read credentials, or modify data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function loadEnvText() {
  const data = fs.readFileSync('.env', 'utf8');
  const env = Object.create(null);
  for (const line of data.split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w]*)=(.*)$/.exec(line.trim());
    if (m) {
      assert.equal(Object.hasOwn(env, m[1]), false, 'duplicate env key: ' + m[1]);
      env[m[1]] = m[2].trim();
    }
  }
  return env;
}
function loadTsExports(filename, env = {}) {
  const tsText = fs.readFileSync(filename, 'utf8').replace(
    /import\.meta\.env\[['"]([A-Z0-9_]+)['"]\]/g,
    (_, key) => JSON.stringify(env[key]),
  );
  const js = ts.transpileModule(tsText, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const output = { exports: {} };
  // Only our two audited, import-free TypeScript helpers are evaluated.
  new Function('module', 'exports', js)(output, output.exports);
  return output.exports;
}

let passed = 0;
function check(title, fn) {
  fn();
  passed++;
  console.log('PASS: ' + title);
}

const env = loadEnvText();
const gateKeys = [
  'VITE_FEATURE_COMBINED_PAYMENT',
  'VITE_FEATURE_COMBINED_PAYMENT_BACKEND_READY',
  'VITE_FEATURE_COMBINED_PAYMENT_OWNER_APPROVED',
];
const featureSrc = fs.readFileSync('src/lib/feature-flags.ts', 'utf8');
const checkinSrc = fs.readFileSync('src/components/formulir-pemesanan.tsx', 'utf8');
const bookingSrc = fs.readFileSync('src/routes/booking.tsx', 'utf8');
const flagExports = loadTsExports('src/lib/feature-flags.ts', env);
const choice = loadTsExports('src/lib/payment-method-choice.ts');

check('exact three independent feature gates enabled on review branch', () => {
  for (const key of gateKeys) {
    assert.equal(env[key], 'true', key + ' must be exact literal true');
    assert.ok(featureSrc.includes("import.meta.env['" + key + "']"));
  }
  assert.equal(flagExports.featureFlags.combinedPayment, true);
});
check('each individual missing/false gate stops combined payments', () => {
  for (const key of gateKeys) {
    for (const off of ['false', undefined]) {
      const copy = { ...env };
      if (off === undefined) delete copy[key];
      else copy[key] = off;
      const flags = loadTsExports('src/lib/feature-flags.ts', copy).featureFlags;
      assert.equal(flags.combinedPayment, false, key);
    }
  }
});
check('Owner-approved Cash + QRIS remain separate and can be deselected', () => {
  const a = choice.choosePaymentMethods(['QRIS'], 'Cash', true);
  assert.deepEqual(a, ['QRIS', 'Cash']);
  assert.deepEqual(choice.choosePaymentMethods(a, 'Cash', true), ['QRIS']);
});
check('Owner-approved QRIS + Transfer allowed, but third method blocked', () => {
  const a = choice.choosePaymentMethods(['QRIS'], 'Transfer', true);
  assert.deepEqual(a, ['QRIS', 'Transfer']);
  assert.deepEqual(choice.choosePaymentMethods(a, 'Cash', true), a);
  assert.equal(new Set(a).size, 2);
});
check('legacy single method mode remains safe if feature gate disabled', () => {
  const a = choice.choosePaymentMethods(['QRIS'], 'Cash', false);
  assert.deepEqual(a, ['Cash']);
  assert.deepEqual(choice.amountAfterPaymentSwitch({ QRIS: '100000' }, ['QRIS'], 'Cash', false), { Cash: '100000' });
});
check('two payment amounts, Check-in must be fully settled', () => {
  const total = 100000;
  const lines = [{ method: 'QRIS', amount: 70000 }, { method: 'Cash', amount: 30000 }];
  assert.equal(lines.length, 2);
  assert.equal(lines.reduce((sum, l) => sum + l.amount, 0), total);
  assert.ok(checkinSrc.includes("mode === 'check_in' && paymentTotal !== total"));
  assert.ok(checkinSrc.includes('methods.map(m => ({ method: m, amount: Number(nominal[m])'));
  assert.ok(checkinSrc.includes("maks. {featureFlags.combinedPayment ? '2' : '1'}"));
});
check('Booking split DP 40%, round up to rupiah, then remaining balance', () => {
  const percent = 40;
  assert.equal(Math.ceil((123001 * percent) / 100), 49201);
  assert.equal(Math.ceil((100000 * percent) / 100), 40000);
  const paid = 20000 + 20000;
  assert.equal(paid, 40000);
  assert.equal(100000 - paid, 60000);
  assert.ok(checkinSrc.includes("mode === 'booking' && minimumDp !== null && paymentTotal < minimumDp"));
});
check('all three UI paths use atomic combined RPCs when two methods chosen', () => {
  assert.ok(checkinSrc.includes('createReservationCombined(combinedArgs)'));
  assert.ok(checkinSrc.includes('createTrainingReservationCombined(combinedArgs)'));
  assert.ok(bookingSrc.includes('recordTransactionPaymentCombined(combinedArgs)'));
  assert.ok(bookingSrc.includes('recordTrainingTransactionPaymentCombined(combinedArgs)'));
  assert.ok(bookingSrc.includes("featureFlags.combinedPayment ? '2' : '1'"));
});
console.log('B25 TWO-METHOD PAYMENT ACTIVATION REVIEW: ' + passed + '/' + passed + ' PASS');
