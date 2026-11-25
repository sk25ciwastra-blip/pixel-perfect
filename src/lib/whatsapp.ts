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

/** Open a specific guest chat via the official click-to-chat endpoint.
 * Keep the existing web.whatsapp.com helper unchanged for other workflows.
 */
export function whatsAppReservationRecipient(phone: string): string | undefined {
  if (!/^\+?[\d\s().-]+$/.test(phone.trim())) return undefined;
  let number = normalizeWhatsAppNumber(phone);
  // Some historical guest records omit the Indonesian country prefix.
  if (/^8[1-9]\d{7,12}$/.test(number)) number = `62${number}`;
  return /^62[1-9]\d{7,12}$/.test(number) ? number : undefined;
}

export function whatsAppReservationChatUrl(phone: string, message?: string) {
  const number = whatsAppReservationRecipient(phone);
  if (!number) return undefined;
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

/** Desktop fallback: bypass wa.me → api.whatsapp.com redirect and enter WhatsApp Web directly. */
export function whatsAppReservationWebUrl(phone: string, message?: string) {
  const number = whatsAppReservationRecipient(phone);
  if (!number) return undefined;
  return `https://web.whatsapp.com/send?phone=${number}${message ? `&text=${encodeURIComponent(message)}` : ''}`;
}
