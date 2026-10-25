import type { PosisiAkses } from './peran';
import { normalizeWhatsAppNumber } from './whatsapp';

// Preserve the transaction list's existing check-in permission at its new location.
export function bolehCheckIn(posisi: PosisiAkses) {
  return ['owner', 'supervisor', 'receptionist'].includes(posisi ?? '');
}

export function bolehHubungiTamu(posisi: PosisiAkses, phone: string | null | undefined) {
  return bolehCheckIn(posisi) && /^62\d{8,13}$/.test(normalizeWhatsAppNumber(phone ?? ''));
}