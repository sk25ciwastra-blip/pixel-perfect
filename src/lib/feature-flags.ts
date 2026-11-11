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

// Preview-only gate: production/custom hosts always stay OFF even if env flags ship in the bundle.
export function isPreviewHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1') return true;
  if (h.endsWith('.lovableproject.com') || h.endsWith('.lovableproject-dev.com')) return true;
  if (/^project--[0-9a-f-]{36}-dev\.lovable\.app$/.test(h)) return true;
  const [first, ...rest] = h.split('.');
  const suffix = '.' + rest.join('.');
  const okSuffix = ['.lovable.app', '.gpt-eng.com', '.gptengineer.run'].some(s => suffix.endsWith(s));
  return okSuffix && /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(first ?? '');
}

export function extraGuestAktif(
  hostname: string,
  flagOn: boolean = featureFlags.extraGuest,
  approvedHosts: string = import.meta.env['VITE_FEATURE_EXTRA_GUEST_APPROVED_HOSTS'] ?? '',
): boolean {
  // Production stays OFF unless the Owner explicitly approves the exact hostname
  // as well as all three existing feature gates. No wildcard/subdomain matching.
  const host = hostname.toLowerCase();
  const approved = approvedHosts.split(',').some((entry) => {
    const candidate = entry.trim().toLowerCase();
    const validHostname = candidate.length <= 253 && candidate.split('.').every(
      (label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
    );
    return validHostname && candidate === host;
  });
  return flagOn && (isPreviewHost(host) || approved);
}
