import type { Package, PackageRoomTypePrice } from './data-live';

/** A grouped editor must never fall back to the global package price. */
export function hargaFormPaket(paket: Package, harga: PackageRoomTypePrice | null, kelompok: string | null) {
  if (kelompok) {
    if (!harga || harga.package_id !== paket.id || harga.pricing_group !== kelompok) return null;
    return { weekday: Number(harga.weekday_price), weekend: Number(harga.weekend_price) };
  }
  return { weekday: Number(paket.weekday_price), weekend: Number(paket.weekend_price) };
}