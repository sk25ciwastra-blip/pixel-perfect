import type { Package, PackageRoomTypePrice } from './data-live';

export function jamPaket(paket: Package | null) {
  if (!paket) return { mulai: '', selesai: '' };
  if (paket.time_mode === 'fixed_window') return { mulai: paket.slot_start_time?.slice(0, 5) ?? '', selesai: paket.checkout_time?.slice(0, 5) ?? '' };
  if (paket.time_mode === 'duration_midnight_cap') return { mulai: paket.checkin_start_time?.slice(0, 5) ?? '', selesai: paket.checkin_end_time?.slice(0, 5) ?? '' };
  return { mulai: '', selesai: paket.time_mode === 'fixed_days_checkout' ? paket.checkout_time?.slice(0, 5) ?? '' : '' };
}

export function teksJamWib(jam: string) { return `${jam.replace(':', '.')} WIB`; }

export const pilihanJam = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

/** A grouped editor must never fall back to the global package price. */
export function hargaFormPaket(paket: Package, harga: PackageRoomTypePrice | null, kelompok: string | null) {
  if (kelompok) {
    if (!harga || harga.package_id !== paket.id || harga.pricing_group !== kelompok) return null;
    return { weekday: Number(harga.weekday_price), weekend: Number(harga.weekend_price) };
  }
  return { weekday: Number(paket.weekday_price), weekend: Number(paket.weekend_price) };
}