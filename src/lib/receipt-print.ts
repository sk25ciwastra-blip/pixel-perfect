import { rpc } from "@/lib/data-live";
import { featureFlags } from "@/lib/feature-flags";
import { supabase } from "@/integrations/supabase/client";
import thermalLogo from "../assets/receipt-thermal-logo-monochrome.png?inline";
// Owner-approved thermal presentation override (2026-11-13). Remove once official
// contact configuration is aligned; never rewrite Cloud templates or old snapshots.
const THERMAL_CONTACT = Object.freeze({
  address: "Jl. Baturaden Raya No. 25, Ciwastra", city: "Kota Bandung", whatsapp: "0811669805",
});
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
    payment.kind === "dp" || payment.kind === "DEPOSIT" ? "Deposit" :
      payment.kind === "FINAL_PAYMENT" ? "Final Payment" :
      payment.kind === "PARTIAL_PAYMENT" ? "Partial Payment" :
      payment.kind === "payment" ? "Payment" : payment.kind;
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
  // Presentation only: retain the authoritative snapshot status below the emphasis.
  const statusTitle = s.payment_status === "BALANCE DUE" ? "NOT PAID IN FULL" : s.payment_status;

  const content: Record<string, string> = {
    header:
      '<header><img class="thermal-logo" src="' + esc(thermalLogo) +
      '" alt="Baturaden 25 Homestay — DAILY &amp; WEEKLY" width="1239" height="496" loading="eager" decoding="sync"><strong>' +
      esc(templateHeader.title || h.name || "Baturaden 25 Homestay") +
      '</strong><span class="thermal-contact">' +
      esc(THERMAL_CONTACT.address) +
      "</span><span>" +
      esc(THERMAL_CONTACT.city) +
      "</span><span>WhatsApp: " +
      esc(THERMAL_CONTACT.whatsapp) +
      "</span>" +
      (copyLabel ? '<b class="copy">' + esc(copyLabel) + "</b>" : "") +
      "</header>",
    transaction_details:
      "<hr><h1>PAYMENT RECEIPT</h1>" +
      row("Registration Number", s.registration_number) +
      row("Receipt Reference", s.payment_reference) +
      row("Served by", s.served_by?.name || s.served_by?.user_id) +
      row("Payment Method", current.method) +
      row("Transaction Type", s.transaction_type) +
      (s.transaction_type === "BOOKING"
        ? row("Scheduled Check-in", s.scheduled_check_in) +
          row("Scheduled Check-out", s.scheduled_check_out)
        : row("Actual Check-in", s.actual_check_in) +
          row("Estimated Check-out", s.actual_check_out || "—")),
    description:
      '<table class="description"><colgroup><col class="item-col"><col class="package-col"><col class="amount-col"></colgroup>' +
      '<thead><tr><th scope="col">DESCRIPTION</th><th scope="col">PACKAGE</th><th scope="col">AMOUNT</th></tr></thead><tbody>' +
      '<tr><td>Room ' + esc(String(room.number || "—")) + '<small>' + esc(room.type || "—") + '</small></td><td>' +
      esc(s.package) + '</td><td class="amount">' + money(Number(s.total_bill || 0) - Number(s.extra_guest_charge || 0)) + '</td></tr>' +
      (Number(s.extra_guest_charge || 0) > 0
        ? '<tr><td>Extra Guest</td><td>' + esc(String(s.extra_guest_count) + " × " + money(50000)) +
          '</td><td class="amount">' + money(s.extra_guest_charge) + '</td></tr>'
        : "") + '</tbody></table>',
    payment_history: hasHistory
      ? '<section class="payment-section"><h2>PAYMENT HISTORY</h2>' +
        history.map((payment: JsonRecord) => paymentRow(payment, false)).join("") + '</section>'
      : "",
    current_payment:
      '<section class="payment-section current-payment"><h2>' + (hasHistory ? "CURRENT PAYMENT" : "PAYMENT") + "</h2>" +
      (hasHistory ? "" : row("Payment Method", current.method)) +
      paymentRow({ ...current, kind: current.kind || "payment" }) + '</section>',
    totals:
      '<section class="totals">' +
      row(s.transaction_type === "WALK_IN" ? "Grand Total" : "Total Charge", money(s.total_bill)) +
      row(current.kind === "DEPOSIT" || current.kind === "dp" ? "Deposit Paid" : "Total Paid", money(s.total_paid)) +
      row("Outstanding Balance", money(s.outstanding_balance)) +
      '</section><div class="payment-status"><strong>' + esc(statusTitle) + '</strong>' +
      '<small>Payment Status: ' + esc(s.payment_status) + '</small></div>',
    footer:
      "<footer>" +
      '<section class="payment-note"><h2>CATATAN</h2><p>Pembayaran yang telah diterima ' +
      '<strong><em>tidak dapat dibatalkan maupun dikembalikan</em></strong> dengan alasan apa pun.</p></section>' +
      '<strong>' + esc(thankYou) + '</strong>' +
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
    `@page{size:58mm auto;margin:0}
    *{box-sizing:border-box}
    body{margin:0;background:#fff;color:#000;font:10px/1.3 Arial,sans-serif}
    .receipt{width:58mm;max-width:58mm;padding:3mm 2.5mm;page-break-after:always;overflow-wrap:anywhere}
    .receipt:last-child{page-break-after:auto}
    header{text-align:center;display:grid;gap:1px;padding-bottom:1mm}
    .thermal-logo{display:block;width:40mm;max-width:100%;height:auto;max-height:21mm;object-fit:contain;margin:0 auto 1mm;break-inside:avoid}
    header strong{font-size:14px;line-height:1.15}header span{font-size:9px}
    header .thermal-contact,header .thermal-contact~span{font-size:10px;line-height:1.25;color:#000;text-align:center}
    .copy{margin-top:2mm;font-size:11px;border:1px solid #000;padding:1mm}
    .row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:2mm;margin:1mm 0}
    .row strong{text-align:right;overflow-wrap:anywhere}
    h1,h2{font-size:10px;margin:1.5mm 0 1mm;letter-spacing:.3px}h1{text-align:center}
    hr{border:0;border-top:1px dashed #000;margin:2mm 0}
    .description{width:100%;table-layout:fixed;border-collapse:collapse;margin:2mm 0;font-size:9px}
    .item-col{width:38%}.package-col{width:28%}.amount-col{width:34%}
    .description th{font-size:8px;text-align:left;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:1.5mm 0}
    .description td{vertical-align:top;padding:1.5mm .5mm 1.5mm 0;overflow-wrap:anywhere}
    .description th:last-child,.description .amount{text-align:right;padding-right:0;font-variant-numeric:tabular-nums}
    .description small{display:block;font-size:8px}.description tbody{border-bottom:1px dashed #000}
    .payment-section{border-bottom:1px dashed #000;padding-bottom:1mm}
    .payment{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:1px 2mm;margin:1.5mm 0}
    .payment strong{text-align:right;font-variant-numeric:tabular-nums}.payment small{grid-column:1/3;font-size:8px}
    .current-payment h2{font-weight:800}.totals{padding:1mm 0;border-bottom:1px dashed #000}
    .totals .row:first-child{font-size:11px}.totals .row:first-child span{font-weight:bold}
    .payment-status{text-align:center;border-top:2px solid #000;border-bottom:2px solid #000;padding:2mm 0;margin:2mm 0;break-inside:avoid}
    .payment-status strong{display:block;font-size:14px;line-height:1.2;font-weight:900;letter-spacing:.5px}
    .payment-status small{display:block;margin-top:.5mm;font-size:8px}
    footer{text-align:center;border-top:1px dashed #000;padding-top:2mm;margin-top:2mm;break-inside:avoid}
    footer strong{font-size:10px}footer small{font-size:8px}
    footer .payment-note{text-align:left;font-size:10px;line-height:1.35;margin:0 0 2mm}
    footer .payment-note h2{font-size:10px;font-weight:700;margin:0 0 1mm}
    footer .payment-note p{margin:0}
    footer .payment-note strong em{font-weight:700;font-style:italic}`;
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
