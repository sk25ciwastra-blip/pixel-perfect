import { biayaTamuTambahan } from '@/lib/tamu-tambahan';
import { rupiah } from '@/lib/data-contoh';
import type { OfferDetail } from '@/lib/reservation-offers';

/**
 * Visual-only card: never confirms a booking, creates a TRX or records payment.
 * The QR image is a pixel-level copy of the QR symbol supplied by the Owner,
 * independently decoded against the original Baturaden 25 Homestay QRIS.
 */
export const RESERVATION_CARD_QRIS = '/assets/qris-resmi-baturaden25.png';
export const RESERVATION_CARD_LOGO = '/assets/Logo_Resmi_BTRD25_Transparan.png';
export const RESERVATION_CARD_CAPTION =
  'Halo Kak, berikut rincian reservasi dan QRIS pembayaran Baturaden 25 Homestay. 😊';

export type ReservationCardFields = {
  name: string; address: string; phone: string; roomType: string;
  roomNumber: string; packageName: string; guestCount: number;
  checkIn: string; checkOut: string; roomPrice: number;
  extraCharge: number; total: number; minimumDp: number;
  dpLabel: string;
};

const wib = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric',
  month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  hourCycle: 'h23',
});

export function reservationCardFields(offer: OfferDetail): ReservationCardFields {
  const extraCharge = biayaTamuTambahan(offer.guest_count).total;
  const total = Number(offer.total);
  const minimumDp = Number(offer.minimum_dp);
  const start = new Date(offer.scheduled_check_in);
  const end = new Date(offer.scheduled_check_out);
  if (!offer.guest_name.trim() || !offer.address.trim() || !offer.phone.trim() ||
      !offer.room_number.trim() || !offer.room_type.trim() || !offer.package_name.trim() ||
      !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start ||
      !Number.isFinite(total) || !Number.isFinite(minimumDp) || !Number.isFinite(extraCharge) ||
      !Number.isInteger(offer.guest_count) || offer.guest_count < 2 ||
      minimumDp < 0 || minimumDp > total || extraCharge < 0 || extraCharge > total) {
    throw new Error('Data reservasi tidak valid untuk kartu pembayaran. Periksa data tamu dan harga resmi.');
  }
  const mode = offer.minimum_dp_mode === 'PERCENTAGE'
    ? `Minimal ${offer.minimum_dp_value}%` : 'Minimal sesuai ketentuan';
  return {
    name: offer.guest_name, address: offer.address, phone: offer.phone,
    roomType: offer.room_type, roomNumber: offer.room_number, packageName: offer.package_name,
    guestCount: offer.guest_count,
    checkIn: `${wib.format(start)} WIB`, checkOut: `${wib.format(end)} WIB`,
    roomPrice: total - extraCharge, extraCharge, total, minimumDp, dpLabel: mode,
  };
}

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Aset resmi kartu reservasi tidak tersedia. Jangan mengirim kartu tanpa QRIS asli.'));
    img.src = path;
  });
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number,
  size: number, color: string, weight = 500, maxWidth?: number) {
  ctx.fillStyle = color;
  let fontSize = size;
  ctx.font = `${weight} ${fontSize}px Arial, sans-serif`;
  while (maxWidth && ctx.measureText(value).width > maxWidth && fontSize > 20) {
    fontSize -= 1;
    ctx.font = `${weight} ${fontSize}px Arial, sans-serif`;
  }
  ctx.fillText(value, x, y, maxWidth);
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = '#c99e44', width = 3) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
}

function panelTitle(ctx: CanvasRenderingContext2D, title: string, x: number, y: number, width: number) {
  const g = ctx.createLinearGradient(x, y, x + width, y);
  g.addColorStop(0, '#0b1f3b'); g.addColorStop(1, '#16335a');
  round(ctx, x, y, width, 48, 23, g, '#dba541');
  text(ctx, title, x + 22, y + 32, 25, '#ffe4a0', 800);
}

function fitAddress(ctx: CanvasRenderingContext2D, address: string, x: number, y: number, width: number): number {
  ctx.font = '500 24px Arial, sans-serif';
  const words = address.trim().replace(/\s+/g, ' ').split(' ');
  const result: string[] = [];
  let lineText = '';
  for (const word of words) {
    const candidate = lineText ? `${lineText} ${word}` : word;
    if (ctx.measureText(candidate).width <= width || !lineText) lineText = candidate;
    else { result.push(lineText); lineText = word; }
  }
  if (lineText) result.push(lineText);
  if (result.length > 3 || result.some(item => ctx.measureText(item).width > width)) {
    throw new Error('Alamat tamu terlalu panjang untuk dicetak lengkap pada kartu. Periksa alamat terlebih dahulu.');
  }
  result.forEach((value, index) => text(ctx, value, x, y + index * 27, 24, '#10213a', 500));
  return result.length;
}

function draw(ctx: CanvasRenderingContext2D, fields: ReservationCardFields, qr: HTMLImageElement, logo: HTMLImageElement) {
  const W = 1122;
  const H = 1710;
  const navy = '#071a34', gold = '#d6a342', cream = '#fff9ed', ink = '#0c1b34';
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#081932'); bg.addColorStop(.56, '#18345a'); bg.addColorStop(1, '#071830');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#f5c75f'; ctx.lineWidth = 16; ctx.strokeRect(10, 10, W - 20, H - 20);
  // Warm gold ribbons frame the navy header.
  ctx.strokeStyle = '#f2c760'; ctx.lineWidth = 11;
  ctx.beginPath(); ctx.moveTo(0, 132); ctx.bezierCurveTo(210, 44, 740, 235, 1122, 92); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 1653); ctx.bezierCurveTo(360, 1731, 710, 1571, 1122, 1653); ctx.stroke();

  // Actual project logo (not a generated facsimile).
  const ratio = Math.min(470 / logo.width, 125 / logo.height);
  const lw = logo.width * ratio, lh = logo.height * ratio;
  ctx.drawImage(logo, (W - lw) / 2, 21, lw, lh);
  ctx.textAlign = 'center';
  text(ctx, 'PEMBAYARAN RESERVASI', W / 2, 196, 45, '#ffe0a0', 800);
  text(ctx, 'Scan menggunakan aplikasi pembayaran berlogo QRIS', W / 2, 239, 22, '#fff0d5', 500);
  round(ctx, 291, 261, 540, 490, 30, cream, '#d9a843');
  text(ctx, 'BATURADEN 25 HOMESTAY', W / 2, 310, 29, ink, 800);
  text(ctx, 'NMID: ID1025390108054', W / 2, 347, 22, ink, 600);
  round(ctx, 353, 366, 416, 370, 15, '#ffffff', '#dca742');
  // Preserve actual QR modules; do not generate an artificial QR or annotate on it.
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, 382, 375, 354, 354);
  ctx.imageSmoothingEnabled = true;

  // Cream reservation body.
  round(ctx, 28, 773, 1066, 846, 38, cream, gold);
  const head = ctx.createLinearGradient(249, 760, 849, 805);
  head.addColorStop(0, '#09223f'); head.addColorStop(1, '#163c67');
  round(ctx, 235, 758, 652, 64, 30, head, '#e6b85a');
  text(ctx, 'RINCIAN RESERVASI', W / 2, 803, 38, '#ffe2a0', 800);
  ctx.textAlign = 'left';

  panelTitle(ctx, 'DATA TAMU', 54, 840, 260);
  text(ctx, 'Nama', 345, 866, 24, ink, 600);
  text(ctx, fields.name, 513, 866, 26, ink, 700, 534);
  text(ctx, 'Alamat', 345, 901, 24, ink, 600);
  const addressLines = fitAddress(ctx, fields.address, 513, 901, 540);
  const phoneY = 938 + (addressLines - 1) * 27;
  text(ctx, 'WhatsApp', 345, phoneY, 24, ink, 600);
  text(ctx, fields.phone, 513, phoneY, 26, ink, 700, 534);

  const detailTop = 980 + (addressLines - 1) * 27;
  line(ctx, 55, detailTop - 20, 1066, detailTop - 20, '#e2c58d', 2);
  panelTitle(ctx, 'DETAIL RESERVASI', 54, detailTop, 368);
  text(ctx, 'Tipe Kamar', 74, detailTop + 85, 23, ink);
  text(ctx, fields.roomType, 300, detailTop + 85, 26, ink, 700, 245);
  text(ctx, 'No. Kamar', 74, detailTop + 125, 23, ink);
  text(ctx, fields.roomNumber, 300, detailTop + 125, 26, ink, 700);
  text(ctx, 'Paket', 74, detailTop + 165, 23, ink);
  text(ctx, fields.packageName, 300, detailTop + 165, 26, ink, 700, 245);
  text(ctx, 'Jumlah Tamu', 74, detailTop + 205, 23, ink);
  text(ctx, `${fields.guestCount} orang`, 300, detailTop + 205, 26, ink, 700);
  line(ctx, 553, detailTop + 60, 553, detailTop + 223);
  text(ctx, 'Check-in', 586, detailTop + 85, 24, ink, 800);
  text(ctx, fields.checkIn, 586, detailTop + 121, 23, ink, 500, 462);
  text(ctx, 'Check-out', 586, detailTop + 162, 24, ink, 800);
  text(ctx, fields.checkOut, 586, detailTop + 198, 23, ink, 500, 462);

  const payTop = detailTop + 244;
  panelTitle(ctx, 'RINCIAN PEMBAYARAN', 54, payTop, 458);
  panelTitle(ctx, 'PILIHAN PEMBAYARAN', 556, payTop, 510);
  text(ctx, 'Harga kamar', 72, payTop + 89, 24, ink);
  text(ctx, rupiah(fields.roomPrice), 306, payTop + 89, 28, ink, 700, 211);
  text(ctx, 'Biaya tambahan', 72, payTop + 131, 24, ink);
  text(ctx, rupiah(fields.extraCharge), 306, payTop + 131, 28, ink, 700, 211);
  round(ctx, 60, payTop + 152, 457, 59, 21, '#f9c45e');
  text(ctx, 'TOTAL', 79, payTop + 190, 28, ink, 800);
  text(ctx, rupiah(fields.total), 245, payTop + 190, 35, ink, 800, 260);
  round(ctx, 562, payTop + 64, 216, 147, 19, '#f8d78c', '#d7ad5a');
  round(ctx, 837, payTop + 64, 217, 147, 19, '#fffdfa', '#d7ad5a');
  ctx.textAlign = 'center';
  text(ctx, 'DP', 670, payTop + 110, 28, ink, 800);
  text(ctx, fields.dpLabel, 670, payTop + 136, 19, ink, 600, 205);
  text(ctx, rupiah(fields.minimumDp), 670, payTop + 179, 32, ink, 800, 206);
  text(ctx, 'atau', 807, payTop + 143, 23, '#9d6c22', 800);
  text(ctx, 'LUNAS', 946, payTop + 111, 28, ink, 800);
  text(ctx, '(100%)', 946, payTop + 137, 19, ink, 600);
  text(ctx, rupiah(fields.total), 946, payTop + 179, 32, ink, 800, 200);
  ctx.textAlign = 'left';

  const warnY = payTop + 228;
  round(ctx, 67, warnY, 988, 89, 30, navy, '#e9bd64');
  ctx.textAlign = 'center';
  text(ctx, 'INI BUKAN BUKTI BOOKING RESMI', W / 2, warnY + 36, 29, '#fff4d7', 800);
  text(ctx, 'Booking dikonfirmasi setelah pembayaran kami terima dan verifikasi.', W / 2, warnY + 68, 22, '#f7c65f', 600);
  ctx.textAlign = 'left';
}

export async function makeReservationCardJpg(offer: OfferDetail): Promise<Blob> {
  const fields = reservationCardFields(offer);
  const [qr, logo] = await Promise.all([loadImage(RESERVATION_CARD_QRIS), loadImage(RESERVATION_CARD_LOGO)]);
  const canvas = document.createElement('canvas');
  canvas.width = 1122;
  canvas.height = 1710;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser ini tidak mendukung pembuatan kartu reservasi.');
  draw(ctx, fields, qr, logo);
  const result = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .96));
  if (!result || result.type !== 'image/jpeg') throw new Error('Gagal membuat JPG reservasi.');
  return result;
}

export function reservationCardFilename(offer: OfferDetail): string {
  const safe = offer.guest_name.normalize('NFKD').replace(/[^\p{L}\p{N} -]/gu, '').trim().replace(/\s+/g, '-').slice(0,44) || 'TAMU';
  return `RESERVASI-${safe}-${offer.id.slice(0, 8)}.jpg`;
}
