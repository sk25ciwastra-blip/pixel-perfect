import { useRef, useState } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { featureFlags } from '@/lib/feature-flags';
import { openReceiptPrintWindow, printReceiptBatch, receiptPaymentIds } from '@/lib/receipt-print';

function ReceiptAction({ paymentIds, transactionNumber, label }: {
  paymentIds?: string[];
  transactionNumber?: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const keys = useRef(new Map<string, string>());
  const inFlight = useRef(false);
  if (!featureFlags.receipt58mm) return null;

  async function print() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    let popup: Window | null = null;
    try {
      // Keep this synchronous with the click, before any lookup or RPC.
      popup = openReceiptPrintWindow();
      const ids = transactionNumber ? await receiptPaymentIds(transactionNumber) : paymentIds ?? [];
      await printReceiptBatch(ids, popup, keys.current);
    } catch (failure) {
      if (popup && !popup.closed) popup.close();
      setError(failure instanceof Error ? failure.message : 'Struk gagal disiapkan.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <span className="inline-flex flex-wrap items-center gap-2">
    <Button type="button" variant="outline" size="sm" disabled={busy || (!transactionNumber && !paymentIds?.length)} onClick={() => void print()}>
      <Printer className="size-4" />{busy ? 'Menyiapkan…' : label}
    </Button>
    {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
  </span>;
}

export function ReceiptTransactionButton({ transactionNumber }: { transactionNumber: string }) {
  return <ReceiptAction transactionNumber={transactionNumber} label="Cetak Struk" />;
}

export function ReceiptPrintButton({ paymentId }: { paymentId: string }) {
  return <ReceiptAction paymentIds={[paymentId]} label="Cetak Struk" />;
}

export function ReceiptHistoryButton({ transactionNumber }: { transactionNumber: string }) {
  return <ReceiptAction transactionNumber={transactionNumber} label="Cetak Riwayat" />;
}
