import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  openReceiptPrintPreview,
  openReceiptPrintWindow,
  prepareReceiptPrint,
  type ReceiptPrintData,
} from "@/lib/receipt-print";
import { rpc } from "@/lib/data-live";

export function ReceiptPrintButton({
  paymentId,
  label = "Print Receipt",
}: {
  paymentId: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function print() {
    setBusy(true);
    setError("");
    let popup: Window | null = null;
    try {
      popup = openReceiptPrintWindow();
      const receipt = await prepareReceiptPrint(paymentId);
      openReceiptPrintPreview([receipt], popup);
      // The audit status means the print dialog was opened, not physically printed.
      const result = await rpc("record_receipt_print_result", {
        _print_request_id: receipt.print_request_id,
        _status: "PRINT_DIALOG_OPENED",
      });
      if (result.error) throw new Error(result.error.message);
    } catch (failure) {
      if (popup && !popup.closed) popup.close();
      setError(failure instanceof Error ? failure.message : "Receipt print failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void print()}
      >
        {busy ? "Menyiapkan…" : label}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}

export function ReceiptHistoryButton({ paymentIds }: { paymentIds: string[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function printHistory() {
    setBusy(true);
    setError("");
    let popup: Window | null = null;
    try {
      popup = openReceiptPrintWindow();
      const receipts: ReceiptPrintData[] = [];
      for (const paymentId of paymentIds) receipts.push(await prepareReceiptPrint(paymentId));
      openReceiptPrintPreview(receipts, popup);
      // Each payment retains its own copy sequence. Dialog opened != print completed.
      const printResults = await Promise.all(
        receipts.map((receipt) =>
          rpc("record_receipt_print_result", {
            _print_request_id: receipt.print_request_id,
            _status: "PRINT_DIALOG_OPENED",
          }),
        ),
      );
      const printError = printResults.find((result) => result.error);
      if (printError?.error) throw new Error(printError.error.message);
    } catch (failure) {
      if (popup && !popup.closed) popup.close();
      setError(failure instanceof Error ? failure.message : "Receipt history print failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy || paymentIds.length === 0}
        onClick={() => void printHistory()}
      >
        {busy ? "Menyiapkan…" : "Cetak Riwayat"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}
    </span>
  );
}
