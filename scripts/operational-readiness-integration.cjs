// Focused frontend integration tests. No live client, browser, or database.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const results = [];
async function check(name, run) {
  if (process.env['READINESS_TEST_FILTER'] && !name.includes(process.env['READINESS_TEST_FILTER'])) return;
  await run(); results.push({ name, status: 'PASS' });
}
function load(source, mocks = {}, globals = {}) {
  const output = ts.transpileModule(source.replaceAll('import.meta.env', '__env'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const context = { exports: {}, __env: {}, crypto: require('node:crypto').webcrypto,
    require: (name) => { if (name in mocks) return mocks[name]; throw Error(`Unexpected import: ${name}`); }, ...globals };
  vm.runInNewContext(output, context);
  return context.exports;
}
function findNode(file, predicate) {
  const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found;
  function visit(node) { if (!found && predicate(node)) found = node; if (!found) ts.forEachChild(node, visit); }
  visit(tree); assert.ok(found, `AST node missing: ${file}`); return found;
}
const formFile = 'src/components/formulir-pemesanan.tsx';
const saveNode = findNode(formFile, (n) => ts.isFunctionDeclaration(n) && n.name?.text === 'save');
function saveHarness(overrides = {}) {
  const calls = [], messages = [];
  const context = {
    dataError: '', dataLoading: false, mode: 'booking', scheduledDate: '2026-12-01', scheduledTime: '13:00',
    phone: '081234567890', name: 'Dummy', address: 'Local', matchedGuest: undefined,
    methods: ['Cash', 'QRIS'], nominal: { Cash: '80000', QRIS: '50000' }, amount: '80000', method: 'Cash',
    featureFlags: { combinedPayment: true }, extraGuestOn: true, extra: { tambahan: 1 },
    availableRooms: [{ id: 'room' }], roomId: 'room', packageId: 'package', selectedPackage: { active: true },
    selectedRoomType: { pricing_group: 'standard' }, selectedPrice: 80000, total: 130000, paymentTotal: 130000,
    minimumDp: 52000, setting: { minimum_dp_mode: 'PERCENTAGE', minimum_dp_value: 40 },
    sessionId: 'session', needsAssistedContext: false, jumlahTamu: 3, dayMode: 'weekday',
    lastRequestFingerprint: '', idempotencyKey: 'request', paymentIdempotencyKeys: { Cash: 'cash-key', QRIS: 'qris-key' },
    isTraining: false, setError: (m) => messages.push(m), setSaving() {}, setIdempotencyKey() {},
    setLastRequestFingerprint() {}, setPaymentIdempotencyKeys() {}, setSavedNumber() {}, onSaved: async () => {},
    rupiah: (v) => String(v), shouldUseCombinedPayment: (count, on) => on && count > 1,
    createReservationCombined: async (args) => { calls.push(['combined', args]); return { data: { transaction_number: 'TEST' } }; },
    createTrainingReservationCombined: async (args) => { calls.push(['training-combined', args]); return { data: { transaction_number: 'TEST' } }; },
    rpc: async (name, args) => { calls.push([name, args]); return { data: 'TEST' }; }, ...overrides,
  };
  return { run: () => load(`exports.run = ${saveNode.getText()}`, {}, context).run({ preventDefault() {} }), calls, messages };
}
function receiptHarness({ enabled = true, rpcImpl, queryImpl, popupBlocked = false } = {}) {
  const calls = [], windows = [];
  const rpc = async (name, args) => {
    calls.push([name, args]);
    if (rpcImpl) return rpcImpl(name, args);
    if (name === 'issue_payment_receipt') return { data: 'receipt-' + args._payment_id };
    if (name === 'request_receipt_print') return { data: { print_request_id: 'request-' + args._receipt_id, print_no: 1, copy_label: '', receipt_snapshot: {}, template_snapshot: {} } };
    return { data: null };
  };
  const window = { open() {
    if (popupBlocked) return null;
    const popup = { closed: false, prints: 0, document: { write() {}, close() {} }, focus() {}, print() { this.prints++; }, close() { this.closed = true; } };
    windows.push(popup); return popup;
  } };
  const api = load(read('src/lib/receipt-print.ts'), {
    '@/lib/data-live': { rpc }, '@/lib/feature-flags': { featureFlags: { receipt58mm: enabled } },
    '@/integrations/supabase/client': { supabase: { from: queryImpl ?? (() => { throw Error('Unexpected database query'); }) } },
  }, { window });
  return { api, calls, windows };
}

(async () => {
  const flags = load(read('src/lib/feature-flags.ts'));
  await check('Production Extra Guest stays OFF without exact approved hostname', () => {
    assert.equal(flags.extraGuestAktif('homestay.example', true), false);
    assert.equal(flags.extraGuestAktif('homestay.example', true, 'other.example'), false);
    assert.equal(flags.extraGuestAktif('evil.homestay.example', true, 'homestay.example'), false);
  });
  await check('Explicit hostname approval works only with existing three-gate result ON', () => {
    assert.equal(flags.extraGuestAktif('homestay.example', true, ' HOMESTAY.EXAMPLE '), true);
    assert.equal(flags.extraGuestAktif('homestay.example', false, 'homestay.example'), false);
    const projectHost = 'project--017f6e78-15f2-4d07-a38c-87cb185279bf.lovable.app';
    assert.equal(flags.extraGuestAktif(projectHost, true, projectHost), true);
    for (const entry of ['*.example', 'https://homestay.example', 'homestay.example:443']) {
      assert.equal(flags.extraGuestAktif('homestay.example', true, entry), false);
    }
  });
  await check('Combined extra-guest frontend sends guest_count, total and both components', async () => {
    const h = saveHarness(); await h.run(); assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0][0], 'combined'); assert.equal(h.calls[0][1]._guest_count, 3);
    assert.equal(h.calls[0][1]._payments.reduce((sum, p) => sum + p.amount, 0), 130000);
    assert.equal(JSON.parse(h.calls[0][1]._request_fingerprint).guestCount, 3);
  });
  await check('Training combined extra-guest uses existing training wrapper', async () => {
    const h = saveHarness({ isTraining: true }); await h.run();
    assert.equal(h.calls[0][0], 'training-combined'); assert.equal(h.calls[0][1]._guest_count, 3);
  });
  await check('Single-method extra-guest preserves legacy guest-count overload', async () => {
    const h = saveHarness({ methods: ['Cash'], nominal: { Cash: '130000' }, amount: '130000' }); await h.run();
    assert.equal(h.calls[0][0], 'create_reservation'); assert.equal(h.calls[0][1]._guest_count, 3);
  });
  await check('Extra Guest OFF still rejects extra guests before RPC', async () => {
    const h = saveHarness({ extraGuestOn: false }); await h.run(); assert.equal(h.calls.length, 0);
    assert.match(h.messages.join(' '), /maksimal 2 tamu/);
  });
  await check('Booking frontend enforces minimum DP on total including extra guests', async () => {
    const h = saveHarness({ methods: ['Cash'], nominal: { Cash: '51000' }, amount: '51000', paymentTotal: 51000 });
    await h.run(); assert.equal(h.calls.length, 0); assert.match(h.messages.join(' '), /DP minimum.*52000/);
  });
  const auto = findNode(formFile, (n) => ts.isCallExpression(n) && n.expression.getText() === 'useEffect' && n.arguments[0]?.getText().includes('setNominal'));
  await check('Read-only single-method check-in autofill includes Extra Guest; split amounts preserved', () => {
    let value = { Cash: '80000' };
    const globals = { mode: 'check_in', methods: ['Cash'], selectedPrice: 80000, total: 130000, setNominal: (f) => { value = f(value); } };
    load(`exports.run = ${auto.arguments[0].getText()}`, {}, globals).run(); assert.equal(value.Cash, '130000');
    load(`exports.run = ${auto.arguments[0].getText()}`, {}, { ...globals, methods: ['Cash', 'QRIS'], setNominal: () => { throw Error('Split amounts overwritten'); } }).run();
  });
  await check('Receipt OFF makes no RPC or query', async () => {
    const h = receiptHarness({ enabled: false });
    await assert.rejects(() => h.api.prepareReceiptPrint('p'), /belum diaktifkan/);
    await assert.rejects(() => h.api.receiptPaymentIds('TRX'), /belum diaktifkan/); assert.equal(h.calls.length, 0);
  });
  await check('Blocked popup makes no receipt request', () => {
    const h = receiptHarness({ popupBlocked: true }); assert.throws(() => h.api.openReceiptPrintWindow(), /blocked/); assert.equal(h.calls.length, 0);
  });
  await check('Receipt batch issues each payment, opens one dialog, records no physical confirmation', async () => {
    const h = receiptHarness(), popup = h.api.openReceiptPrintWindow(), keys = new Map();
    await h.api.printReceiptBatch(['p1', 'p2'], popup, keys);
    assert.equal(popup.prints, 1); assert.equal(keys.size, 0);
    const records = h.calls.filter(([name]) => name === 'record_receipt_print_result'); assert.equal(records.length, 2);
    assert.ok(records.every(([, args]) => args._status === 'PRINT_DIALOG_OPENED' && !('_physical_confirmed' in args)));
  });
  await check('Failed preparation retains request key for explicit retry and never prints', async () => {
    const h = receiptHarness({ rpcImpl: (name) => name === 'issue_payment_receipt' ? { data: 'r' } : { error: { message: 'dummy failure' } } });
    const keys = new Map(), popup = h.api.openReceiptPrintWindow();
    await assert.rejects(() => h.api.printReceiptBatch(['p'], popup, keys), /dummy failure/);
    const key = keys.get('p'); assert.ok(key); assert.equal(popup.prints, 0);
    await assert.rejects(() => h.api.printReceiptBatch(['p'], popup, keys), /dummy failure/);
    assert.equal(h.calls.filter(([name]) => name === 'request_receipt_print')[1][1]._idempotency_key, key);
  });
  await check('Receipt lookup scopes transaction and paginates all its payment IDs', async () => {
    const queries = [];
    const h = receiptHarness({ queryImpl: (table) => {
      const q = { select() { return q; }, eq(column, value) { queries.push([table, column, value]); return q; },
        order() { return q; }, single: async () => ({ data: { id: 'selected-tx' } }),
        range: async (from) => ({ data: Array.from({ length: from === 0 ? 200 : 1 }, (_, i) => ({ id: `p${from + i}` })) }) };
      return q;
    } });
    const ids = await h.api.receiptPaymentIds('BTRDTRX-000123'); assert.equal(ids.length, 201);
    assert.ok(queries.some((q) => q.join() === 'transactions,transaction_number,BTRDTRX-000123'));
    assert.equal(queries.filter((q) => q.join() === 'payments,transaction_id,selected-tx').length, 2);
  });
  const jsx = (_, props) => ({ type: _, props });
  function text(node) {
    if (node == null || typeof node === 'boolean') return '';
    if (Array.isArray(node)) return node.map(text).join(' ');
    if (typeof node !== 'object') return String(node);
    return typeof node.type === 'function' ? text(node.type(node.props)) : text(node.props?.children);
  }
  await check('Detail integration: stored guest/price snapshots and OPEN session render correctly', () => {
    const data = { transactions: [{ id: 'tx', transaction_number: 'TEST', guest_id: 'g', room_id: 'r', package_id: 'p',
      guest_count: 3, base_price_snapshot: 80000, extra_guest_charge: 50000, extra_guest_count: 1, extra_guest_unit_price: 50000,
      price_snapshot: 130000, status: 'check_in', day_mode: 'weekday', created_by: 'u' }],
      payments: [{ id: 'pay', transaction_id: 'tx', cash_session_id: 's', amount: 130000, kind: 'payment' }],
      guests: [], rooms: [], room_types: [], packages: [], employees: [], finance_cash_sessions: [{ id: 's', status: 'OPEN', operational_date: '2026-11-12' }], housekeeping_history: [] };
    const modules = {
      'react/jsx-runtime': { jsx, jsxs: jsx }, 'lucide-react': new Proxy({}, { get: (_, key) => key }),
      '@/components/detail-premium': {}, '@/components/kerangka': { LambangTeratai: 'logo' },
      '@/components/ikon-whatsapp': { IkonWhatsApp: 'whatsapp' }, '@/lib/aksi-operasional': { bolehHubungiTamu: () => false },
      '@/lib/whatsapp': {}, '@/lib/peran': { usePeran: () => ({ posisiKode: 'owner' }) },
      '@/lib/data-live': { useTable: (name) => ({ rows: data[name] ?? [] }) }, '@/lib/data-contoh': { rupiah: String },
      '@/lib/waktu-transaksi': { durasiWib: () => '', jamWib: () => '', tanggalWib: (v) => v, waktuWib: () => '' },
      '@/components/receipt-actions': { ReceiptPrintButton: () => '', ReceiptHistoryButton: () => '' },
    };
    const api = load(read('src/components/detail-transaksi.tsx'), modules);
    const rendered = text(api.DetailTransaksi({ transactionId: 'tx', onClose() {} }));
    assert.match(rendered, /Jumlah Tamu\s*:\s*3/); assert.match(rendered, /Extra Guest\s+1\s+50000\s+50000/);
    assert.match(rendered, /80000\s+80000/); assert.match(rendered, /Terbuka/);
  });
  await check('Receipt control integration: popup precedes lookup and batch; OFF renders nothing', async () => {
    const events = [];
    function component(enabled) { return load(read('src/components/receipt-actions.tsx'), {
      'react/jsx-runtime': { jsx, jsxs: jsx }, react: { useRef: (value) => ({ current: value }), useState: (value) => [value, () => {}] },
      'lucide-react': { Printer: 'printer' }, '@/components/ui/button': { Button: 'button' },
      '@/lib/feature-flags': { featureFlags: { receipt58mm: enabled } },
      '@/lib/receipt-print': { openReceiptPrintWindow: () => { events.push('popup'); return { closed: false, close() {} }; },
        receiptPaymentIds: async () => { events.push('lookup'); return ['p']; }, printReceiptBatch: async () => { events.push('batch'); } },
    }); }
    const off = component(false).ReceiptTransactionButton({ transactionNumber: 'TEST' }); assert.equal(off.type(off.props), null);
    const on = component(true).ReceiptTransactionButton({ transactionNumber: 'TEST' });
    const tree = on.type(on.props); tree.props.children[0].props.onClick();
    assert.equal(events[0], 'popup'); await new Promise(setImmediate); assert.deepEqual(events, ['popup', 'lookup', 'batch']);
  });
  console.log(JSON.stringify({ results, total: results.length, limits: 'Node VM, mocked RPC/query/window. No Cloud, database, browser or physical printer.' }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
