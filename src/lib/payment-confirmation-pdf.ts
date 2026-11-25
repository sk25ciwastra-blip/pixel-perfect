import { confirmationFilename } from './payment-confirmation-filename';
import { LineCapStyle, PDFDocument, StandardFonts, degrees, rgb, setCharacterSpacing } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { confirmationMoney, type PaymentConfirmation } from './payment-confirmation';

export const CONFIRMATION_LOGO = '/assets/Logo_BTRD25_Wordmark_Gelap.png';

export type ConfirmationFontBytes = { serif: Uint8Array; regular: Uint8Array; medium: Uint8Array; bold: Uint8Array; italic: Uint8Array; script: Uint8Array };
export const CONFIRMATION_FONTS: Record<keyof ConfirmationFontBytes, string> = {
  serif: '/fonts/pdf/merriweather-latin-900-normal.ttf',
  regular: '/fonts/pdf/roboto-latin-400-normal.ttf',
  medium: '/fonts/pdf/roboto-latin-500-normal.ttf',
  bold: '/fonts/pdf/roboto-latin-700-normal.ttf',
  italic: '/fonts/pdf/roboto-latin-400-italic.ttf',
  script: '/fonts/pdf/great-vibes-latin-400-normal.ttf',
};

const ICON = {
  user: 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2 M16 7a4 4 0 1 1-8 0a4 4 0 1 1 8 0',
  door: 'M13 4h3a2 2 0 0 1 2 2v14 M2 20h3 M13 20h9 M10 12v.01 M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z',
  box: 'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z M12 22V12 M3.29 7L12 12l8.71-5 M7.5 4.27l9 5.15',
  cal: 'M8 2v4 M16 2v4 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M3 10h18 M8 14h.5 M12 14h.5 M16 14h.5 M8 18h.5 M12 18h.5 M16 18h.5',
  card: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M2 10h20',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0a4 4 0 1 1 8 0 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
};

/** Byte generator only. Layout follows the Owner-approved white–blue "Payment Confirmation" template. */
export async function generatePaymentConfirmationPdf(data: PaymentConfirmation, logoPng: Uint8Array, fontBytes?: ConfirmationFontBytes) {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Payment Confirmation');
  pdf.setAuthor(data.business.name);
  let font: PDFFont, medium: PDFFont, bold: PDFFont, serif: PDFFont, italic: PDFFont, script: PDFFont;
  if (fontBytes) {
    pdf.registerFontkit(fontkit);
    [font, medium, bold, serif, italic, script] = (await Promise.all([fontBytes.regular, fontBytes.medium, fontBytes.bold, fontBytes.serif, fontBytes.italic, fontBytes.script].map(b => pdf.embedFont(b, { subset: true })))) as [PDFFont, PDFFont, PDFFont, PDFFont, PDFFont, PDFFont];
  } else {
    font = await pdf.embedFont(StandardFonts.Helvetica);
    medium = font;
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
    italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
    script = await pdf.embedFont(StandardFonts.TimesRomanBoldItalic);
  }
  const logo = await pdf.embedPng(logoPng);
  const blue = rgb(0.1, 0.42, 0.9);
  const blueSoft = rgb(0.83, 0.91, 0.99);
  const bluePetal = rgb(0.86, 0.92, 0.99);
  const line = rgb(0.87, 0.9, 0.94);
  const ink = rgb(0.06, 0.07, 0.09);
  const text2 = rgb(0.13, 0.14, 0.17);
  const green = rgb(0.11, 0.6, 0.18);
  const greenSoft = rgb(0.9, 0.97, 0.89);
  const greenPill = rgb(0.86, 0.96, 0.85);
  const amber = rgb(0.8, 0.5, 0.05);
  const amberSoft = rgb(1, 0.95, 0.85);
  const red = rgb(0.8, 0.18, 0.18);
  const redSoft = rgb(0.99, 0.91, 0.91);
  const white = rgb(1, 1, 1);
  const width = 841.89, height = 595.28;
  const panelTop = 436, panelBottom = 100, bottom = panelBottom + 2;
  const LX = 28, LW = 392, RX = 431, RW = 384;

  function clean(text: string) { return text.replace(/[\r\n\t\u0000-\u001f]/g, ' '); }
  const charset = new Map<PDFFont, Set<number>>();
  function check(f: PDFFont, ch: string) {
    if (fontBytes) {
      if (!charset.has(f)) charset.set(f, new Set(f.getCharacterSet()));
      if (!charset.get(f)!.has(ch.codePointAt(0)!)) throw new Error('bad');
    } else f.encodeText(ch);
  }
  function wrap(text: string, maxWidth: number, size = 9, f = font) {
    const lines: string[] = [];
    let current = '';
    for (const character of clean(text)) {
      try {
        if (f.widthOfTextAtSize(current + character, size) > maxWidth && current) { lines.push(current); current = ''; }
        if (character !== ' ') check(f, character);
      } catch {
        throw new Error('Karakter dokumen belum didukung font PDF. Jangan mengganti nama tamu; minta penambahan font Unicode.');
      }
      current += character;
    }
    lines.push(current);
    return lines;
  }
  function spacedWidth(text: string, size: number, f: PDFFont, gap: number) {
    return f.widthOfTextAtSize(text, size) + gap * (text.length - 1);
  }
  function spaced(page: PDFPage, text: string, x: number, y: number, size: number, f: PDFFont, gap: number, color = ink) {
    page.pushOperators(setCharacterSpacing(gap));
    page.drawText(text, { x, y, size, font: f, color });
    page.pushOperators(setCharacterSpacing(0));
  }
  const right = (page: PDFPage, text: string, xr: number, y: number, size: number, f = font, color = ink) =>
    page.drawText(text, { x: xr - f.widthOfTextAtSize(text, size), y, size, font: f, color });
  function rounded(page: PDFPage, x: number, y: number, w: number, h: number, r: number, opts: { color?: ReturnType<typeof rgb>; borderColor?: ReturnType<typeof rgb>; borderWidth?: number; opacity?: number }) {
    const path = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
    page.drawSvgPath(path, { x, y: y + h, ...opts, ...(opts.opacity !== undefined ? { borderOpacity: opts.opacity } : {}) });
  }
  const icon = (page: PDFPage, d: string, x: number, y: number, s = 0.72) =>
    page.drawSvgPath(d, { x, y: y + 24 * s, scale: s, borderColor: blue, borderWidth: 1.9, borderLineCap: LineCapStyle.Round });
  const money = (v: number) => confirmationMoney(v).replace(/^Rp\s+/, 'Rp');
  const when = (v: string) => v.replace(/ WIB$/, '').replace(', ', '  ·  ').replace(/(\d{2}):(\d{2})/, '$1.$2');
  const invoiceDate = data.generatedAt.split(',')[0]!.toUpperCase();

  const pages: PDFPage[] = [];
  function pageAt(index: number) {
    while (pages.length <= index) {
      const page = pdf.addPage([width, height]);
      page.drawRectangle({ x: 0, y: 0, width, height, color: white });
      // Lotus petals, top right.
      const petal = 'M 0 0 C 40 -28 150 -40 230 0 C 150 40 40 28 0 0 Z';
      for (const [rot, op] of [[100, 0.55], [125, 0.6], [150, 0.65], [175, 0.6], [200, 0.5], [225, 0.4]] as const) {
        page.drawSvgPath(petal, { x: 832, y: 448, rotate: degrees(-rot), color: bluePetal, opacity: op, borderColor: white, borderWidth: 1.4 });
      }
      // Logo wordmark + tagline.
      const cx = 137;
      const logoH = 45;
      const logoW = (logoH * logo.width) / logo.height;
      page.drawImage(logo, { x: cx - logoW / 2 + 4, y: 505, width: logoW, height: logoH });
      const dw = 'DAILY & WEEKLY';
      const dwW = spacedWidth(dw, 6.8, bold, 1.8);
      spaced(page, dw, cx - dwW / 2, 496, 6.8, bold, 1.8);
      page.drawLine({ start: { x: cx - dwW / 2 - 28, y: 498.5 }, end: { x: cx - dwW / 2 - 8, y: 498.5 }, color: ink, thickness: 1 });
      page.drawLine({ start: { x: cx + dwW / 2 + 8, y: 498.5 }, end: { x: cx + dwW / 2 + 28, y: 498.5 }, color: ink, thickness: 1 });
      const tag = 'Nyaman Seperti di Rumah Sendiri';
      page.drawText(tag, { x: cx - italic.widthOfTextAtSize(tag, 10.5) / 2, y: 476, size: 10.5, font: italic, color: ink });
      page.drawLine({ start: { x: 238.5, y: 556 }, end: { x: 238.5, y: 472 }, color: blue, thickness: 1.5 });
      spaced(page, 'PAYMENT CONFIRMATION', 256, 532, 21, serif, 1.9);
      spaced(page, 'THANK YOU FOR YOUR PAYMENT', 256.5, 512, 10, bold, 3.3, blue);
      spaced(page, 'Your payment has been received and your booking', 258, 493, 11.5, font, 0.75, text2);
      spaced(page, 'has been confirmed.', 258, 477, 11.5, font, 0.75, text2);
      const xr = 810;
      const lbl = 'INVOICE NO.';
      spaced(page, lbl, xr - spacedWidth(lbl, 8.5, font, 1.6), 521, 8.5, font, 1.6);
      right(page, data.transactionNumber, xr, 500, 15, bold);
      page.drawRectangle({ x: xr - 36, y: 486.5, width: 36, height: 2.6, color: blue });
      spaced(page, invoiceDate, xr - spacedWidth(invoiceDate, 10, font, 1.4), 468, 10, font, 1.4);
      for (const [x, w] of [[LX, LW], [RX, RW]] as const) {
        rounded(page, x, panelBottom, w, panelTop - panelBottom, 9, { color: rgb(0.985, 0.99, 1), borderColor: rgb(0.8, 0.88, 0.97), borderWidth: 0.8 });
        for (let i = 0; i < 10; i++) page.drawRectangle({ x: x + 1, y: panelTop - 70 + i * 6, width: w - 2, height: 6, color: rgb(0.9, 0.94, 0.995), opacity: 0.04 + i * 0.03 });
        rounded(page, x, panelBottom, w, panelTop - panelBottom, 9, { borderColor: rgb(0.8, 0.88, 0.97), borderWidth: 0.8 });
      }
      if (pages.length > 0) page.drawText('(continued)', { x: LX + 18, y: panelTop - 14, size: 7.5, font, color: text2 });
      pages.push(page);
    }
    return pages[index]!;
  }
  function cursor(x: number) { return { x, page: 0, y: 411 }; }
  type Cursor = ReturnType<typeof cursor>;
  function need(c: Cursor, h: number, onBreak?: () => void) {
    if (c.y - h < bottom) { c.page++; c.y = 411; onBreak?.(); }
  }

  // ---------- Left: guest & reservation ----------
  const L = cursor(52);
  let pg = pageAt(0);
  spaced(pg, 'GUEST & RESERVATION DETAILS', 52, 411, 13, serif, 1.1);
  pg.drawRectangle({ x: 46, y: 399, width: 359, height: 1.6, color: blue });
  L.y = 371;
  const methods = [...new Set(data.history.filter(h => h.type !== 'refund').map(h => h.method))].join(', ') || '—';
  const fields: [keyof typeof ICON, string, string][] = [
    ['user', 'Guest Name', data.guest.name],
    ['door', 'Room / Type', `${data.room.number} / ${data.room.type}`],
    ['box', 'Package', data.package.code || data.package.name],
    ['cal', 'Check-in', when(data.times.actualCheckIn !== '-' ? data.times.actualCheckIn : data.times.scheduledCheckIn)],
    ['cal', 'Check-out', when(data.times.actualCheckOut !== '-' ? data.times.actualCheckOut : data.times.checkoutDeadline)],
    ['card', 'Payment Method', methods],
    ['users', 'Extra Guest', `${data.guests.extra} person  ·  ${money(data.totals.extraGuest)}`],
  ];
  for (const [ic, label, value] of fields) {
    const lines = wrap(value, 405 - 224, 12.5);
    lines.forEach((t, i) => {
      need(L, 22);
      pg = pageAt(L.page);
      if (i === 0) {
        icon(pg, ICON[ic], 52, L.y - 4);
        pg.drawText(label, { x: 93, y: L.y, size: 11, font, color: text2 });
        pg.drawText(':', { x: 205, y: L.y, size: 11, font, color: text2 });
      }
      pg.drawText(t, { x: 224, y: L.y, size: 12.5, font, color: ink });
      if (i < lines.length - 1) L.y -= 16;
    });
    pageAt(L.page).drawLine({ start: { x: 46, y: L.y - 12 }, end: { x: 405, y: L.y - 12 }, color: line, thickness: 0.7 });
    L.y -= 34;
  }

  // ---------- Right: summary, status, history ----------
  const R = cursor(450);
  const rl = 444, rr = 805;
  pg = pageAt(0);
  spaced(pg, 'PAYMENT SUMMARY', 450, 411, 13, serif, 1.1);
  pg.drawRectangle({ x: 443, y: 403, width: 354, height: 1.6, color: blue });
  pg.drawText('DESCRIPTION', { x: 453, y: 388, size: 8.5, font: medium, color: ink });
  right(pg, 'AMOUNT', 795, 388, 8.5, medium);
  pg.drawLine({ start: { x: rl, y: 379 }, end: { x: rr, y: 379 }, color: line, thickness: 0.7 });
  let y = 363;
  const summary: [string, string][] = [[`Room Package (${data.package.code || data.package.name})`, money(data.totals.room)]];
  if (data.guests.extra > 0) summary.push([`Extra Guest (${data.guests.extra} person)`, money(data.totals.extraGuest)]);
  for (const [label, value] of summary) {
    pg.drawText(label, { x: 453, y, size: 11.5, font, color: ink });
    right(pg, value, 796, y, 11.5, font);
    pg.drawLine({ start: { x: rl, y: y - 10 }, end: { x: rr, y: y - 10 }, color: line, thickness: 0.7 });
    y -= 24.5;
  }
  y -= 4;
  rounded(pg, rl, y - 19, rr - rl, 30, 6, { color: blueSoft });
  pg.drawText('Grand Total', { x: 453, y: y - 8, size: 14.5, font: serif, color: ink });
  right(pg, money(data.totals.bill), 797, y - 9, 17, serif);
  y -= 38;
  pg.drawText('Amount Paid', { x: 454, y, size: 11.5, font, color: ink });
  right(pg, money(data.totals.netPaid), 796, y, 11.5, font);
  y -= 15;
  const st = data.totals.status;
  const [stColor, stSoft, stNote] = st === 'PAID' ? [green, greenSoft, ['Transaction completed', 'successfully.']]
    : st === 'PARTIALLY PAID' ? [amber, amberSoft, ['Remaining balance', money(data.totals.remaining)]]
    : [red, redSoft, ['No payment recorded', 'yet.']];
  rounded(pg, rl, y - 58, rr - rl, 58, 7, { color: stSoft, borderColor: rgb(0.72, 0.88, 0.7), borderWidth: 0.7 });
  pg.drawCircle({ x: 479, y: y - 29, size: 18.5, borderColor: stColor, borderWidth: 2.8 });
  if (st === 'PAID') pg.drawSvgPath('M -9 0 L -2.5 6.5 L 9.5 -6.5', { x: 479, y: y - 29, borderColor: stColor, borderWidth: 3.2, borderLineCap: LineCapStyle.Round });
  else pg.drawText('!', { x: 475, y: y - 37, size: 20, font: bold, color: stColor });
  pg.drawText('Payment Status', { x: 516, y: y - 21, size: 9.5, font, color: ink });
  pg.drawText(st, { x: 515, y: y - 47, size: st === 'PAID' ? 23 : 15, font: bold, color: stColor });
  pg.drawLine({ start: { x: 639, y: y - 14 }, end: { x: 639, y: y - 46 }, color: stColor, thickness: 1 });
  pg.drawText(stNote[0]!, { x: 655, y: y - 24, size: 9.8, font, color: ink });
  pg.drawText(stNote[1]!, { x: 655, y: y - 39, size: 9.8, font, color: ink });
  y -= 72;
  spaced(pg, 'PAYMENT HISTORY', 445, y, 12, serif, 0.9);
  R.y = y - 8;
  const cols = [451, 564, 642];
  const head = () => {
    const p = pageAt(R.page);
    p.drawRectangle({ x: rl, y: R.y - 21, width: rr - rl, height: 21, color: blueSoft, opacity: 0.75 });
    ['DATE & TIME', 'METHOD', 'AMOUNT'].forEach((t, i) => p.drawText(t, { x: cols[i]!, y: R.y - 14, size: 8, font: medium, color: ink }));
    p.drawText('STATUS', { x: 761 - medium.widthOfTextAtSize('STATUS', 8) / 2, y: R.y - 14, size: 8, font: medium, color: ink });
    R.y -= 33;
  };
  head();
  if (!data.history.length) { pageAt(R.page).drawText('No payments recorded', { x: cols[0]!, y: R.y, size: 9.5, font, color: text2 }); R.y -= 20; }
  for (const h of data.history) {
    const methodLines = wrap(h.method, 72, 10);
    const rowH = 12 + methodLines.length * 12;
    need(R, 10 + methodLines.length * 2, head);
    const p = pageAt(R.page);
    p.drawText(when(h.date).replace('  ·  ', ' · '), { x: cols[0]!, y: R.y, size: 10, font, color: ink });
    methodLines.forEach((m, i) => p.drawText(m, { x: cols[1]!, y: R.y - i * 12, size: 10, font, color: ink }));
    p.drawText(`${h.type === 'refund' ? '-' : ''}${money(h.amount)}`, { x: cols[2]!, y: R.y, size: 10, font, color: ink });
    const isRefund = h.type === 'refund';
    const tag = isRefund ? 'REFUND' : 'PAID';
    rounded(p, 726, R.y - 6, 70, 18, 9, { color: isRefund ? redSoft : greenPill });
    p.drawText(tag, { x: 761 - bold.widthOfTextAtSize(tag, 10) / 2, y: R.y - 0.5, size: 10, font: bold, color: isRefund ? red : green });
    p.drawLine({ start: { x: rl, y: R.y - rowH + 14 }, end: { x: rr, y: R.y - rowH + 14 }, color: line, thickness: 0.6 });
    R.y -= rowH;
  }

  // ---------- Footer on every page ----------
  const lastPage = Math.max(L.page, R.page);
  const all = pages.slice(0, lastPage + 1);
  const addr = clean([data.business.address, data.business.city].filter(Boolean).join(', '));
  all.forEach((p, index) => {
    p.drawRectangle({ x: 28, y: 85, width: 787, height: 1.4, color: blue });
    p.drawText('Thank you for staying with us', { x: 45, y: 43, size: fontBytes ? 33 : 24, font: script, color: blue });
    spaced(p, 'WE LOOK FORWARD TO WELCOMING YOU AGAIN', 60, 22, 7.5, medium, 2.6);
    p.drawRectangle({ x: 503.5, y: 24, width: 1.4, height: 46, color: blue });
    p.drawSvgPath('M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z', { x: 545, y: 70, scale: 0.65, color: blue });
    p.drawCircle({ x: 552.8, y: 64.2, size: 2.1, color: white });
    p.drawText(addr, { x: 573, y: 55, size: 10, font, color: ink, maxWidth: 240 });
    p.drawSvgPath('M7.9 20A9 9 0 1 0 4 16.1L2 22Z', { x: 544, y: 45, scale: 0.68, borderColor: blue, borderWidth: 1.9 });
    p.drawSvgPath('M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-1.8-1-0.9 0.8c-1-0.4-2-1.4-2.4-2.4l0.8-0.9-1-1.8z', { x: 544, y: 45, scale: 0.68, color: blue });
    p.drawText(`WhatsApp ${clean(data.business.whatsapp)}`, { x: 573, y: 31, size: 10, font, color: ink });
    if (all.length > 1) right(p, `Page ${index + 1} / ${all.length}`, 812, 8, 7, font, text2);
  });
  return pdf.save();
}

/** Local Blob download, no upload/public URL, print dialog or receipt/finance RPC. */
export function downloadConfirmationBytes(bytes: Uint8Array, data: PaymentConfirmation) {
  const blob = new Blob([new Uint8Array(bytes).buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = confirmationFilename(data, 'pdf');
  document.body.appendChild(anchor);
  try { anchor.click(); } finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
}
