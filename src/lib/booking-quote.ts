import { rupiah } from '@/lib/data-contoh';
import { normalizeWhatsAppNumber } from '@/lib/whatsapp';

export type QuoteDayMode = 'weekday' | 'weekend';

export function canPreviewBookingQuote(mode: string, position: string | null, signedIn: boolean) {
  return mode === 'booking' && signedIn && ['owner', 'supervisor', 'receptionist'].includes(position ?? '');
}

export function quoteCheckInWib(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const day = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) return null;
  return `${date}T${time}:00+07:00`;
}

export type BookingQuoteDraft = {
  name: string;
  phone: string;
  roomNumber: string;
  roomType: string;
  packageName: string;
  checkIn: string;
  guestCount: number;
  dayMode: QuoteDayMode;
  roomPrice: number;
  extraCharge: number;
  total: number;
  minimumDp: number | null;
  dpMode: string | undefined;
  dpValue: number | undefined;
};

const dateWib = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric',
});
const timeWib = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

const validMoney = (value: number) => Number.isFinite(value) && value >= 0;
const singleLine = (value: string) => value.trim().replace(/\s+/g, ' ');

export function validateBookingQuote(draft: BookingQuoteDraft) {
  if (!draft.name.trim() || draft.name.trim().length > 100) return 'Isi nama tamu yang valid.';
  const phone = normalizeWhatsAppNumber(draft.phone);
  if (!/^(?:08\d{7,12}|\+?[1-9]\d{7,14})$/.test(draft.phone.trim()) || phone.startsWith('620')) {
    return 'Isi nomor WhatsApp yang valid (contoh 08… atau +62…).';
  }
  if (!draft.roomNumber.trim() || !draft.roomType.trim() || !draft.packageName.trim()) return 'Pilih kamar dan paket aktif.';
  if (!draft.checkIn) return 'Pilih tanggal dan jam check-in WIB yang valid.';
  if (draft.guestCount !== 2 || draft.extraCharge !== 0) return 'Form Booking saat ini hanya mendukung penawaran untuk 2 tamu.';
  if (!validMoney(draft.roomPrice) || draft.roomPrice === 0 || draft.total !== draft.roomPrice + draft.extraCharge) {
    return 'Harga resmi paket belum tersedia.';
  }
  if (draft.minimumDp === null || !validMoney(draft.minimumDp) || draft.dpValue === undefined ||
      !validMoney(draft.dpValue) || !['PERCENTAGE', 'AMOUNT'].includes(draft.dpMode ?? '')) {
    return 'Pengaturan DP resmi belum dapat dibaca untuk akun ini. Hubungi Owner sebelum mengirim penawaran.';
  }
  if (draft.minimumDp > draft.total) return 'Minimum DP melebihi total tagihan. Hubungi Owner.';
  return '';
}

export function formatBookingQuote(draft: BookingQuoteDraft, schedule: { scheduled_check_in: string; scheduled_check_out: string }) {
  const error = validateBookingQuote(draft);
  if (error) throw new Error(error);
  const start = new Date(schedule.scheduled_check_in);
  const end = new Date(schedule.scheduled_check_out);
  if (start.getTime() !== Date.parse(draft.checkIn) || !(end > start)) {
    throw new Error('Jadwal resmi paket tidak sesuai dengan waktu yang dipilih.');
  }

  const wib = (date: Date) => `${dateWib.format(date)}, ${timeWib.format(date)} WIB`;
  const dpBasis = draft.dpMode === 'PERCENTAGE' ? ` (${draft.dpValue!.toLocaleString('id-ID')}%)` : '';
  const message = [
    '*BATURADEN 25 HOMESTAY*',
    '*Penawaran / Permintaan Reservasi*',
    '',
    `Halo Kak ${singleLine(draft.name)},`,
    'Berikut rincian penawaran menginap untuk Kakak.',
    '',
    `Kamar: ${singleLine(draft.roomType)} · No. ${singleLine(draft.roomNumber)}`,
    `Paket: ${singleLine(draft.packageName)}`,
    `Check-in: ${wib(start)}`,
    `Check-out: ${wib(end)}`,
    `Jumlah tamu: ${draft.guestCount} orang`,
    '',
    `Harga kamar (${draft.dayMode === 'weekday' ? 'Weekday' : 'Weekend'}): ${rupiah(draft.roomPrice)}`,
    `Biaya tambahan: ${rupiah(draft.extraCharge)}`,
    `Total tagihan: ${rupiah(draft.total)}`,
    `Minimum DP${dpBasis}: ${rupiah(draft.minimumDp!)}`,
    `Opsi bayar lunas: ${rupiah(draft.total)}`,
    '',
    'Penawaran ini tidak mengunci kamar. Ketersediaan diperiksa kembali saat Booking resmi.',
    'Mohon tunggu konfirmasi setelah pembayaran diverifikasi. Bukti reservasi dikirim setelah Booking resmi.',
    '',
    'Terima kasih telah memilih Baturaden 25 Homestay.',
  ].join('\n');
  return { message, phone: normalizeWhatsAppNumber(draft.phone) };
}
