import { normalizeWhatsAppNumber } from '@/lib/whatsapp';

export type GuestSearchRow = { id: string; full_name: string; phone: string; address: string };
export type GuestSearchField = 'name' | 'phone';

export function findSameGuest(guests: GuestSearchRow[], phone: string) {
  const normalized = normalizeWhatsAppNumber(phone);
  if (normalized.length < 8) return undefined;
  return guests.find(guest => normalizeWhatsAppNumber(guest.phone) === normalized);
}

export function suggestGuests(guests: GuestSearchRow[], field: GuestSearchField | null, name: string, phone: string) {
  if (field === 'name') {
    const term = name.trim().toLocaleLowerCase('id-ID');
    return term.length < 2 ? [] : guests.filter(guest => guest.full_name.toLocaleLowerCase('id-ID').includes(term)).slice(0, 6);
  }
  if (field === 'phone') {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 3) return [];
    return guests.filter(guest => {
      const canonical = normalizeWhatsAppNumber(guest.phone);
      const local = canonical.startsWith('62') ? '0' + canonical.slice(2) : canonical;
      return canonical.includes(digits) || local.includes(digits);
    }).slice(0, 6);
  }
  return [];
}
