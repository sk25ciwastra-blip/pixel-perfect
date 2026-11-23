import { supabase } from '@/integrations/supabase/client';
import { formatBookingQuote } from '@/lib/booking-quote';
import { whatsAppDraftUrl } from '@/lib/whatsapp';
import { canonicalIndonesianWhatsApp } from '@/lib/guest-search';

export type Offer = {
  id: string;
  guest_name: string;
  phone_last4: string;
  room_id: string;
  package_id: string;
  room_number: string;
  room_type: string;
  package_name: string;
  scheduled_check_in: string;
  scheduled_check_out: string;
  day_mode: 'weekday' | 'weekend';
  guest_count: number;
  total: number;
  minimum_dp: number;
  minimum_dp_mode: 'PERCENTAGE' | 'AMOUNT';
  minimum_dp_value: number;
  status: 'DRAFT' | 'SENT' | 'CONVERTED' | 'FAILED_UNAVAILABLE' | 'EXPIRED_SCHEDULE' | 'CANCELLED';
  created_at: string;
  sent_marked_at: string | null;
  transaction_number: string | null;
  reason: string | null;
};

export type OfferDetail = Offer & { phone: string; address: string };
export type OfferPage = { rows: Offer[]; count: number; failed_count: number | null };
export const offerQueryKey = ['reservation-offers'] as const;

export const offerStatus: Record<Offer['status'], string> = {
  DRAFT: 'Belum ditandai dikirim',
  SENT: 'Ditandai dikirim · Menunggu DP',
  CONVERTED: 'Booking resmi',
  FAILED_UNAVAILABLE: 'Kamar tidak tersedia',
  EXPIRED_SCHEDULE: 'Jadwal sudah lewat',
  CANCELLED: 'Dibatalkan',
};

export function offerWhatsApp(offer: OfferDetail) {
  const quote = formatBookingQuote({
    name: offer.guest_name, phone: canonicalIndonesianWhatsApp(offer.phone) ?? offer.phone, roomNumber: offer.room_number,
    roomType: offer.room_type, packageName: offer.package_name, checkIn: offer.scheduled_check_in,
    guestCount: offer.guest_count, dayMode: offer.day_mode, roomPrice: offer.total, extraCharge: 0,
    total: offer.total, minimumDp: offer.minimum_dp, dpMode: offer.minimum_dp_mode, dpValue: offer.minimum_dp_value,
  }, offer);
  return { ...quote, url: whatsAppDraftUrl(quote.phone, quote.message) };
}

export const offerWib = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short',
});

export function offerWibFields(instant: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const part = (name: string) => parts.find(item => item.type === name)?.value;
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

export async function readOffers(page: number, guest?: string): Promise<OfferPage> {
  const { data, error } = await supabase.rpc('read_reservation_offers', { _page: page, ...(guest ? { _guest: guest } : {}) });
  if (error) throw error;
  return data as unknown as OfferPage;
}

export async function readOffer(id: string): Promise<OfferDetail | null> {
  const { data, error } = await supabase.rpc('read_reservation_offers', { _id: id });
  if (error) throw error;
  return data as unknown as OfferDetail | null;
}
