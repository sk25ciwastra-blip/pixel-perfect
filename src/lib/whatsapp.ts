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

export function openWhatsApp(phone: string, message?: string) {
  const number = normalizeWhatsAppNumber(phone);

  if (!number) return;

  const text = message ? `?text=${encodeURIComponent(message)}` : '';

 window.open(
  `https://web.whatsapp.com/send?phone=${number}${text ? `&${text.slice(1)}` : ''}`,
  '_blank',
  'noopener,noreferrer',
);
}