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
  const gold = rgb(0.63, 0.48, 0.20);
  const ink = rgb(0.10, 0.10, 0.10);
  const width = 841.89, height = 595.28, left = 32, bottom = 40;
  let page: PDFPage;
  let y = 0;
  function addPage() {
    page = pdf.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 0.995, 0.975) });
    const size = logo.scaleToFit(80, 48);
    page.drawImage(logo, { x: left, y: height - 65, width: size.width, height: size.height });
    page.drawText('PAYMENT CONFIRMATION', { x: 140, y: height - 43, size: 19, font: bold, color: gold });
    page.drawLine({ start: { x: left, y: height - 77 }, end: { x: width - left, y: height - 77 }, color: gold });
    y = height - 98;
  }
  function clean(text: string) { return text.replace(/[\r\n\t\u0000-\u001f]/g, ' '); }
  function wrap(text: string, maxWidth: number) {
    const lines: string[] = [];
    let line = '';
    for (const character of clean(text)) {
      try {
        if (font.widthOfTextAtSize(line + character, 9) > maxWidth && line) { lines.push(line); line = ''; }
        font.encodeText(character);
      } catch {
        throw new Error('Karakter dokumen belum didukung font PDF. Jangan mengganti nama tamu; minta penambahan font Unicode.');
      }
      line += character;
    }
    lines.push(line);
    return lines;
  }
  function row(values: string[], widths: number[], heading = false) {
    const columns = values.map((value, i) => wrap(value, widths[i]! - 10));
    const lines = Math.max(...columns.map(c => c.length));
    for (let line = 0; line < lines; line++) {
      if (y < bottom + 14) addPage();
      let x = left;
      columns.forEach((column, index) => {
        page.drawText(column[line] ?? '', { x, y, size: 9, font: heading ? bold : font, color: heading ? gold : ink });
        x += widths[index]!;
      });
      y -= 12;
    }
    y -= 4;
  }
  addPage();
  const details = [
    ['Homestay', [data.business.name, data.business.address, data.business.city, data.business.whatsapp].filter(Boolean).join(' | ')],
    ['Transaction / Document date', `${data.transactionNumber} | ${data.generatedAt}`],
    ['Guest / WhatsApp', [data.guest.name, data.guest.phone].filter(Boolean).join(' | ')],
    ['Room / Package', `${data.room.type} / ${data.room.number} | ${data.package.code} ${data.package.name}`],
    ['Guests / Extra Guest', `${data.guests.total} / ${data.guests.extra}`],
    ['Booking schedule', `${data.times.scheduledCheckIn} - ${data.times.scheduledCheckOut}`],
    ['Actual check-in / Checkout deadline', `${data.times.actualCheckIn} / ${data.times.checkoutDeadline}`],
    ['Actual checkout', data.times.actualCheckOut],
    ['Room / Extra Guest charge', `${confirmationMoney(data.totals.room)} / ${confirmationMoney(data.totals.extraGuest)} (${data.guests.extra} x ${confirmationMoney(data.guests.unitPrice)})`],
    ['Total bill / Gross payments / Refunds', `${confirmationMoney(data.totals.bill)} / ${confirmationMoney(data.totals.grossPaid)} / ${confirmationMoney(data.totals.refunded)}`],
    ['Net paid / Outstanding / Credit', `${confirmationMoney(data.totals.netPaid)} / ${confirmationMoney(data.totals.remaining)} / ${confirmationMoney(data.totals.credit)}`],
    ['Payment status', data.totals.status],
  ];
  details.forEach(values => row(values, [220, width - left * 2 - 220]));
  const tableWidths = [170, 220, 210, width - left * 2 - 600];
  row(['PAYMENT HISTORY (WIB)', 'TYPE', 'METHOD', 'AMOUNT'], tableWidths, true);
  if (!data.history.length) row(['No payments recorded'], [width - left * 2]);
  for (const payment of data.history) {
    if (y < bottom + 30) {
      addPage();
      row(['PAYMENT HISTORY (continued)', 'TYPE', 'METHOD', 'AMOUNT'], tableWidths, true);
    }
    row([payment.date, payment.kind, payment.method,
      `${payment.type === 'refund' ? '-' : ''}${confirmationMoney(payment.amount)}`], tableWidths);
  }
  row(['Thank you for your visit. This document summarizes the stored transaction and payment history.'], [width - left * 2]);
  const pages = pdf.getPages();
  pages.forEach((p, index) => p.drawText(`${index + 1} / ${pages.length}`, { x: width - 65, y: 20, size: 8, font, color: ink }));
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
