/**
 * Poin 4/7 — pure, side-effect-free WhatsApp template validation and rendering.
 * Nothing in this module grants database permissions or sends a message.
 */
export const WHATSAPP_TEMPLATE_FIELDS = {
  PENAWARAN_RESERVASI: [
    'NAMA_TAMU', 'TIPE_KAMAR', 'NOMOR_KAMAR', 'PAKET', 'CHECKIN_WIB',
    'CHECKOUT_WIB', 'JUMLAH_TAMU', 'HARGA_KAMAR', 'BIAYA_TAMBAHAN',
    'TOTAL_TAGIHAN', 'DP_MINIMUM', 'DP_PERSEN',
  ],
  KONFIRMASI_BOOKING: [
    'NAMA_TAMU', 'NOMOR_TRANSAKSI', 'TIPE_KAMAR', 'NOMOR_KAMAR', 'PAKET',
    'CHECKIN_WIB', 'CHECKOUT_WIB', 'JUMLAH_TAMU', 'TOTAL_TAGIHAN',
    'DP_DITERIMA', 'SISA_TAGIHAN', 'STATUS_PEMBAYARAN',
  ],
  // Legacy confirmation is retained for safe reading of historical drafts,
  // but no longer displayed among the four Owner-approved template kinds.
  KONFIRMASI_PEMBAYARAN: [
    'NAMA_TAMU', 'NOMOR_TRANSAKSI', 'TOTAL_TAGIHAN',
    'TOTAL_DIBAYAR_BERSIH', 'SISA_TAGIHAN', 'STATUS_PEMBAYARAN',
  ],
  PENGINGAT_BOOKING_30_MENIT: [
    'NAMA_TAMU', 'NOMOR_TRANSAKSI', 'TIPE_KAMAR', 'NOMOR_KAMAR',
    'CHECKIN_WIB',
  ],
  PENGINGAT_WAKTU_HABIS: [
    'NAMA_TAMU', 'NOMOR_TRANSAKSI', 'NOMOR_KAMAR', 'BATAS_CHECKOUT_WIB',
  ],
} as const;

export type WhatsAppTemplateKind = keyof typeof WHATSAPP_TEMPLATE_FIELDS;
export type WhatsAppTemplateValues = Record<string, string | number | null | undefined>;
const MAX_TEMPLATE_LENGTH = 4000;
const MAX_VALUE_LENGTH = 300;
const TOKEN = /\[([A-Z][A-Z0-9_]*)\]/g;
const FORBIDDEN_CONTROLS = /[\u0000-\u0008\u000B-\u000D\u000E-\u001F\u007F]/;
const forbiddenValue = /[\r\n\u2028\u2029\u0000-\u001F\u007F]/;

export function validateWhatsAppTemplate(kind: WhatsAppTemplateKind, template: string): string[] {
  const errors: string[] = [];
  if (typeof template !== 'string' || !template.trim() || template.length > MAX_TEMPLATE_LENGTH) {
    return ['Template harus diisi dan maksimum 4000 karakter.'];
  }
  if (FORBIDDEN_CONTROLS.test(template)) errors.push('Template mengandung karakter kontrol yang tidak diizinkan.');
  const allowed = new Set<string>(WHATSAPP_TEMPLATE_FIELDS[kind]);
  const tokens = [...template.matchAll(TOKEN)].map(match => match[1]!);
  for (const token of new Set(tokens)) {
    if (!allowed.has(token)) errors.push(`Variabel [${token}] tidak tersedia untuk ${kind}.`);
  }
  // Reject malformed/unknown bracket syntax rather than shipping literal tokens to customers.
  const remaining = template.replace(TOKEN, '');
  if (remaining.includes('[') || remaining.includes(']')) {
    errors.push('Format variabel harus [NAMA_VARIABEL] dan terdaftar.');
  }
  if (!tokens.length) errors.push('Template wajib memuat minimal satu variabel resmi.');
  return errors;
}

export function renderWhatsAppTemplate(
  kind: WhatsAppTemplateKind, template: string, values: WhatsAppTemplateValues,
): string {
  const errors = validateWhatsAppTemplate(kind, template);
  if (errors.length) throw new Error(errors.join(' '));
  // All values must come from the authenticated, validated business-data builder, not user claims.
  return template.replace(TOKEN, (_token, key: string) => {
    const value = values[key];
    if (value === null || value === undefined || String(value).trim() === '') {
      throw new Error(`Data [${key}] belum tersedia. Pesan tidak dapat dibuat.`);
    }
    const rendered = String(value).trim();
    if (rendered.length > MAX_VALUE_LENGTH || forbiddenValue.test(rendered)) {
      throw new Error(`Data [${key}] tidak valid untuk pesan WhatsApp.`);
    }
    return rendered;
  });
}
