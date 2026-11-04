import { featureFlags } from '@/lib/feature-flags';

// Compatibility shim for historical Lovable imports. Never bypass the
// feature + backend-ready + Owner-approved activation requirements.
export function bacaSakelar(nilai: unknown): boolean {
  return nilai === 'aktif';
}

export const fitur = Object.freeze({
  combinedPayment: featureFlags.combinedPayment,
  extraGuest: featureFlags.extraGuest,
  receipt58mm: featureFlags.receipt58mm,
});
