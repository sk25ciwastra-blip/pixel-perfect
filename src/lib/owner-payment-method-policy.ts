/**
 * Owner payment-method policy contract — pure logic only.
 *
 * This module deliberately does NOT activate per-method toggles in production.
 * A separate Owner-approved server migration must enforce enabled methods in
 * every payment-writing RPC before the frontend can consume the policy.
 */
export const PAYMENT_METHODS = ['Cash', 'QRIS', 'Transfer'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
export type PaymentMethodCode = 'CASH' | 'QRIS' | 'TRANSFER';
export type OwnerPaymentMethodPolicy = Readonly<{
  /** Monotonically increasing server-side revision; checked for stale writes. */
  revision: number;
  methods: Readonly<Record<PaymentMethodCode, boolean>>;
}>;

const CODE: Record<PaymentMethod, PaymentMethodCode> = {
  Cash: 'CASH',
  QRIS: 'QRIS',
  Transfer: 'TRANSFER',
};
const ALL_CODES: readonly PaymentMethodCode[] = ['CASH', 'QRIS', 'TRANSFER'];

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === 'Cash' || value === 'QRIS' || value === 'Transfer';
}
export function toPaymentCode(method: PaymentMethod): PaymentMethodCode {
  return CODE[method];
}

/**
 * Fails closed when Owner configuration is expected but absent or malformed.
 * Legacy deployments MUST pass the historical policy explicitly, not
 * accidentally assume everything is enabled after a failed server read.
 */
export function validateOwnerPaymentPolicy(value: unknown): OwnerPaymentMethodPolicy | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (!Number.isSafeInteger(input['revision']) || Number(input['revision']) < 1) return null;
  const methods = input['methods'];
  if (!methods || typeof methods !== 'object' || Array.isArray(methods)) return null;
  const flags = methods as Record<string, unknown>;
  if (Object.keys(flags).length !== ALL_CODES.length
    || ALL_CODES.some(code => typeof flags[code] !== 'boolean')) return null;
  if (!ALL_CODES.some(code => flags[code])) return null;
  return {
    revision: Number(input['revision']),
    methods: {
      CASH: flags['CASH'] as boolean,
      QRIS: flags['QRIS'] as boolean,
      TRANSFER: flags['TRANSFER'] as boolean,
    },
  };
}

export function enabledPaymentMethods(policy: OwnerPaymentMethodPolicy | null): PaymentMethod[] {
  if (!policy) return [];
  return PAYMENT_METHODS.filter(method => policy.methods[CODE[method]]);
}

export type ReconciledPaymentSelection = Readonly<{
  selected: PaymentMethod[];
  /** Previously selected methods no longer supported by this policy. */
  removed: PaymentMethod[];
  /** User must confirm or choose a method before creating any new payment. */
  requiresReview: boolean;
  reason: 'config-unavailable' | 'method-disabled' | 'no-selection' | 'ok';
}>;

/**
 * Do NOT silently replace a disabled method with another or transfer amounts
 * and idempotency keys. A new manual selection is required.
 */
export function reconcilePaymentSelection(
  current: readonly PaymentMethod[],
  policy: OwnerPaymentMethodPolicy | null,
  combinedEnabled: boolean,
): ReconciledPaymentSelection {
  if (!policy) return {
    selected: [], removed: [...current],
    requiresReview: true, reason: 'config-unavailable',
  };
  const available = new Set(enabledPaymentMethods(policy));
  const seen = new Set<PaymentMethod>();
  const selected: PaymentMethod[] = [];
  const removed: PaymentMethod[] = [];
  for (const method of current) {
    if (!available.has(method) || seen.has(method) || selected.length >= (combinedEnabled ? 2 : 1)) {
      removed.push(method);
    } else {
      selected.push(method);
      seen.add(method);
    }
  }
  const reason = removed.length ? 'method-disabled' : selected.length === 0 ? 'no-selection' : 'ok';
  return { selected, removed, requiresReview: reason !== 'ok', reason };
}

/** Refuse mutation that would remove the final available payment method. */
export function canTogglePaymentMethod(
  policy: OwnerPaymentMethodPolicy | null,
  method: PaymentMethod,
  nextEnabled: boolean,
): { ok: true; next: OwnerPaymentMethodPolicy } | { ok: false; reason: string } {
  if (!policy) return { ok: false, reason: 'Konfigurasi pembayaran belum terverifikasi.' };
  if (policy.methods[CODE[method]] === nextEnabled) return { ok: true, next: policy };
  const next = validateOwnerPaymentPolicy({
    revision: policy.revision + 1,
    methods: { ...policy.methods, [CODE[method]]: nextEnabled },
  });
  if (!next) return { ok: false, reason: 'Minimal satu metode pembayaran harus tetap aktif.' };
  return { ok: true, next };
}
