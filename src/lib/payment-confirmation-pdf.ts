import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import { confirmationMoney, type PaymentConfirmation } from './payment-confirmation';

export const CONFIRMATION_LOGO = '/assets/Logo_Resmi_BTRD25_Transparan.png';

/** Byte generator only. Lovable can change layout here without altering the data model. */
export async function generatePaymentConfirmationPdf(data: PaymentConfirmation, logoPng: Uint8Array) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Payment Confirmation');
  pdf.setAuthor(data.business.name);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(logoPng);
  const gold = rgb(0.72, 0.56, 0.24);
  const goldSoft = rgb(0.93, 0.88, 0.76);
  const ink = rgb(0.08, 0.08, 0.08);
  const muted = rgb(0.38, 0.37, 0.34);
  const width = 841.89, height = 595.28, left = 36, bottom = 46, top = height - 112;
  const colGap = 28, leftW = 360, rightX = left + leftW + colGap, rightW = width - left - rightX;
  const pages: PDFPage[] = [];
  function pageAt(index: number) {
    while (pages.length <= index) {
      const page = pdf.addPage([width, height]);
      page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
      page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: ink });
      const size = logo.scaleToFit(110, 54);
      page.drawImage(logo, { x: left, y: height - 26 - size.height, width: size.width, height: size.height });
      const title = 'PAYMENT CONFIRMATION';
      page.drawText(title, { x: width - left - bold.widthOfTextAtSize(title, 20), y: height - 52, size: 20, font: bold, color: ink });
      const sub = data.transactionNumber;
      page.drawText(sub, { x: width - left - font.widthOfTextAtSize(sub, 10), y: height - 68, size: 10, font, color: gold });
      page.drawLine({ start: { x: left, y: height - 88 }, end: { x: width - left, y: height - 88 }, color: gold, thickness: 0.8 });
      if (pages.length > 0) page.drawText('(continued)', { x: left, y: height - 102, size: 8, font, color: muted });
      pages.push(page);
    }
    return pages[index]!;
  }
  function clean(text: string) { return text.replace(/[\r\n\t\u0000-\u001f]/g, ' '); }
  function wrap(text: string, maxWidth: number, size = 9, f = font) {
    const lines: string[] = [];
    let line = '';
    for (const character of clean(text)) {
      try {
        if (f.widthOfTextAtSize(line + character, size) > maxWidth && line) { lines.push(line); line = ''; }
        f.encodeText(character);
      } catch {
        throw new Error('Karakter dokumen belum didukung font PDF. Jangan mengganti nama tamu; minta penambahan font Unicode.');
      }
      line += character;
    }
    lines.push(line);
    return lines;
  }
  /** Column cursor: overflowing content continues in the same column on the next page. */
  function cursor(x: number) { return { x, page: 0, y: top }; }
  type Cursor = ReturnType<typeof cursor>;
  function need(c: Cursor, h: number, onBreak?: () => void) {
    if (c.y - h < bottom) { c.page++; c.y = top; onBreak?.(); }
  }
  function section(c: Cursor, title: string, w: number) {
    need(c, 30);
    const p = pageAt(c.page);
    p.drawText(title, { x: c.x, y: c.y, size: 9, font: bold, color: gold });
    p.drawLine({ start: { x: c.x, y: c.y - 5 }, end: { x: c.x + w, y: c.y - 5 }, color: goldSoft, thickness: 0.6 });
    c.y -= 20;
  }
  function field(c: Cursor, label: string, value: string, w: number) {
    const labelW = 128;
    const lines = wrap(value, w - labelW - 6, 9.5, bold);
    for (let i = 0; i < lines.length; i++) {
      need(c, 14);
      const p = pageAt(c.page);
      if (i === 0) p.drawText(label, { x: c.x, y: c.y, size: 8.5, font, color: muted });
      p.drawText(lines[i]!, { x: c.x + labelW, y: c.y, size: 9.5, font: bold, color: ink });
      c.y -= 13;
    }
    c.y -= 4;
  }
  function row(c: Cursor, values: string[], widths: number[], heading = false, onBreak?: () => void) {
    const columns = values.map((value, i) => wrap(value, widths[i]! - 8, 8.5, heading ? bold : font));
    const lines = Math.max(...columns.map(col => col.length));
    for (let line = 0; line < lines; line++) {
      need(c, 13, onBreak);
      const p = pageAt(c.page);
      let x = c.x;
      columns.forEach((column, index) => {
        const text = column[line] ?? '';
        const isAmount = index === values.length - 1 && values.length > 1;
        const f = heading ? bold : font;
        const tx = isAmount ? x + widths[index]! - f.widthOfTextAtSize(text, 8.5) : x;
        p.drawText(text, { x: tx, y: c.y, size: 8.5, font: f, color: heading ? gold : ink });
        x += widths[index]!;
      });
      c.y -= 12;
    }
    c.y -= 3;
    if (!heading) pageAt(c.page).drawLine({ start: { x: c.x, y: c.y + 6 }, end: { x: c.x + widths.reduce((a, b) => a + b, 0), y: c.y + 6 }, color: goldSoft, thickness: 0.4 });
  }

  // Left: identity and stay details.
  const L = cursor(left);
  section(L, 'HOMESTAY', leftW);
  field(L, 'Homestay', [data.business.name, data.business.address, data.business.city, data.business.whatsapp].filter(Boolean).join(' | '), leftW);
  field(L, 'Document date', data.generatedAt, leftW);
  section(L, 'GUEST', leftW);
  field(L, 'Guest', data.guest.name, leftW);
  if (data.guest.phone) field(L, 'WhatsApp', data.guest.phone, leftW);
  field(L, 'Guests / Extra Guest', `${data.guests.total} / ${data.guests.extra}`, leftW);
  section(L, 'STAY DETAILS', leftW);
  field(L, 'Room', `${data.room.type} / ${data.room.number}`, leftW);
  field(L, 'Package', `${data.package.code} ${data.package.name}`, leftW);
  field(L, 'Booking schedule', `${data.times.scheduledCheckIn} - ${data.times.scheduledCheckOut}`, leftW);
  field(L, 'Actual check-in', data.times.actualCheckIn, leftW);
  field(L, 'Checkout deadline', data.times.checkoutDeadline, leftW);
  field(L, 'Actual checkout', data.times.actualCheckOut, leftW);

  // Right: summary and payment history.
  const R = cursor(rightX);
  const p0 = pageAt(0);
  const boxH = 64, boxW = (rightW - 12) / 2;
  const box = (x: number, label: string, value: string, dark: boolean) => {
    p0.drawRectangle({ x, y: R.y - boxH + 10, width: boxW, height: boxH, color: dark ? ink : rgb(0.985, 0.98, 0.965), borderColor: gold, borderWidth: 0.7 });
    p0.drawText(label, { x: x + 12, y: R.y - 8, size: 8, font: bold, color: gold });
    p0.drawText(value, { x: x + 12, y: R.y - 32, size: 15, font: bold, color: dark ? rgb(1, 1, 1) : ink });
  };
  box(rightX, 'NET PAID', confirmationMoney(data.totals.netPaid), true);
  box(rightX + boxW + 12, 'OUTSTANDING', confirmationMoney(data.totals.remaining), false);
  R.y -= boxH + 8;
  field(R, 'Payment status', data.totals.status, rightW);
  field(R, 'Total bill', confirmationMoney(data.totals.bill), rightW);
  field(R, 'Room charge', confirmationMoney(data.totals.room), rightW);
  field(R, 'Extra Guest charge', `${confirmationMoney(data.totals.extraGuest)} (${data.guests.extra} x ${confirmationMoney(data.guests.unitPrice)})`, rightW);
  field(R, 'Gross payments / Refunds', `${confirmationMoney(data.totals.grossPaid)} / ${confirmationMoney(data.totals.refunded)}`, rightW);
  field(R, 'Credit', confirmationMoney(data.totals.credit), rightW);
  section(R, 'PAYMENT HISTORY (WIB)', rightW);
  const tableWidths = [118, 92, 70, rightW - 280];
  const head = () => row(R, ['DATE', 'TYPE', 'METHOD', 'AMOUNT'], tableWidths, true);
  head();
  if (!data.history.length) row(R, ['No payments recorded'], [rightW]);
  for (const payment of data.history) {
    row(R, [payment.date, payment.kind, payment.method,
      `${payment.type === 'refund' ? '-' : ''}${confirmationMoney(payment.amount)}`], tableWidths, false, head);
  }
  const lastPage = Math.max(L.page, R.page);
  const all = pages.slice(0, lastPage + 1);
  const thanks = 'Thank you for your visit. This document summarizes the stored transaction and payment history.';
  all.forEach((p, index) => {
    p.drawLine({ start: { x: left, y: 34 }, end: { x: width - left, y: 34 }, color: goldSoft, thickness: 0.6 });
    p.drawText(thanks, { x: left, y: 20, size: 8, font, color: muted });
    const n = `Page ${index + 1} / ${all.length}`;
    p.drawText(n, { x: width - left - font.widthOfTextAtSize(n, 8), y: 20, size: 8, font, color: ink });
  });
  return pdf.save();
}

/** Local Blob download, no upload/public URL, print dialog or receipt/finance RPC. */
export function downloadConfirmationBytes(bytes: Uint8Array, transactionNumber: string) {
  const blob = new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `Payment-Confirmation-${transactionNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
  document.body.appendChild(anchor);
  try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
}
