import { featureGateOn } from '@/lib/feature-flags';

// Sakelar fitur. Default OFF: hanya nilai persis 'aktif' yang menyalakan fitur.
// Diaktifkan setelah backend terverifikasi dan disetujui Owner.
export function bacaSakelar(nilai: unknown): boolean {
  return nilai === 'aktif';
}

export const fitur = {
  combinedPayment: featureGateOn(
    import.meta.env?.['VITE_FEATURE_COMBINED_PAYMENT'],
    import.meta.env?.['VITE_FEATURE_COMBINED_PAYMENT_BACKEND_READY'],
    import.meta.env?.['VITE_FEATURE_COMBINED_PAYMENT_OWNER_APPROVED'],
  ),
  extraGuest: bacaSakelar(import.meta.env?.['VITE_FITUR_EXTRA_GUEST']),
  receipt58mm: bacaSakelar(import.meta.env?.['VITE_FITUR_RECEIPT']),
} as const;
