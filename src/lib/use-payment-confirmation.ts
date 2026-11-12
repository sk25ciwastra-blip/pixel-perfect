import { useEffect, useMemo, useRef, useState } from 'react';
import { usePeran } from './peran';
import { featureFlags } from './feature-flags';
import { loadCheckInSuccess, loadPaymentConfirmation } from './payment-confirmation-data';
import { CLOSED_CONFIRMATION, createPaymentConfirmationActions, type ConfirmationState } from './payment-confirmation-actions';
import { reserveConfirmationWhatsAppWindow } from './payment-confirmation-whatsapp';
import { openReceiptPrintWindow, receiptPaymentIds, printReceiptBatch } from './receipt-print';
import { supabase } from '@/integrations/supabase/client';

/** Headless API for Booking success and Detail Transaksi; Stage B owns all buttons/dialogs. */
export function usePaymentConfirmation() {
  const [state, setState] = useState<ConfirmationState>(CLOSED_CONFIRMATION);
  const { siap, masuk, posisiKode } = usePeran();
  const active = useRef(false);
  active.current = siap && masuk && ['owner', 'supervisor', 'receptionist'].includes(posisiKode ?? '');
  const keys = useRef(new Map<string, string>());
  const printing = useRef(false);
  const actions = useMemo(() => createPaymentConfirmationActions({
    changed: setState,
    refreshCheckIn: (id, number) => loadCheckInSuccess(id, number, supabase),
    load: async (id) => {
      if (!active.current) throw new Error('Akses belum siap atau ditolak.');
      return loadPaymentConfirmation(id, supabase);
    },
    download: async (data) => {
      const { CONFIRMATION_LOGO, generatePaymentConfirmationPdf, downloadConfirmationBytes } = await import('./payment-confirmation-pdf');
      const response = await fetch(CONFIRMATION_LOGO, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Logo resmi PDF tidak tersedia.');
      const bytes = await generatePaymentConfirmationPdf(data, new Uint8Array(await response.arrayBuffer()));
      if (!active.current) throw new Error('Sesi berubah; unduhan dibatalkan.');
      return () => downloadConfirmationBytes(bytes, data.transactionNumber);
    },
    reserveWhatsApp: reserveConfirmationWhatsAppWindow,
    thermalEnabled: () => featureFlags.receipt58mm,
    print: async (number) => {
      if (!active.current) throw new Error('Akses belum siap atau ditolak.');
      if (printing.current) throw new Error('Cetak struk sedang diproses.');
      printing.current = true;
      let popup: Window | null = null;
      try {
        popup = openReceiptPrintWindow(); // Synchronous user gesture, existing engine/guards/copy semantics.
        const ids = await receiptPaymentIds(number);
        await printReceiptBatch(ids, popup, keys.current);
      } catch (error) {
        if (popup && !popup.closed) popup.close();
        throw error;
      } finally { printing.current = false; }
    },
  }), []);
  useEffect(() => {
    if (!siap || !masuk || !active.current) actions.clear();
    return () => { actions.clear(); keys.current.clear(); };
  }, [siap, masuk, posisiKode, actions]);
  return { state, ...actions, thermalAvailable: featureFlags.receipt58mm };
}
