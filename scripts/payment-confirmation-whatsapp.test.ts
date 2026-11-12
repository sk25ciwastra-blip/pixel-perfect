import { test, expect } from 'bun:test';
import { createPaymentConfirmationActions, type ConfirmationDependencies } from '../src/lib/payment-confirmation-actions';
import type { PaymentConfirmation } from '../src/lib/payment-confirmation';
import { reserveConfirmationWhatsAppWindow } from '../src/lib/payment-confirmation-whatsapp';

// Only fields read by these actions; no SDK, Cloud, operational transaction or PDF renderer.
const document = (id = 'fixture', phone: string | null = '081234567890') =>
  ({ transactionId: id, guest: { phone } }) as PaymentConfirmation;
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup() {
  const events: string[] = [];
  let closed = false;
  const deps: ConfirmationDependencies = {
    changed: () => {}, thermalEnabled: () => false, print: async () => {},
    refreshCheckIn: async () => { throw new Error('not used'); },
    load: async () => document(), download: async () => () => { events.push('saved'); },
    reserveWhatsApp: () => {
      events.push('reserved');
      return { close: () => { closed = true; events.push('closed'); }, navigate: phone => {
        if (closed) throw new Error('tab closed');
        events.push(`navigate:${phone}`);
      } };
    },
  };
  const actions = createPaymentConfirmationActions(deps);
  return { actions, deps, events, closeTab: () => { closed = true; } };
}

test('WA requires successful PDF download for the same transaction before reserving a tab', async () => {
  const { actions, deps, events } = setup();
  await expect(actions.openWhatsApp('fixture')).rejects.toThrow('Unduh PDF dahulu');
  expect(events).toEqual([]);
  await actions.download('fixture');
  await expect(actions.openWhatsApp('other')).rejects.toThrow('Unduh PDF dahulu');
  expect(events).toEqual(['saved']);
  deps.download = async () => { throw new Error('save failed'); };
  await expect(actions.download('fixture')).rejects.toThrow('save failed');
  await expect(actions.openWhatsApp('fixture')).rejects.toThrow('Unduh PDF dahulu');
  expect(events).toEqual(['saved']);
});

test('reserves synchronously before fresh access read and navigates only after it succeeds', async () => {
  const { actions, deps, events } = setup();
  await actions.download('fixture');
  const read = deferred<PaymentConfirmation>();
  deps.load = () => { events.push('fresh read'); return read.promise; };
  const pending = actions.openWhatsApp('fixture');
  expect(events).toEqual(['saved', 'reserved', 'fresh read']); // Before yielding even a microtask.
  await expect(actions.openWhatsApp('fixture')).rejects.toThrow('sedang');
  await expect(actions.download('fixture')).rejects.toThrow('sedang');
  read.resolve(document());
  await pending;
  expect(events).toEqual(['saved', 'reserved', 'fresh read', 'navigate:6281234567890']);
});

test('blocked popup reports failure before reading private data; a new click can retry', async () => {
  const { actions, deps, events } = setup();
  await actions.download('fixture');
  const reserve = deps.reserveWhatsApp;
  deps.reserveWhatsApp = () => { throw new Error('popup blocked'); };
  deps.load = async () => { events.push('fresh read'); return document(); };
  await expect(actions.openWhatsApp('fixture')).rejects.toThrow('popup blocked');
  expect(events).toEqual(['saved']);
  deps.reserveWhatsApp = reserve;
  await actions.openWhatsApp('fixture');
  expect(events).toEqual(['saved', 'reserved', 'fresh read', 'navigate:6281234567890']);
});

test('denied access, mismatched transaction or changed/invalid/missing phone close without navigation', async () => {
  for (const result of ['denied', 'wrong transaction', 'changed phone', 'invalid phone', 'missing phone']) {
    const { actions, deps, events } = setup();
    // Invalid stored phones may still appear on a PDF; WA must reject them.
    const phone = result === 'invalid phone' ? 'invalid' : result === 'missing phone' ? null : '081234567890';
    deps.load = async () => document('fixture', phone);
    await actions.download('fixture');
    deps.load = async () => {
      if (result === 'denied') throw new Error('access denied');
      return document(result === 'wrong transaction' ? 'other' : 'fixture', result === 'changed phone' ? '089999999999' : phone);
    };
    await expect(actions.openWhatsApp('fixture')).rejects.toThrow();
    expect(events).toEqual(['saved', 'reserved', 'closed']);
  }
});

test('clear/logout and new check-in close pending blank tab immediately and prevent late navigation', async () => {
  for (const cancel of ['clear', 'capture']) {
    const { actions, deps, events } = setup();
    await actions.download('fixture');
    const read = deferred<PaymentConfirmation>();
    deps.load = () => read.promise;
    const pending = actions.openWhatsApp('fixture');
    if (cancel === 'clear') actions.clear();
    else await actions.captureCheckInSuccess({ transactionId: 'other', transactionNumber: 'fixture-number' });
    expect(events).toContain('closed');
    read.resolve(document());
    await expect(pending).rejects.toThrow('berubah');
    expect(events.some(event => event.startsWith('navigate:'))).toBe(false);
  }
});

test('manually closed placeholder never opens a replacement tab after asynchronous validation', async () => {
  const { actions, deps, events, closeTab } = setup();
  await actions.download('fixture');
  const read = deferred<PaymentConfirmation>();
  deps.load = () => read.promise;
  const pending = actions.openWhatsApp('fixture');
  closeTab(); read.resolve(document());
  await expect(pending).rejects.toThrow('tab closed');
  expect(events).toEqual(['saved', 'reserved', 'closed']);
});

test('browser adapter opens a neutral blank tab, severs opener, suppresses referrer and navigates fixed chat URL only', () => {
  const original = globalThis.window;
  const opened: unknown[][] = [], urls: string[] = [], metadata: unknown[] = [];
  const popup = { closed: false, opener: {} as unknown, close() { this.closed = true; },
    document: { title: '', body: { textContent: '' }, createElement: () => ({ name: '', content: '' }),
      head: { appendChild: (meta: unknown) => metadata.push(meta) } },
    location: { replace: (url: string) => urls.push(url) } };
  globalThis.window = { open: (...args: unknown[]) => { opened.push(args); return popup; } } as never;
  try {
    const tab = reserveConfirmationWhatsAppWindow();
    expect(opened).toEqual([['about:blank', '_blank']]);
    expect(popup.opener).toBeNull();
    expect(metadata).toEqual([{ name: 'referrer', content: 'no-referrer' }]);
    expect(popup.document.body.textContent).not.toContain('081234567890');
    expect(urls).toEqual([]);
    expect(() => tab.navigate('javascript:alert(1)')).toThrow('valid');
    tab.navigate('6281234567890');
    expect(urls).toEqual(['https://web.whatsapp.com/send?phone=6281234567890']);
    tab.close();
    expect(() => tab.navigate('6281234567890')).toThrow('ditutup');
    expect(opened).toHaveLength(1);
    globalThis.window.open = (() => null) as never;
    expect(() => reserveConfirmationWhatsAppWindow()).toThrow('diblokir');
  } finally { globalThis.window = original; }
});
