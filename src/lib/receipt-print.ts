import { rpc } from "@/lib/data-live";
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
  const h = s.header ?? {};
  const room = s.room ?? {};
  const current = s.current_payment ?? {};
  const history = Array.isArray(s.payment_history) ? s.payment_history : [];
  const hasHistory = history.length > 0;
  const title =
    s.transaction_type === "BOOKING" ? "Thank you for booking" : "Thank you for your visit";
  let html =
    '<article class="receipt"><header><strong>' +
    esc(h.name || "Baturaden 25 Homestay") +
    "</strong><span>" +
    esc(h.address) +
    "</span><span>" +
    esc(h.city) +
    "</span><span>WhatsApp: " +
    esc(h.whatsapp) +
    "</span>";
  if (data.copy_label) html += '<b class="copy">' + esc(data.copy_label) + "</b>";
  html +=
    "</header><hr><h1>PAYMENT RECEIPT</h1>" +
    row("Registration Number", s.registration_number) +
    row("Receipt Reference", s.payment_reference) +
    row("Served by", s.served_by?.name || s.served_by?.user_id) +
    row("Transaction Type", s.transaction_type);
  html +=
    s.transaction_type === "BOOKING"
      ? row("Scheduled Check-in", s.scheduled_check_in) +
        row("Scheduled Check-out", s.scheduled_check_out)
      : row("Actual Check-in", s.actual_check_in) +
        row("Estimated Check-out", s.actual_check_out || "—");
  html +=
    "<hr><h2>DESCRIPTION</h2>" +
    row("Room", String(room.number || "—") + " · " + String(room.type || "—")) +
    row("Package", s.package) +
    row("Room Price", money(Number(s.total_bill || 0) - Number(s.extra_guest_charge || 0)));
  if (Number(s.extra_guest_charge || 0) > 0)
    html += row(
      "Extra Guest",
      String(s.extra_guest_count) + " × " + money(50000) + " = " + money(s.extra_guest_charge),
    );
  if (hasHistory) html += "<h2>PAYMENT HISTORY</h2>" + history.map((payment: JsonRecord) => paymentRow(payment, false)).join("");
  html +=
    "<h2>" +
    (hasHistory ? "CURRENT PAYMENT" : "PAYMENT") +
    "</h2>" +
    (hasHistory ? "" : row("Payment Method", current.method)) +
    paymentRow({ ...current, kind: current.kind || "payment" }) +
    "<hr>" +
    row("Total Bill", money(s.total_bill)) +
    row("Total Paid", money(s.total_paid)) +
    row("Outstanding Balance", money(s.outstanding_balance)) +
    row("Payment Status", s.payment_status) +
    "<footer>" +
    esc(title) +
    "<br><small>Printed request #" +
    esc(data.print_no) +
    "</small></footer></article>";
  return html;
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
export async function prepareReceiptPrint(paymentId: string) {
  const issued = await rpc("issue_payment_receipt", { _payment_id: paymentId });
  if (issued.error) throw new Error(issued.error.message);
  const print = await rpc("request_receipt_print", {
    _receipt_id: issued.data,
    _idempotency_key: crypto.randomUUID(),
  });
  if (print.error) throw new Error(print.error.message);
  return print.data as ReceiptPrintData;
}
