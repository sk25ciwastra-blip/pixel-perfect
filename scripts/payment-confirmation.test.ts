import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { PDFDocument, PDFArray, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { createClient } from '@supabase/supabase-js';
import { buildPaymentConfirmation, confirmationDate, type ConfirmationInput } from '../src/lib/payment-confirmation';
import { loadPaymentConfirmation, loadCheckInSuccess } from '../src/lib/payment-confirmation-data';
import { generatePaymentConfirmationPdf, downloadConfirmationBytes } from '../src/lib/payment-confirmation-pdf';
import { createPaymentConfirmationActions, type ConfirmationDependencies, type ConfirmationState } from '../src/lib/payment-confirmation-actions';

// Issue #45 example is fixture only; never reads or writes DEMO/Cloud data.
function fixture(): ConfirmationInput {
  return {
    transaction: { id: 'tx', transaction_number: 'BTRDTRX-000025', status: 'check_in', guest_id: 'guest', room_id: 'room',
      package_id: 'pkg', price_snapshot: 80000, base_price_snapshot: 80000, extra_guest_charge: 0,
      extra_guest_count: 0, extra_guest_unit_price: 50000, guest_count: 2,
      scheduled_check_in: '2026-11-12T06:58:00+07:00', scheduled_check_out: '2026-11-12T08:58:00+07:00',
      started_at: '2026-11-12T07:13:12+07:00', ends_at: '2026-11-12T08:58:00+07:00', checked_out_at: null,
      updated_at: '2026-11-12T07:13:12+07:00' },
    guest: { id: 'guest', full_name: 'Fixture Guest', phone: '081234567890' },
    room: { id: 'room', room_number: '03', room_type_id: 'type' }, roomType: { id: 'type', name: 'Fixture Type' },
    package: { id: 'pkg', name: 'Paket 2 Jam', time_mode: 'duration_midnight_cap' },
    payments: [
      { id: 'p2', transaction_id: 'tx', amount: 42000, created_at: '2026-11-12T07:12:00+07:00', kind: 'payment', method: 'QRIS' },
      { id: 'p1', transaction_id: 'tx', amount: 38000, created_at: '2026-11-12T06:00:00+07:00', kind: 'dp', method: 'QRIS' },
    ],
    refunds: [], refundsComplete: true, canReadGuestPhone: true,
    business: { name: 'Baturaden 25 Homestay', address: 'Fixture configured address', city: 'Fixture city', whatsapp: 'Fixture official contact' },
    generatedAt: '2026-11-12T07:14:00+07:00',
  };
}

test('DP + settlement snapshot, WIB, payment ordering and actual vs scheduled times', () => {
  const result = buildPaymentConfirmation(fixture());
  expect({ number: result.transactionNumber, code: result.package.code, totals: result.totals,
    payments: result.history.map(p => [p.id, p.kind, p.method, p.amount]), times: result.times }).toEqual({
    number: 'BTRDTRX-000025', code: 'P2', totals: { room: 80000, extraGuest: 0, bill: 80000, grossPaid: 80000,
      refunded: 0, netPaid: 80000, remaining: 0, credit: 0, status: 'PAID' },
    payments: [['p1', 'Deposit (DP)', 'QRIS', 38000], ['p2', 'Payment / Settlement', 'QRIS', 42000]],
    times: { scheduledCheckIn: '12 Nov 2026, 06:58 WIB', scheduledCheckOut: '12 Nov 2026, 08:58 WIB',
      actualCheckIn: '12 Nov 2026, 07:13 WIB', checkoutDeadline: '12 Nov 2026, 08:58 WIB', actualCheckOut: 'Not available' },
  });
  expect(confirmationDate('2026-11-11T23:58:00Z')).toBe('12 Nov 2026, 06:58 WIB');
});

test('partial, unpaid/empty, refunds, no proration, extra guest and invalid adjustments', () => {
  const input = fixture();
  input.payments = input.payments.slice(1);
  expect(buildPaymentConfirmation(input).totals).toMatchObject({ status: 'PARTIALLY PAID', remaining: 42000 });
  input.payments = [];
  expect(buildPaymentConfirmation(input).totals).toMatchObject({ status: 'UNPAID', remaining: 80000 });
  input.payments = fixture().payments;
  input.refunds = [{ id: 'r', transaction_id: 'tx', amount: 42000, created_at: '2026-11-12T08:00:00+07:00', refund_method: 'QRIS' }];
  expect(buildPaymentConfirmation(input).totals).toMatchObject({ status: 'PARTIALLY PAID', netPaid: 38000, refunded: 42000 });
  input.refunds[0]!.amount = 80000;
  expect(buildPaymentConfirmation(input).totals.status).toBe('UNPAID');
  input.refunds = [];
  Object.assign(input.transaction, { guest_count: 3, extra_guest_count: 1, extra_guest_charge: 50000, price_snapshot: 130000 });
  expect(buildPaymentConfirmation(input).totals).toMatchObject({ bill: 130000, room: 80000, extraGuest: 50000, remaining: 50000 });
  input.payments[0]!.kind = 'unknown-adjustment';
  expect(() => buildPaymentConfirmation(input)).toThrow('adjustment');
});

test('old late ends_at cannot leak as deadline; fixed modes and checked_out_at remain distinct', () => {
  const input = fixture(); input.transaction.ends_at = '2026-11-12T09:13:12+07:00';
  expect(buildPaymentConfirmation(input).times.checkoutDeadline).toContain('08:58');
  input.transaction.ends_at = '2026-11-12T08:50:00+07:00';
  expect(buildPaymentConfirmation(input).times.checkoutDeadline).toContain('08:50');
  input.transaction.ends_at = '2026-11-12T16:00:00+07:00'; input.package.time_mode = 'fixed_window';
  input.transaction.status = 'check_out'; input.transaction.checked_out_at = '2026-11-12T15:42:00+07:00';
  expect(buildPaymentConfirmation(input).times).toMatchObject({ checkoutDeadline: '12 Nov 2026, 16:00 WIB', actualCheckOut: '12 Nov 2026, 15:42 WIB' });
});

test('incomplete/denied/mismatched data fails closed, phone redaction, deterministic ties', () => {
  const input = fixture(); input.canReadGuestPhone = false;
  expect(buildPaymentConfirmation(input).guest.phone).toBeNull();
  input.payments[0]!.created_at = input.payments[1]!.created_at;
  expect(buildPaymentConfirmation(input).history.map(p => p.id)).toEqual(['p1', 'p2']);
  input.refundsComplete = false; expect(() => buildPaymentConfirmation(input)).toThrow('refund');
  input.refundsComplete = true; input.transaction.price_snapshot = null;
  expect(() => buildPaymentConfirmation(input)).toThrow('Total');
  input.transaction.price_snapshot = 80000; input.guest.id = 'wrong';
  expect(() => buildPaymentConfirmation(input)).toThrow('tidak cocok');
});

const logo = new Uint8Array(readFileSync('public/assets/Logo_Resmi_BTRD25_Transparan.png'));
async function pdfText(pdf: PDFDocument) {
  let result = '';
  for (const page of pdf.getPages()) {
    const contents = page.node.lookup(PDFName.of('Contents'), PDFArray);
    for (const ref of contents.asArray()) {
      const raw = pdf.context.lookup(ref, PDFRawStream);
      const stream = Buffer.from(decodePDFRawStream(raw).decode()).toString('latin1');
      result += [...stream.matchAll(/<([0-9A-F]+)>\s*Tj/gi)].map(m => Buffer.from(m[1]!, 'hex').toString('latin1')).join(' ');
    }
  }
  return result;
}
test('real landscape PDF, official logo, one page when it fits, full multipage history', async () => {
  const data = buildPaymentConfirmation(fixture());
  const bytes = await generatePaymentConfirmationPdf(data, logo);
  expect(new TextDecoder().decode(bytes.slice(0, 8))).toStartWith('%PDF-');
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeGreaterThan(pdf.getPage(0).getHeight());
  expect(await pdfText(pdf)).toContain('PAYMENT CONFIRMATION');
  expect(await pdfText(pdf)).toContain('BTRDTRX-000025');
  expect(pdf.getPage(0).node.Resources()?.toString()).toContain('XObject');
  data.history = Array.from({ length: 205 }, (_, i) => ({ ...data.history[0]!, id: `p${i}`, method: `METHOD-${String(i).padStart(3, '0')}` }));
  const many = await PDFDocument.load(await generatePaymentConfirmationPdf(data, logo));
  expect(many.getPageCount()).toBeGreaterThan(1);
  const text = await pdfText(many);
  for (let i = 0; i < 205; i++) expect(text).toContain(`METHOD-${String(i).padStart(3, '0')}`);
  data.guest.name = 'A'.repeat(12000);
  expect((await PDFDocument.load(await generatePaymentConfirmationPdf(data, logo))).getPageCount()).toBeGreaterThan(many.getPageCount());
  data.guest.name = '中文';
  await expect(generatePaymentConfirmationPdf(data, logo)).rejects.toThrow('font PDF');
});

function templateFixture(kind = 'BOOKING') {
  return { id: kind, template_kind: kind, status: 'ACTIVE', published_at: null as string | null,
    language: 'en', paper_width_mm: 58, header_config: { title: fixture().business.name,
      address: fixture().business.address, city: fixture().business.city, whatsapp: fixture().business.whatsapp } };
}
function transport(options: { role?: string; position?: string; loggedIn?: boolean; fail?: string; count?: number; stale?: boolean;
  templates?: ReturnType<typeof templateFixture>[] } = {}) {
  const input = fixture(), requests: URL[] = [];
  let txReads = 0;
  const client = createClient('https://example.invalid', 'isolated-test-key', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => {
    const u = new URL(String(url)); requests.push(u);
    const table = u.pathname.split('/').at(-1)!;
    if (table === 'transactions') txReads++;
    if (options.fail === table) return new Response(JSON.stringify({ message: 'denied', code: '42501' }), { status: 403 });
    const objects: Record<string, unknown> = { user_roles: { role: options.role ?? 'owner' }, employees: { active: true, position: options.position ?? 'receptionist' },
      transactions: { ...input.transaction, updated_at: options.stale && txReads > 1 ? 'changed' : input.transaction.updated_at },
      guests: input.guest, rooms: input.room, packages: input.package, room_types: input.roomType };
    let body: unknown = objects[table];
    if (table === 'receipt_template_versions') {
      // Model Cloud rows and apply actual SDK query filters, rather than returning a canned header.
      let rows = options.templates ?? [templateFixture(), templateFixture('WALK_IN')];
      for (const key of ['status', 'language', 'paper_width_mm'] as const) {
        const filter = u.searchParams.get(key);
        if (filter) rows = rows.filter(row => `eq.${row[key]}` === filter);
      }
      const kinds = u.searchParams.get('template_kind');
      if (kinds) rows = rows.filter(row => kinds.slice(4, -1).split(',').includes(row.template_kind));
      if (u.searchParams.has('published_at')) rows = rows.filter(row => row.published_at !== null);
      rows = [...rows].sort((a, b) => a.id.localeCompare(b.id));
      const offset = Number(u.searchParams.get('offset') ?? 0), limit = Number(u.searchParams.get('limit') ?? 100);
      body = rows.slice(offset, offset + limit);
    }
    if (table === 'payments' || table === 'finance_refunds') {
      const offset = Number(u.searchParams.get('offset') ?? 0), limit = Number(u.searchParams.get('limit') ?? 100);
      body = table === 'finance_refunds' ? [] : options.count
        ? Array.from({ length: options.count }, (_, i) => ({ ...input.payments[0], id: `p${String(i).padStart(4, '0')}` })).slice(offset, offset + limit) : input.payments;
    }
    expect(init?.method ?? 'GET').toBe('GET');
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  } } });
  client.auth.getUser = async () => ({ data: { user: options.loggedIn === false ? null : { id: 'operator' } }, error: null }) as never;
  return { client, requests };
}
test('RLS-scoped reads paginate history, select same TRX, never mutate; auth/permission/error/staleness gates', async () => {
  const { client, requests } = transport({ count: 205 });
  expect((await loadPaymentConfirmation('tx', client)).history).toHaveLength(205);
  expect(requests.filter(u => u.pathname.endsWith('/payments'))).toHaveLength(3);
  for (const u of requests.filter(u => /\/(payments|finance_refunds)$/.test(u.pathname))) expect(u.searchParams.get('transaction_id')).toBe('eq.tx');
  expect((await loadCheckInSuccess('tx', 'BTRDTRX-000025', client)).id).toBe('tx');
  await expect(loadCheckInSuccess('tx', 'wrong', client)).rejects.toThrow('Jangan ulang');
  await expect(loadPaymentConfirmation('tx', transport({ loggedIn: false }).client)).rejects.toThrow('login');
  await expect(loadPaymentConfirmation('tx', transport({ role: 'employee' }).client)).rejects.toThrow('refund');
  await expect(loadPaymentConfirmation('tx', transport({ role: 'employee', position: 'housekeeping' }).client)).rejects.toThrow('ditolak');
  await expect(loadPaymentConfirmation('tx', transport({ fail: 'finance_refunds' }).client)).rejects.toThrow('denied');
  await expect(loadPaymentConfirmation('tx', transport({ stale: true }).client)).rejects.toThrow('berubah');
});

test('official identity accepts ACTIVE unpublished Cloud templates and enforces shared valid headers', async () => {
  const { client, requests } = transport();
  expect((await loadPaymentConfirmation('tx', client)).business).toEqual(fixture().business);
  const query = requests.find(u => u.pathname.endsWith('/receipt_template_versions'))!.searchParams;
  expect(query.get('status')).toBe('eq.ACTIVE');
  expect(query.get('language')).toBe('eq.en');
  expect(query.get('paper_width_mm')).toBe('eq.58');
  expect(query.get('template_kind')).toBe('in.(BOOKING,WALK_IN)');
  expect(query.has('published_at')).toBe(false);
  expect(query.get('order')).toBe('id.asc');
  expect(query.get('select')).not.toContain('published_at');
  const inactive = { ...templateFixture(), status: 'RETIRED', published_at: '2026-11-01T00:00:00Z' };
  inactive.header_config = { ...inactive.header_config, title: 'Old identity' };
  expect((await loadPaymentConfirmation('tx', transport({ templates: [inactive, templateFixture('WALK_IN')] }).client)).business)
    .toEqual(fixture().business);
  for (const templates of [[], [inactive], [{ ...templateFixture(), header_config: { ...templateFixture().header_config, title: '  ' } }],
    [templateFixture(), { ...templateFixture('WALK_IN'), header_config: { ...templateFixture().header_config, whatsapp: 'different' } }]]) {
    await expect(loadPaymentConfirmation('tx', transport({ templates }).client)).rejects.toThrow('identitas resmi aktif');
  }
  const reversed = [templateFixture('WALK_IN'), templateFixture()];
  expect((await loadPaymentConfirmation('tx', transport({ templates: reversed }).client)).business).toEqual(fixture().business);
  // A conflicting active header on the next page must not be silently ignored.
  const many = Array.from({ length: 101 }, (_, i) => ({ ...templateFixture(), id: String(i).padStart(3, '0') }));
  many[100]!.header_config = { ...many[100]!.header_config, address: 'conflicting address' };
  await expect(loadPaymentConfirmation('tx', transport({ templates: many }).client)).rejects.toThrow('tidak konsisten');
  await expect(loadPaymentConfirmation('tx', transport({ fail: 'receipt_template_versions' }).client)).rejects.toThrow('denied');
});

test('success/close/PDF have no check-in or receipt side effects, gate OFF, manual WhatsApp, loading/cancel', async () => {
  const data = buildPaymentConfirmation(fixture());
  const states: ConfirmationState[] = [];
  let saves = 0, prints = 0, chats = 0, resolveLoad: ((data: typeof data) => void) | undefined;
  const deps: ConfirmationDependencies = { changed: state => states.push(state), thermalEnabled: () => false,
    refreshCheckIn: async (id, number) => ({ id, transaction_number: number, status: 'check_in', started_at: 'actual', ends_at: 'end', scheduled_check_out: 'schedule' }),
    load: async () => data, download: async () => () => { saves++; }, print: async () => { prints++; },
    whatsapp: phone => { expect(phone).toBe('6281234567890'); chats++; } };
  const actions = createPaymentConfirmationActions(deps);
  await actions.captureCheckInSuccess({ transactionId: 'tx', transactionNumber: data.transactionNumber });
  expect(states.map(s => s.status)).toEqual(['loading', 'ready']);
  await expect(actions.openWhatsApp('tx')).rejects.toThrow('Unduh PDF dahulu');
  await expect(actions.print(data.transactionNumber)).rejects.toThrow('belum diaktifkan');
  await actions.download('tx'); await actions.openWhatsApp('tx');
  expect([saves, prints, chats]).toEqual([1, 0, 1]);
  data.guest.phone = 'invalid'; await actions.download('tx');
  await expect(actions.openWhatsApp('tx')).rejects.toThrow('belum valid');
  actions.clear(); expect(states.at(-1)?.status).toBe('closed');
  deps.load = () => new Promise(resolve => { resolveLoad = resolve; });
  const pending = actions.download('tx');
  await expect(actions.download('tx')).rejects.toThrow('sedang');
  actions.clear(); resolveLoad!(data);
  await expect(pending).rejects.toThrow('ditutup');
  deps.refreshCheckIn = async () => { throw new Error('refresh failed; do not retry check-in'); };
  await actions.captureCheckInSuccess({ transactionId: 'tx', transactionNumber: data.transactionNumber });
  expect(states.at(-1)).toMatchObject({ status: 'error', identity: { transactionId: 'tx' } });
});

test('download uses a local PDF Blob and filename, no print window or public upload', () => {
  const previousDocument = globalThis.document, previousCreate = URL.createObjectURL, previousRevoke = URL.revokeObjectURL;
  let clicked = false, removed = false, filename = '';
  URL.createObjectURL = (blob) => { expect(blob.type).toBe('application/pdf'); return 'blob:local'; };
  URL.revokeObjectURL = () => {};
  globalThis.document = { body: { appendChild: () => {} }, createElement: () => ({
    set href(value: string) { expect(value).toBe('blob:local'); }, set download(value: string) { filename = value; },
    click: () => { clicked = true; }, remove: () => { removed = true; },
  }) } as never;
  try { downloadConfirmationBytes(new Uint8Array([1, 2, 3]), 'TEST/NUMBER'); }
  finally { globalThis.document = previousDocument; URL.createObjectURL = previousCreate; URL.revokeObjectURL = previousRevoke; }
  expect([clicked, removed, filename]).toEqual([true, true, 'Payment-Confirmation-TEST_NUMBER.pdf']);
});

test('Booking integration adds headless success capture only, no new UI or second check-in path', () => {
  const source = readFileSync('src/routes/booking.tsx', 'utf8');
  expect(source.indexOf('if (checkInError)')).toBeLessThan(source.indexOf('void paymentConfirmation.captureCheckInSuccess'));
  expect(source.match(/captureCheckInSuccess\(/g)).toHaveLength(1);
  expect(source).toContain('transactionId: selectedBooking.id');
  expect(source).not.toContain('<PaymentConfirmation');
});
