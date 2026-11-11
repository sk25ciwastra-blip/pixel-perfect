import { rpc } from "@/lib/data-live";
import { featureFlags } from "@/lib/feature-flags";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = any;
export type ReceiptPrintData = {
  print_request_id: string;
  print_no: number;
  copy_label: string;
  status: string;
  receipt_snapshot: JsonRecord;
  template_snapshot: JsonRecord;
};
function esc(value: unknown) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}
function money(value: unknown) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}
function row(label: string, value: unknown) {
  return (
    '<div class="row"><span>' + esc(label) + "</span><strong>" + esc(value) + "</strong></div>"
  );
}
function paymentRow(payment: JsonRecord, showMethod = true) {
  const kind =
    payment.kind === "dp" ? "Deposit" : payment.kind === "payment" ? "Payment" : payment.kind;
  return (
    '<div class="payment"><span>' +
    esc(kind) +
    (showMethod && payment.method ? " · " + esc(payment.method) : "") +
    "</span><strong>" +
    money(payment.amount) +
    "</strong><small>" +
    esc(payment.created_at) +
    "</small></div>"
  );
}
export function receiptHtml(data: ReceiptPrintData) {
  const s = data.receipt_snapshot ?? {};
  const t = data.template_snapshot ?? {};
  if (t.language !== "en" || Number(t.paper_width_mm) !== 58) {
    throw new Error("Receipt template must be English and 58 mm.");
  }

  const supportedBlocks = [
    "header", "transaction_details", "description", "payment_history",
    "current_payment", "totals", "footer",
  ];
  const requiredBlocks = supportedBlocks.filter((key) => key !== "payment_history");
  const blocks: string[] = Array.isArray(t.blocks)
    ? t.blocks.map((block: JsonRecord) => block?.key)
    : [];
  if (
    blocks.some((key) => !supportedBlocks.includes(key)) ||
    new Set(blocks).size !== blocks.length ||
    requiredBlocks.some((key) => !blocks.includes(key))
  ) {
    throw new Error("Receipt template blocks are incomplete or invalid.");
  }

  const h = s.header ?? {};
  const templateHeader = t.header ?? {};
  const templateFooter = t.footer ?? {};
  const room = s.room ?? {};
  const current = s.current_payment ?? {};
  const history = Array.isArray(s.payment_history) ? s.payment_history : [];
  const hasHistory = history.length > 0;
  const copyNo = Number(data.print_no);
  const copyLabel = Number.isInteger(copyNo) && copyNo > 1
    ? "SALINAN " + (copyNo - 1) + "/COPY " + (copyNo - 1)
    : "";
  const thankYou = templateFooter.thank_you ||
    (s.transaction_type === "BOOKING" ? "Thank you for booking" : "Thank you for your visit");

  const content: Record<string, string> = {
    header:
      '<header><strong>' +
      esc(templateHeader.title || h.name || "Baturaden 25 Homestay") +
      "</strong><span>" +
      esc(templateHeader.address || h.address) +
      "</span><span>" +
      esc(templateHeader.city || h.city) +
      "</span><span>WhatsApp: " +
      esc(templateHeader.whatsapp || h.whatsapp) +
      "</span>" +
      (copyLabel ? '<b class="copy">' + esc(copyLabel) + "</b>" : "") +
      "</header>",
    transaction_details:
      "<hr><h1>PAYMENT RECEIPT</h1>" +
      row("Registration Number", s.registration_number) +
      row("Receipt Reference", s.payment_reference) +
      row("Served by", s.served_by?.name || s.served_by?.user_id) +
      row("Transaction Type", s.transaction_type) +
      (s.transaction_type === "BOOKING"
        ? row("Scheduled Check-in", s.scheduled_check_in) +
          row("Scheduled Check-out", s.scheduled_check_out)
        : row("Actual Check-in", s.actual_check_in) +
          row("Estimated Check-out", s.actual_check_out || "—")),
    description:
      "<hr><h2>DESCRIPTION</h2>" +
      row("Room", String(room.number || "—") + " · " + String(room.type || "—")) +
      row("Package", s.package) +
      row("Room Price", money(Number(s.total_bill || 0) - Number(s.extra_guest_charge || 0))) +
      (Number(s.extra_guest_charge || 0) > 0
        ? row(
            "Extra Guest",
            String(s.extra_guest_count) + " × " + money(50000) + " = " + money(s.extra_guest_charge),
          )
        : ""),
    payment_history: hasHistory
      ? "<h2>PAYMENT HISTORY</h2>" +
        history.map((payment: JsonRecord) => paymentRow(payment, false)).join("")
      : "",
    current_payment:
      "<h2>" + (hasHistory ? "CURRENT PAYMENT" : "PAYMENT") + "</h2>" +
      (hasHistory ? "" : row("Payment Method", current.method)) +
      paymentRow({ ...current, kind: current.kind || "payment" }),
    totals:
      "<hr>" +
      row("Total Bill", money(s.total_bill)) +
      row("Total Paid", money(s.total_paid)) +
      row("Outstanding Balance", money(s.outstanding_balance)) +
      row("Payment Status", s.payment_status),
    footer:
      "<footer>" +
      esc(thankYou) +
      "<br><small>Printed request #" +
      esc(data.print_no) +
      "</small></footer>",
  };

  return '<article class="receipt">' + blocks.map((key) => content[key]).join("") + "</article>";
}
export function openReceiptPrintWindow() {
  // Open synchronously on the user click, before any asynchronous RPC.
  // A blocked popup must not consume a receipt print-request number.
  const popup = window.open("", "_blank", "width=420,height=720");
  if (!popup) throw new Error("Print preview was blocked by the browser");
  popup.opener = null;
  popup.document.write("<!doctype html><title>Preparing receipt…</title><p>Preparing receipt…</p>");
  popup.document.close();
  return popup;
}
export function openReceiptPrintPreview(receipts: ReceiptPrintData[], popup: Window) {
  if (popup.closed) throw new Error("Print preview was closed before it was ready");
  const css =
    "@page{size:58mm auto;margin:0}*{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font:10px/1.3 Arial,sans-serif}.receipt{width:58mm;max-width:58mm;padding:3mm 2.5mm;page-break-after:always}.receipt:last-child{page-break-after:auto}header{text-align:center;display:grid;gap:1px}header strong{font-size:13px}header span{font-size:9px}.copy{margin-top:2mm;font-size:11px}.row{display:flex;justify-content:space-between;gap:6px;margin:1.5mm 0}.row span{min-width:0}.row strong{text-align:right;overflow-wrap:anywhere}h1,h2{font-size:10px;margin:2mm 0 1mm}h1{text-align:center}hr{border:0;border-top:1px dashed #000;margin:2mm 0}.payment{display:grid;grid-template-columns:1fr auto;gap:1px;margin:2mm 0}.payment small{grid-column:1/3;font-size:8px}footer{text-align:center;margin-top:3mm}";
  popup.document.write(
    '<!doctype html><html><head><meta charset="utf-8"><title>Payment Receipt</title><style>' +
      css +
      "</style></head><body>" +
      receipts.map(receiptHtml).join("") +
      "</body></html>",
  );
  popup.document.close();
  popup.focus();
  popup.print();
}
export async function prepareReceiptPrint(paymentId: string, requestKey: string = crypto.randomUUID()) {
  if (!featureFlags.receipt58mm) throw new Error("Cetak struk 58mm belum diaktifkan.");
  const issued = await rpc("issue_payment_receipt", { _payment_id: paymentId });
  if (issued.error) throw new Error(issued.error.message);
  const print = await rpc("request_receipt_print", {
    _receipt_id: issued.data,
    _idempotency_key: requestKey,
  });
  if (print.error) throw new Error(print.error.message);
  const data = print.data as ReceiptPrintData | null;
  if (!data?.print_request_id || !data.receipt_snapshot || !data.template_snapshot) {
    throw new Error("Data struk dari server belum lengkap.");
  }
  return data;
}

export async function receiptPaymentIds(transactionNumber: string): Promise<string[]> {
  if (!featureFlags.receipt58mm) throw new Error("Cetak struk 58mm belum diaktifkan.");
  const transaction = await supabase.from('transactions').select('id')
    .eq('transaction_number', transactionNumber).single();
  if (transaction.error) throw new Error(transaction.error.message);
  const ids: string[] = [];
  for (let offset = 0; ; offset += 200) {
    const payments = await supabase.from('payments').select('id')
      .eq('transaction_id', transaction.data.id)
      .order('created_at', { ascending: true }).order('id', { ascending: true })
      .range(offset, offset + 199);
    if (payments.error) throw new Error(payments.error.message);
    ids.push(...payments.data.map((payment) => payment.id));
    if (payments.data.length < 200) break;
  }
  if (!ids.length) throw new Error('Pembayaran transaksi belum tersedia untuk dicetak.');
  return ids;
}

export async function printReceiptBatch(
  paymentIds: string[], popup: Window, keys: Map<string, string>,
) {
  if (!featureFlags.receipt58mm) throw new Error("Cetak struk 58mm belum diaktifkan.");
  if (!paymentIds.length) throw new Error('Tidak ada pembayaran untuk dicetak.');
  const receipts: ReceiptPrintData[] = [];
  for (const id of paymentIds) {
    if (!keys.has(id)) keys.set(id, crypto.randomUUID());
    receipts.push(await prepareReceiptPrint(id, keys.get(id)!));
  }
  openReceiptPrintPreview(receipts, popup);
  // Browser print() cannot confirm a physical print or distinguish cancellation.
  const results = await Promise.all(receipts.map((receipt) => rpc('record_receipt_print_result', {
    _print_request_id: receipt.print_request_id, _status: 'PRINT_DIALOG_OPENED',
  })));
  const failure = results.find((result) => result.error)?.error;
  if (failure) throw new Error(failure.message);
  keys.clear();
}
