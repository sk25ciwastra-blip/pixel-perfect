/**
 * Only guest-entry formatting. Do not alter the app-wide WhatsApp delivery
 * normalizer: stored 08 and +62 prefixes are intentionally preserved.
 */
export function formatGuestName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleUpperCase('id-ID');
}

export function formatGuestAddress(value: string): string {
  const titleCase = value.replace(/\s+/g, ' ').trim()
    .toLocaleLowerCase('id-ID')
    .replace(/(^|[\s,./-])(\p{L})/gu, (_full, prefix: string, first: string) =>
      prefix + first.toLocaleUpperCase('id-ID'));
  // Preserve familiar Indonesian address abbreviations.
  return titleCase.replace(/\b(Rt|Rw)\b/g, word => word.toUpperCase());
}

export function formatGuestWhatsAppInput(value: string): string {
  // Remove common copy/paste separators; do not silently remove letters,
  // interior '+' signs, or other invalid characters.
  const compact = value.trim().replace(/[\s().-]+/g, '');
  if (/^62\d*$/.test(compact)) return `+${compact}`;
  return compact;
}

export function guestWhatsAppCanonical(value: string): string {
  const formatted = formatGuestWhatsAppInput(value);
  const digits = formatted.replace(/\D/g, '');
  return digits.startsWith('62') ? `0${digits.slice(2)}` : digits;
}

export function isValidGuestWhatsApp(value: string): boolean {
  const formatted = formatGuestWhatsAppInput(value);
  return /^0[1-9]\d{7,13}$/.test(formatted) || /^\+62[1-9]\d{7,12}$/.test(formatted);
}
