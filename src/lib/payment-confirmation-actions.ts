import type { PaymentConfirmation } from './payment-confirmation';
import { normalizeWhatsAppNumber } from './whatsapp';

export type CheckInIdentity = { transactionId: string; transactionNumber: string };
export type RefreshedCheckIn = { id: string; transaction_number: string; started_at: string | null;
  ends_at: string | null; scheduled_check_out: string | null; status: string };
export type ConfirmationState = {
  identity: CheckInIdentity | null;
  status: 'closed' | 'loading' | 'ready' | 'error';
  checkIn: RefreshedCheckIn | null;
  error: string;
};
export const CLOSED_CONFIRMATION: ConfirmationState = { identity: null, status: 'closed', checkIn: null, error: '' };
export type ConfirmationDependencies = {
  refreshCheckIn: (id: string, number: string) => Promise<RefreshedCheckIn>;
  load: (id: string) => Promise<PaymentConfirmation>;
  download: (data: PaymentConfirmation) => Promise<() => void>;
  whatsapp: (phone: string) => void;
  print: (number: string) => Promise<void>;
  thermalEnabled: () => boolean;
  changed: (state: ConfirmationState) => void;
};

/** No check-in/payment/receipt creation on success capture, close, PDF or WhatsApp. */
export function createPaymentConfirmationActions(deps: ConfirmationDependencies) {
  let generation = 0;
  let downloaded: { id: string; phone: string | null } | null = null;
  let busy = false;
  function clear() {
    generation++;
    downloaded = null;
    deps.changed(CLOSED_CONFIRMATION);
  }
  async function captureCheckInSuccess(identity: CheckInIdentity) {
    const current = ++generation;
    downloaded = null;
    deps.changed({ identity, status: 'loading', checkIn: null, error: '' });
    try {
      const checkIn = await deps.refreshCheckIn(identity.transactionId, identity.transactionNumber);
      if (checkIn.id !== identity.transactionId || checkIn.transaction_number !== identity.transactionNumber || checkIn.status !== 'check_in') {
        throw new Error('Hasil refresh Check-in tidak cocok; jangan ulang Check-in.');
      }
      if (generation === current) deps.changed({ identity, status: 'ready', checkIn, error: '' });
    } catch (error) {
      if (generation === current) deps.changed({ identity, status: 'error', checkIn: null,
        error: error instanceof Error ? error.message : 'Check-in berhasil; hasil refresh belum tersedia. Jangan ulang Check-in.' });
    }
  }
  async function download(transactionId: string) {
    if (busy) throw new Error('Dokumen sedang disiapkan.');
    const current = generation;
    busy = true;
    downloaded = null;
    try {
      const data = await deps.load(transactionId);
      if (data.transactionId !== transactionId) throw new Error('Dokumen transaksi tidak cocok.');
      if (generation !== current) throw new Error('Permintaan dokumen sudah ditutup.');
      const save = await deps.download(data);
      if (generation !== current) throw new Error('Permintaan dokumen sudah ditutup.');
      save();
      if (generation === current) downloaded = { id: transactionId, phone: data.guest.phone };
      return data;
    } finally { busy = false; }
  }
  async function openWhatsApp(transactionId: string) {
    if (downloaded?.id !== transactionId) throw new Error('Unduh PDF dahulu, lalu lampirkan manual di WhatsApp.');
    const current = generation;
    const data = await deps.load(transactionId); // Fresh auth/permission check; never trust cached PII after logout.
    if (generation !== current || downloaded?.id !== transactionId || data.guest.phone !== downloaded.phone) {
      throw new Error('Data atau sesi berubah; unduh PDF kembali.');
    }
    const phone = normalizeWhatsAppNumber(data.guest.phone ?? '');
    if (!/^62\d{8,13}$/.test(phone)) throw new Error('Nomor WhatsApp tamu belum valid atau akses tidak tersedia.');
    deps.whatsapp(phone); // Opens chat only. No file attachment or sent claim.
  }
  async function print(transactionNumber: string) {
    if (!deps.thermalEnabled()) throw new Error('Cetak struk 58mm belum diaktifkan.');
    return deps.print(transactionNumber);
  }
  return { captureCheckInSuccess, download, openWhatsApp, print, clear };
}
