function envTrue(value: unknown) {
  return value === 'true';
}

// Activation requires an explicit product flag, backend readiness, and Owner approval.
// Missing env values keep both proposal features disabled.
export const featureFlags = Object.freeze({
  extraGuest:
    envTrue(import.meta.env['VITE_FEATURE_EXTRA_GUEST']) &&
    envTrue(import.meta.env['VITE_FEATURE_EXTRA_GUEST_BACKEND_READY']) &&
    envTrue(import.meta.env['VITE_FEATURE_EXTRA_GUEST_OWNER_APPROVED']),
  receipt58mm:
    envTrue(import.meta.env['VITE_FEATURE_RECEIPT_58MM']) &&
    envTrue(import.meta.env['VITE_FEATURE_RECEIPT_BACKEND_READY']) &&
    envTrue(import.meta.env['VITE_FEATURE_RECEIPT_OWNER_APPROVED']),
});
