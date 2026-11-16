import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

// Execute the actual submit handler without mounting auth/UI or importing the Cloud client.
// All dependencies are local fakes; no network, database, or real guest data is used.
const source = readFileSync(new URL('../src/components/formulir-pemesanan.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('form.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler: ts.FunctionDeclaration | undefined;
function find(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'save') handler = node;
  ts.forEachChild(node, find);
}
find(ast);
if (!handler) throw new Error('Actual reservation submit handler not found');
const code = ts.transpileModule(handler.getText(ast), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function fixture(overrides: Record<string, unknown> = {}, failure: string | null = null) {
  const calls: { fn: string; args: Record<string, any> }[] = [];
  const errors: string[] = [], saved: unknown[] = [], rotated: unknown[] = [], saving: boolean[] = [];
  let refreshed = 0;
  const dispatch = async (fn: string, args: Record<string, unknown>) => {
    // Capture the JSON wire shape: omitted/undefined is different from explicit null.
    calls.push({ fn, args: JSON.parse(JSON.stringify(args)) });
    return failure ? { data: null, error: { message: failure } }
      : { data: 'TRX-DUMMY', error: null };
  };
  const context = {
    dataError: null, dataLoading: false, phone: '0800000000', name: 'Dummy', address: 'Dummy',
    matchedGuest: null, amount: '100000', mode: 'check_in', scheduledDate: '', scheduledTime: '',
    methods: ['Cash'], method: 'Cash', nominal: { Cash: '100000' },
    featureFlags: { combinedPayment: false }, extra: { tambahan: 0 }, extraGuestOn: false,
    availableRooms: [{ id: 'dummy-room' }], roomId: 'dummy-room', packageId: 'dummy-package',
    selectedPackage: { active: true }, selectedRoomType: { pricing_group: 'standard' },
    selectedPrice: 100000, paymentTotal: 100000, total: 100000, minimumDp: null, setting: null,
    sessionId: 'dummy-session', needsAssistedContext: false, dayMode: 'weekday', jumlahTamu: 2,
    lastRequestFingerprint: '', idempotencyKey: 'dummy-retry-key', paymentIdempotencyKeys: { Cash: 'dummy-cash-key', QRIS: 'dummy-qris-key' },
    isTraining: false,
    setError: (v: string) => errors.push(v), setSaving: (v: boolean) => saving.push(v),
    setIdempotencyKey: (v: unknown) => rotated.push(v), setLastRequestFingerprint: () => {},
    setPaymentIdempotencyKeys: () => {}, setSavedNumber: (v: unknown) => saved.push(v),
    onSaved: async () => { refreshed++; }, rpc: dispatch, rupiah: String,
    shouldUseCombinedPayment: (n: number, enabled: boolean) => enabled && n > 1,
    createReservationCombined: (args: Record<string, unknown>) => dispatch('create_reservation_combined', args),
    createTrainingReservationCombined: (args: Record<string, unknown>) => dispatch('create_training_reservation_combined', args),
    ...overrides,
  };
  const save = new Function(...Object.keys(context), `${code}\nreturn save;`)(...Object.values(context));
  return { calls, errors, saved, rotated, saving, refreshed: () => refreshed,
    run: () => save({ preventDefault() {} }) };
}

for (const extraGuestOn of [false, true]) {
  test(`walk-in wire contract includes explicit null, guest-count gate=${extraGuestOn}`, async () => {
    const amount = extraGuestOn ? 150000 : 100000;
    const f = fixture({ extraGuestOn, jumlahTamu: extraGuestOn ? 3 : 2,
      extra: { tambahan: extraGuestOn ? 50000 : 0 }, amount: String(amount),
      nominal: { Cash: String(amount) }, paymentTotal: amount, total: amount });
    await f.run();
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]!.fn).toBe('create_reservation');
    expect(Object.keys(f.calls[0]!.args).sort()).toEqual([
      '_mode', '_room_id', '_package_id', '_name', '_phone', '_address', '_amount', '_method',
      '_day_mode', '_scheduled_check_in', '_idempotency_key', '_session_id',
      ...(extraGuestOn ? ['_guest_count'] : []),
    ].sort());
    expect(f.calls[0]!.args).toMatchObject({ _scheduled_check_in: null, _session_id: 'dummy-session',
      _idempotency_key: 'dummy-retry-key', _day_mode: 'weekday', _amount: amount });
    if (extraGuestOn) expect(f.calls[0]!.args._guest_count).toBe(3);
    expect(f.saved).toEqual(['TRX-DUMMY']);
    expect(f.refreshed()).toBe(1);
    expect(f.rotated).toHaveLength(1);
    expect(f.saving).toEqual([true, false]);
  });
}

test('booking preserves selected WIB schedule across midnight; missing schedule never dispatches', async () => {
  const f = fixture({ mode: 'booking', scheduledDate: '2026-11-17', scheduledTime: '00:05' });
  await f.run();
  expect(f.calls[0]!.args._scheduled_check_in).toBe('2026-11-17T00:05:00+07:00');
  expect(new Date(f.calls[0]!.args._scheduled_check_in).toISOString()).toBe('2026-11-16T17:05:00.000Z');
  const missing = fixture({ mode: 'booking' });
  await missing.run();
  expect(missing.calls).toHaveLength(0);
  expect(missing.errors.at(-1)).toContain('Tanggal dan jam');
});

for (const isTraining of [false, true]) {
  test(`single/combined routing preserves Training and schedule contract: ${isTraining}`, async () => {
    const f = fixture({ isTraining });
    await f.run();
    expect(f.calls[0]!.fn).toBe(isTraining ? 'create_training_reservation' : 'create_reservation');
    expect(f.calls[0]!.args._scheduled_check_in).toBeNull();
    const combined = fixture({ isTraining, featureFlags: { combinedPayment: true },
      methods: ['Cash', 'QRIS'], nominal: { Cash: '40000', QRIS: '60000' } });
    await combined.run();
    expect(combined.calls).toHaveLength(1);
    expect(combined.calls[0]!.fn).toBe(isTraining ? 'create_training_reservation_combined' : 'create_reservation_combined');
    expect(combined.calls[0]!.args).toMatchObject({ _scheduled_check_in: null,
      _session_id: 'dummy-session', _request_idempotency_key: 'dummy-retry-key',
      _payments: [{ method: 'Cash', amount: 40000, idempotency_key: 'dummy-cash-key' },
        { method: 'QRIS', amount: 60000, idempotency_key: 'dummy-qris-key' }] });
  });
}

test('server denial is surfaced, retry keeps idempotency/session and never reports success', async () => {
  const f = fixture({}, 'Dummy server denial');
  await f.run();
  await f.run();
  expect(f.errors.at(-1)).toBe('Dummy server denial');
  expect(f.calls).toHaveLength(2);
  expect(f.calls[0]!.args).toEqual(f.calls[1]!.args);
  expect(f.saved).toHaveLength(0);
  expect(f.rotated).toHaveLength(0);
  expect(f.refreshed()).toBe(0);
  expect(f.saving).toEqual([true, false, true, false]);
});

test('cash/assisted-session guards prevent any dispatch or idempotency rotation', async () => {
  for (const override of [{ sessionId: '' }, { needsAssistedContext: true }]) {
    const f = fixture(override);
    await f.run();
    expect(f.calls).toHaveLength(0);
    expect(f.rotated).toHaveLength(0);
    expect(f.errors.at(-1)).toContain('sesi');
  }
});

test('installed SDK preserves explicit null on the wire; legacy omission fails required-name contract', async () => {
  const f = fixture({ extraGuestOn: true });
  await f.run();
  const args = f.calls[0]!.args;
  const requiredNames = ['_mode', '_room_id', '_package_id', '_name', '_phone', '_address',
    '_amount', '_method', '_day_mode', '_scheduled_check_in', '_idempotency_key',
    '_session_id', '_guest_count'].sort();
  let requests = 0;
  const client = createClient('https://rpc-test.invalid', 'isolated-dummy-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      expect(String(url)).toBe('https://rpc-test.invalid/rest/v1/rpc/create_reservation');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body));
      requests++;
      // Local model of the REQUIRED argument-name metadata reported by Owner.
      // This is not a live PostgREST/schema-cache or database test.
      const matches = JSON.stringify(Object.keys(body).sort()) === JSON.stringify(requiredNames);
      return new Response(JSON.stringify(matches ? 'TRX-DUMMY' : {
        code: 'PGRST202', message: 'No matching required argument names',
      }), { status: matches ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const legacy = { ...args };
  delete legacy._scheduled_check_in;
  expect((await client.rpc('create_reservation', legacy)).error?.code).toBe('PGRST202');
  const fixed = await client.rpc('create_reservation', args);
  expect(fixed.error).toBeNull();
  expect(fixed.data).toBe('TRX-DUMMY');
  expect(requests).toBe(2);
});
