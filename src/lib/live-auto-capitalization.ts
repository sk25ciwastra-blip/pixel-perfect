/**
 * Live capitalization for free-text fields throughout Baturaden 25 Homestay.
 *
 * Captures native input BEFORE React processes controlled onChange handlers.
 * Uses the prototype value setter to preserve React's value tracker and emits
 * no extra event. Does not modify the database, validation or submission flow.
 *
 * Never touch structured, potentially case-sensitive values (login, password,
 * WhatsApp, email, references, IDs, URLs, numbers, searches, WA templates).
 */
export type CapitalizeMode = 'sentence' | 'words';

const technicalFieldHints = /\b(?:email|e-mail|password|sandi|passcode|username|login|otp|pin|token|secret|api\s*key|kode|code|uuid|id\s*(?:transaksi|karyawan|booking)|nomor|number|nik|npwp|rekening\s*(?:no|number|nomor)|account\s*number|referensi|reference|bukti\s*transfer|url|link|website|domain|slug|ssid|wifi|qris|pencarian|cari|search|filter|template|variabel|barcode)\b/i;

function fieldHint(field: HTMLInputElement | HTMLTextAreaElement): string {
  const labelText = field.closest('label')?.textContent ?? '';
  return [
    field.id,
    field.name,
    field.placeholder,
    field.getAttribute('aria-label'),
    field.getAttribute('autocomplete'),
    labelText,
  ].filter(Boolean).join(' ').replace(/[_-]+/g, ' ');
}

export function capitalizeLiveText(value: string, mode: CapitalizeMode = 'sentence'): string {
  if (mode === 'words') {
    // Never trim or collapse spaces during typing: the user must be able to
    // enter the next word and move the cursor freely.
    return value
      .replace(/(^|[\s,./-])(\p{Ll})/gu, (_match, boundary: string, first: string) =>
        boundary + first.toLocaleUpperCase('id-ID'))
      .replace(/\b(Rt|Rw)\b/g, abbreviation => abbreviation.toUpperCase());
  }
  // Capitalize the first letter, including when whitespace precedes it.
  // Existing mixed-case text, codes, and later letters are not rewritten.
  return value.replace(/^(\s*)(\p{Ll})/u, (_match, spaces: string, first: string) =>
    spaces + first.toLocaleUpperCase('id-ID'));
}

export function capitalizeModeForField(
  field: HTMLInputElement | HTMLTextAreaElement,
): CapitalizeMode | null {
  if (field.disabled || field.readOnly) return null;

  const override = field.getAttribute('data-auto-capitalize')?.toLowerCase();
  if (override === 'off' || override === 'none' || override === 'false') return null;
  if (override === 'words' || override === 'sentence') return override;

  if (field instanceof HTMLInputElement && field.type !== 'text') return null;

  const inputMode = field.getAttribute('inputmode')?.toLowerCase();
  if (inputMode && ['numeric', 'decimal', 'tel', 'email', 'url', 'search', 'none'].includes(inputMode)) return null;

  const autoComplete = field.getAttribute('autocomplete')?.toLowerCase() ?? '';
  if (/(?:username|password|email|tel|one-time-code|cc-|url)/.test(autoComplete)) return null;

  const hint = fieldHint(field);
  if (technicalFieldHints.test(hint)) return null;
  if (/\b(?:alamat|address|street)\b/i.test(hint)) return 'words';
  return 'sentence';
}

/**
 * Capture input before React's bubbling input/onChange logic. On a controlled
 * input, using field.value = ... would update React's internal value tracker,
 * suppressing the onChange callback; the prototype setter avoids that.
 */
export function applyLiveAutoCapitalize(event: Event): void {
  const field = event.target;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
  if (event instanceof InputEvent && event.isComposing) return;

  const mode = capitalizeModeForField(field);
  if (!mode) return;

  const before = field.value;
  const after = capitalizeLiveText(before, mode);
  if (before === after) return;

  const start = field.selectionStart;
  const end = field.selectionEnd;
  const direction = field.selectionDirection;
  const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  if (!nativeSetter) return;

  nativeSetter.call(field, after);
  if (start !== null && end !== null) {
    // Handles Unicode uppercase expansions as well as ordinary one-character
    // substitutions without jumping to the end of the field.
    field.setSelectionRange(
      capitalizeLiveText(before.slice(0, start), mode).length,
      capitalizeLiveText(before.slice(0, end), mode).length,
      direction ?? 'none',
    );
  }
}

export function installLiveAutoCapitalization(doc: Document = document): () => void {
  doc.addEventListener('input', applyLiveAutoCapitalize, true);
  return () => doc.removeEventListener('input', applyLiveAutoCapitalize, true);
}
