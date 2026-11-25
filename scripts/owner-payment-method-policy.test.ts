import { describe, expect, test } from 'bun:test';
import {
  PAYMENT_METHODS, canTogglePaymentMethod, enabledPaymentMethods,
  reconcilePaymentSelection, toPaymentCode, validateOwnerPaymentPolicy,
} from '../src/lib/owner-payment-method-policy';

const all = validateOwnerPaymentPolicy({
  revision: 1, methods: { CASH: true, QRIS: true, TRANSFER: true },
});
const onlyCash = validateOwnerPaymentPolicy({
  revision: 5, methods: { CASH: true, QRIS: false, TRANSFER: false },
});
if (!all || !onlyCash) throw new Error('invalid fixture');

describe('Owner payment method policy', () => {
  test('canonical three methods and server values', () => {
    expect(PAYMENT_METHODS).toEqual(['Cash', 'QRIS', 'Transfer']);
    expect(PAYMENT_METHODS.map(toPaymentCode)).toEqual(['CASH', 'QRIS', 'TRANSFER']);
  });
  test('rejects missing or malformed policy rather than silently enabling payments', () => {
    for (const value of [null, undefined, {}, { revision: 1 },
      { revision: 0, methods: all.methods },
      { revision: 1, methods: { CASH: true, QRIS: true } },
      { revision: 1, methods: { CASH: true, QRIS: 'true', TRANSFER: true } },
      { revision: 1, methods: { CASH: false, QRIS: false, TRANSFER: false } },
      { revision: 1, methods: { CASH: true, QRIS: true, TRANSFER: true, OTHER: true } },
    ]) expect(validateOwnerPaymentPolicy(value)).toBeNull();
    expect(enabledPaymentMethods(null)).toEqual([]);
  });
  test('enables only server-approved methods', () => {
    expect(enabledPaymentMethods(all)).toEqual(['Cash','QRIS','Transfer']);
    expect(enabledPaymentMethods(onlyCash)).toEqual(['Cash']);
  });
  test('does not quietly substitute an inactive payment method or carry its amount', () => {
    expect(reconcilePaymentSelection(['QRIS'], onlyCash, false)).toEqual({
      selected: [], removed: ['QRIS'], requiresReview: true, reason: 'method-disabled',
    });
    expect(reconcilePaymentSelection(['Cash','QRIS'], onlyCash, true)).toEqual({
      selected: ['Cash'], removed: ['QRIS'], requiresReview: true, reason: 'method-disabled',
    });
    expect(reconcilePaymentSelection(['Cash'], onlyCash, false)).toEqual({
      selected: ['Cash'], removed: [], requiresReview: false, reason: 'ok',
    });
  });
  test('combined keeps at most two; cannot bypass inactive method', () => {
    expect(reconcilePaymentSelection(['Cash','QRIS','Transfer'], all, true).selected).toEqual(['Cash','QRIS']);
    expect(reconcilePaymentSelection(['Cash','Cash'], all, true).requiresReview).toBe(true);
    expect(reconcilePaymentSelection(['QRIS'], null, true).reason).toBe('config-unavailable');
    expect(reconcilePaymentSelection([], all, false).reason).toBe('no-selection');
  });
  test('cannot disable last active payment method', () => {
    const blocked = canTogglePaymentMethod(onlyCash,'Cash',false);
    expect(blocked.ok).toBe(false);
    const ok = canTogglePaymentMethod(all,'Transfer',false);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.next.methods.TRANSFER).toBe(false);
      expect(ok.next.revision).toBe(2);
    }
  });
  test('idempotent unchanged toggle and failed policy', () => {
    const result = canTogglePaymentMethod(all,'QRIS',true);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.next).toBe(all);
    expect(canTogglePaymentMethod(null,'QRIS',false).ok).toBe(false);
  });
});
