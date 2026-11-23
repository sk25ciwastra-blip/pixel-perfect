export function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, '');

  if (!digits) return '';

  if (digits.startsWith('62')) {
    return digits;
  }

  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }

  return digits;
}

export function whatsAppDraftUrl(phone: string, message?: string) {
  const number = normalizeWhatsAppNumber(phone);
  if (!number) return undefined;
  const text = message ? `&text=${encodeURIComponent(message)}` : '';
  return `https://web.whatsapp.com/send?phone=${number}${text}`;
}

export function openWhatsApp(phone: string, message?: string) {
  const url = whatsAppDraftUrl(phone, message);
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}
