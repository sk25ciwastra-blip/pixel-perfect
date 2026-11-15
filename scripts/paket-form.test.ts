import { describe, expect, it } from 'vitest';
import { hargaFormPaket } from '../src/lib/paket-form';
import type { Package, PackageRoomTypePrice } from '../src/lib/data-live';

const paket = { id: 'paket-2-jam', weekday_price: 90000, weekend_price: 90000 } as Package;
const harga = { package_id: paket.id, pricing_group: 'standard', weekday_price: 70000, weekend_price: 80000 } as PackageRoomTypePrice;
describe('Harga asli popup per tipe kamar', () => {
  it('mengambil harga baris tipe, bukan harga umum paket', () => {
    expect(hargaFormPaket(paket, harga, 'standard')).toEqual({ weekday: 70000, weekend: 80000 });
  });
  it('menolak harga dari tipe lain', () => {
    expect(hargaFormPaket(paket, harga, 'deluxe')).toBeNull();
  });
  it('tidak mengarang harga bila relasi tipe belum tersedia', () => {
    expect(hargaFormPaket(paket, null, 'standard')).toBeNull();
  });
  it('menolak relasi milik paket lain', () => {
    expect(hargaFormPaket(paket, { ...harga, package_id: 'lain' }, 'standard')).toBeNull();
  });
});