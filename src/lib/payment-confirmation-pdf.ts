import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import { confirmationMoney, type PaymentConfirmation } from './payment-confirmation';

export const CONFIRMATION_LOGO = '/assets/Logo_Resmi_BTRD25_Gelap.png';

/** Byte generator only. Layout follows the approved white–blue "Payment Confirmation" template. */
export async function generatePaymentConfirmationPdf(data: PaymentConfirmation, logoPng: Uint8Array) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Payment Confirmation');
  pdf.setAuthor(data.business.name);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const script = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic);
  const logo = await pdf.embedPng(logoPng);
  const blue = rgb(0.09, 0.42, 0.89);
  const blueSoft = rgb(0.85, 0.92, 0.99);
  const bluePale = rgb(0.95, 0.975, 1);
  const line = rgb(0.86, 0.89, 0.93);
  const ink = rgb(0.07, 0.08, 0.1);
  const muted = rgb(0.25, 0.27, 0.31);
  const green = rgb(0.13, 0.6, 0.2);
  const greenSoft = rgb(0.9, 0.97, 0.89);
  const amber = rgb(0.8, 0.5, 0.05);
  const amberSoft = rgb(1, 0.95, 0.85);
  const red = rgb(0.8, 0.18, 0.18);
  const redSoft = rgb(0.99, 0.91, 0.91);
  const width = 841.89, height = 595.28;
  const panelTop = height - 150, panelBottom = 98, bottom = panelBottom + 4;
  const LX = 28, LW = 392, RX = 432, RW = width - 28 - RX;

  function clean(text: string) { return text.replace(/[\r\n\t\u0000-\u001f]/g, ' '); }
  function wrap(text: string, maxWidth: number, size = 9, f = font) {
    const lines: string[] = [];
    let current = '';
    for (const character of clean(text)) {
      try {
        if (f.widthOfTextAtSize(current + character, size) > maxWidth && current) { lines.push(current); current = ''; }
        f.encodeText(character);
      } catch {
        throw new Error('Karakter dokumen belum didukung font PDF. Jangan mengganti nama tamu; minta penambahan font Unicode.');
      }
      current += character;
    }
    lines.push(current);
    return lines;
  }
  function spaced(page: PDFPage, text: string, x: number, y: number, size: number, f: typeof font, gap: number, color = ink) {
    for (const ch of text) { page.drawText(ch, { x, y, size, font: f, color }); x += f.widthOfTextAtSize(ch, size) + gap; }
    return x;
  }
  function spacedWidth(text: string, size: number, f: typeof font, gap: number) {
    return [...text].reduce((w, ch) => w + f.widthOfTextAtSize(ch, size) + gap, 0) - gap;
  }
  const right = (page: PDFPage, text: string, xr: number, y: number, size: number, f = font, color = ink) =>
    page.drawText(text, { x: xr - f.widthOfTextAtSize(text, size), y, size, font: f, color });
  const when = (v: string) => v.replace(', ', ' · ');
  const invoiceDate = data.generatedAt.split(',')[0]!.toUpperCase();

  const pages: PDFPage[] = [];
  function pageAt(index: number) {
    while (pages.length <= index) {
      const page = pdf.addPage([width, height]);
      page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
      // Soft petal decoration, top right.
      for (const [rot, op] of [[20, 0.5], [45, 0.42], [70, 0.36], [95, 0.3], [-5, 0.3]] as const) {
        page.drawEllipse({ x: width - 40, y: height - 40, xScale: 150, yScale: 34, rotate: degrees(rot), color: blueSoft, opacity: op });
      }
      const size = logo.scaleToFit(170, 86);
      page.drawImage(logo, { x: 46, y: height - 30 - size.height, width: size.width, height: size.height });
      page.drawLine({ start: { x: 238, y: height - 40 }, end: { x: 238, y: height - 124 }, color: blue, thickness: 1.4 });
      spaced(page, 'PAYMENT CONFIRMATION', 255, height - 64, 22, serif, 1.6);
      spaced(page, 'THANK YOU FOR YOUR PAYMENT', 256, height - 84, 10, bold, 3.2, blue);
      spaced(page, 'Your payment has been received and your booking', 257, height - 102, 11, font, 0.6, muted);
      spaced(page, 'has been confirmed.', 257, height - 118, 11, font, 0.6, muted);
      const xr = width - 34;
      const lbl = 'INVOICE NO.';
      spaced(page, lbl, xr - spacedWidth(lbl, 8, font, 1.4), height - 74, 8, font, 1.4);
      right(page, data.transactionNumber, xr, height - 94, 15, bold);
      page.drawRectangle({ x: xr - 36, y: height - 106, width: 36, height: 2.4, color: blue });
      spaced(page, invoiceDate, xr - spacedWidth(invoiceDate, 9.5, font, 1.2), height - 124, 9.5, font, 1.2);
      for (const [x, w] of [[LX, LW], [RX, RW]] as const) {
        page.drawRectangle({ x, y: panelBottom, width: w, height: panelTop - panelBottom, color: rgb(0.99, 0.995, 1), borderColor: blueSoft, borderWidth: 0.9, opacity: 0.96 });
      }
      if (pages.length > 0) page.drawText('(continued)', { x: LX + 14, y: panelTop - 14, size: 7.5, font, color: muted });
      pages.push(page);
    }
    return pages[index]!;
  }
  function cursor(x: number) { return { x, page: 0, y: panelTop - 34 }; }
  type Cursor = ReturnType<typeof cursor>;
  function need(c: Cursor, h: number, onBreak?: () => void) {
    if (c.y - h < bottom) { c.page++; c.y = panelTop - 34; onBreak?.(); }
  }
  function heading(c: Cursor, title: string, x: number, w: number) {
    need(c, 30);
    const p = pageAt(c.page);
    spaced(p, title, x, c.y, 13, serif, 1.1);
    p.drawLine({ start: { x, y: c.y - 10 }, end: { x: x + w, y: c.y - 10 }, color: blue, thickness: 1.4 });
    c.y -= 30;
  }

  // ---------- Left: guest & reservation ----------
  const L = cursor(LX + 18);
  const lw = LW - 36;
  heading(L, 'GUEST & RESERVATION DETAILS', L.x, lw);
  const methods = [...new Set(data.history.filter(h => h.type !== 'refund').map(h => h.method))].join(', ') || '—';
  const fields: [string, string][] = [
    ['Guest Name', data.guest.name],
    ['Room / Type', `${data.room.number} / ${data.room.type}`],
    ['Package', data.package.code || data.package.name],
    ['Check-in', when(data.times.actualCheckIn !== '-' ? data.times.actualCheckIn : data.times.scheduledCheckIn)],
    ['Check-out', when(data.times.actualCheckOut !== '-' ? data.times.actualCheckOut : data.times.checkoutDeadline)],
    ['Payment Method', methods],
    ['Extra Guest', `${data.guests.extra} person · ${confirmationMoney(data.totals.extraGuest)}`],
  ];
  const valueX = L.x + 170;
  for (const [label, value] of fields) {
    const lines = wrap(value, L.x + lw - valueX, 11.5);
    lines.forEach((text, i) => {
      need(L, 30);
      const p = pageAt(L.page);
      if (i === 0) {
        p.drawRectangle({ x: L.x + 2, y: L.y - 6, width: 15, height: 15, borderColor: blue, borderWidth: 1.2, color: bluePale });
        p.drawCircle({ x: L.x + 9.5, y: L.y + 1.5, size: 2.2, color: blue });
        p.drawText(label, { x: L.x + 42, y: L.y - 2, size: 10.5, font, color: ink });
        p.drawText(':', { x: L.x + 152, y: L.y - 2, size: 10.5, font, color: ink });
      }
      p.drawText(text, { x: valueX, y: L.y - 2, size: 11.5, font, color: ink });
      L.y -= i === lines.length - 1 ? 14 : 15;
    });
    pageAt(L.page).drawLine({ start: { x: L.x, y: L.y }, end: { x: L.x + lw, y: L.y }, color: line, thickness: 0.6 });
    L.y -= 17;
  }

  // ---------- Right: summary, status, history ----------
  const R = cursor(RX + 14);
  const rw = RW - 28, rr = R.x + rw;
  heading(R, 'PAYMENT SUMMARY', R.x + 4, rw - 4);
  let p = pageAt(0);
  R.y += 6;
  p.drawText('DESCRIPTION', { x: R.x + 6, y: R.y, size: 8.5, font, color: ink });
  right(p, 'AMOUNT', rr - 6, R.y, 8.5, font);
  p.drawLine({ start: { x: R.x, y: R.y - 8 }, end: { x: rr, y: R.y - 8 }, color: line, thickness: 0.6 });
  R.y -= 26;
  const summary: [string, string][] = [
    [`Room Package (${data.package.code || data.package.name})`, confirmationMoney(data.totals.room)],
  ];
  if (data.guests.extra > 0) summary.push([`Extra Guest (${data.guests.extra} person)`, confirmationMoney(data.totals.extraGuest)]);
  for (const [label, value] of summary) {
    p.drawText(label, { x: R.x + 6, y: R.y, size: 11, font, color: ink });
    right(p, value, rr - 6, R.y, 11, font);
    p.drawLine({ start: { x: R.x, y: R.y - 10 }, end: { x: rr, y: R.y - 10 }, color: line, thickness: 0.6 });
    R.y -= 23;
  }
  p.drawRectangle({ x: R.x - 2, y: R.y - 12, width: rw + 4, height: 30, color: blueSoft });
  p.drawText('Grand Total', { x: R.x + 8, y: R.y - 3, size: 14, font: serif, color: ink });
  right(p, confirmationMoney(data.totals.bill), rr - 8, R.y - 3, 16, serif);
  R.y -= 32;
  p.drawText('Amount Paid', { x: R.x + 8, y: R.y, size: 11, font, color: ink });
  right(p, confirmationMoney(data.totals.netPaid), rr - 8, R.y, 11, font);
  R.y -= 16;
  const st = data.totals.status;
  const [stColor, stSoft, stNote] = st === 'PAID' ? [green, greenSoft, ['Transaction completed', 'successfully.']]
    : st === 'PARTIALLY PAID' ? [amber, amberSoft, ['Remaining balance', confirmationMoney(data.totals.remaining)]]
    : [red, redSoft, ['No payment recorded', 'yet.']];
  p.drawRectangle({ x: R.x - 2, y: R.y - 56, width: rw + 4, height: 56, color: stSoft, borderColor: stColor, borderWidth: 0.5, borderOpacity: 0.4 });
  p.drawCircle({ x: R.x + 32, y: R.y - 28, size: 19, borderColor: stColor, borderWidth: 2.6 });
  if (st === 'PAID') p.drawSvgPath('M -8 0 L -2 6 L 9 -6', { x: R.x + 32, y: R.y - 28, borderColor: stColor, borderWidth: 2.8 });
  else p.drawText('!', { x: R.x + 29, y: R.y - 35, size: 18, font: bold, color: stColor });
  p.drawText('Payment Status', { x: R.x + 72, y: R.y - 19, size: 9, font, color: ink });
  p.drawText(st, { x: R.x + 72, y: R.y - 44, size: st === 'PAID' ? 22 : 15, font: bold, color: stColor });
  const divX = R.x + 196;
  p.drawLine({ start: { x: divX, y: R.y - 12 }, end: { x: divX, y: R.y - 44 }, color: stColor, thickness: 0.9 });
  p.drawText(stNote[0]!, { x: divX + 15, y: R.y - 24, size: 9, font, color: ink });
  p.drawText(stNote[1]!, { x: divX + 15, y: R.y - 38, size: 9, font, color: ink });
  R.y -= 80;
  p.drawText('PAYMENT HISTORY', { x: R.x - 2, y: R.y, size: 12, font: serif, color: ink });
  R.y -= 10;
  const cols = [R.x + 4, R.x + 116, R.x + 178];
  const head = () => {
    const pg = pageAt(R.page);
    pg.drawRectangle({ x: R.x - 2, y: R.y - 16, width: rw + 4, height: 20, color: blueSoft, opacity: 0.8 });
    ['DATE & TIME', 'METHOD', 'AMOUNT'].forEach((t, i) => pg.drawText(t, { x: cols[i]!, y: R.y - 9, size: 7.5, font, color: ink }));
    right(pg, 'STATUS', rr - 16, R.y - 9, 7.5, font);
    R.y -= 30;
  };
  head();
  if (!data.history.length) { pageAt(R.page).drawText('No payments recorded', { x: cols[0]!, y: R.y, size: 9, font, color: muted }); R.y -= 20; }
  for (const h of data.history) {
    const methodLines = wrap(h.method, 56, 9);
    const rowH = 10 + methodLines.length * 11;
    need(R, rowH, head);
    const pg = pageAt(R.page);
    pg.drawText(when(h.date), { x: cols[0]!, y: R.y, size: 9, font, color: ink });
    methodLines.forEach((m, i) => pg.drawText(m, { x: cols[1]!, y: R.y - i * 11, size: 9, font, color: ink }));
    pg.drawText(`${h.type === 'refund' ? '-' : ''}${confirmationMoney(h.amount)}`, { x: cols[2]!, y: R.y, size: 9, font, color: ink });
    const isRefund = h.type === 'refund';
    const tag = isRefund ? 'REFUND' : 'PAID';
    const tw = 62;
    pg.drawRectangle({ x: rr - tw, y: R.y - 5, width: tw, height: 16, color: isRefund ? redSoft : greenSoft, borderColor: isRefund ? redSoft : greenSoft, borderWidth: 0 });
    pg.drawText(tag, { x: rr - tw / 2 - bold.widthOfTextAtSize(tag, 9) / 2, y: R.y - 0.5, size: 9, font: bold, color: isRefund ? red : green });
    pg.drawLine({ start: { x: R.x - 2, y: R.y - rowH + 12 }, end: { x: rr + 2, y: R.y - rowH + 12 }, color: line, thickness: 0.5 });
    R.y -= rowH;
  }
  p = pageAt(0);

  // ---------- Footer on every page ----------
  const lastPage = Math.max(L.page, R.page);
  const all = pages.slice(0, lastPage + 1);
  const addr = clean([data.business.address, data.business.city].filter(Boolean).join(', '));
  all.forEach((pg, index) => {
    pg.drawLine({ start: { x: 28, y: 86 }, end: { x: width - 28, y: 86 }, color: blue, thickness: 1.3 });
    pg.drawText('Thank you for staying with us', { x: 46, y: 46, size: 24, font: script, color: blue });
    spaced(pg, 'WE LOOK FORWARD TO WELCOMING YOU AGAIN', 60, 24, 7, font, 2.4);
    pg.drawLine({ start: { x: 505, y: 72 }, end: { x: 505, y: 22 }, color: blue, thickness: 1.3 });
    pg.drawCircle({ x: 552, y: 61, size: 5, color: blue });
    pg.drawCircle({ x: 552, y: 61, size: 1.8, color: rgb(1, 1, 1) });
    pg.drawText(addr, { x: 572, y: 57, size: 9, font, color: ink, maxWidth: 240 });
    pg.drawCircle({ x: 552, y: 37, size: 6, borderColor: blue, borderWidth: 1.2 });
    pg.drawText(`WhatsApp ${clean(data.business.whatsapp)}`, { x: 572, y: 33, size: 9, font, color: ink });
    if (all.length > 1) right(pg, `Page ${index + 1} / ${all.length}`, width - 30, 10, 7, font, muted);
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
