function envTrue(value: unknown) {
  return value === 'true';
}

export function featureGateOn(...values: unknown[]) {
  return values.length > 0 && values.every(envTrue);
}

// Activation requires an explicit product flag, backend readiness, and Owner approval.
// Missing env values keep both proposal features disabled.
export const featureFlags = Object.freeze({
  combinedPayment: featureGateOn(
    import.meta.env['VITE_FEATURE_COMBINED_PAYMENT'],
    import.meta.env['VITE_FEATURE_COMBINED_PAYMENT_BACKEND_READY'],
    import.meta.env['VITE_FEATURE_COMBINED_PAYMENT_OWNER_APPROVED'],
  ),
  extraGuest: featureGateOn(
    import.meta.env['VITE_FEATURE_EXTRA_GUEST'],
    import.meta.env['VITE_FEATURE_EXTRA_GUEST_BACKEND_READY'],
    import.meta.env['VITE_FEATURE_EXTRA_GUEST_OWNER_APPROVED'],
  ),
  receipt58mm: featureGateOn(
    import.meta.env['VITE_FEATURE_RECEIPT_58MM'],
    import.meta.env['VITE_FEATURE_RECEIPT_BACKEND_READY'],
    import.meta.env['VITE_FEATURE_RECEIPT_OWNER_APPROVED'],
  ),
});
