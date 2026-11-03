// Sakelar fitur. Default OFF: hanya nilai persis 'aktif' yang menyalakan fitur.
// Diaktifkan setelah backend terverifikasi dan disetujui Owner.
export function bacaSakelar(nilai: unknown): boolean {
  return nilai === 'aktif';
}

export const fitur = {
  extraGuest: bacaSakelar(import.meta.env.VITE_FITUR_EXTRA_GUEST),
  receipt58mm: bacaSakelar(import.meta.env.VITE_FITUR_RECEIPT),
} as const;
