import { describe, it, expect } from 'vitest';
import { periodeWib, filterTransaksi, rentangTransaksi, TRANSAKSI_PER_HALAMAN } from '../src/lib/transaksi-filter';

describe('Filter daftar transaksi', () => {
  it('default bulan dan tahun mengikuti pergantian hari WIB', () => {
    expect(periodeWib(new Date('2026-12-31T17:01:00Z'))).toEqual({ bulan: 1, tahun: 2027 });
  });
  it('bulan dibatasi created_at dari tengah malam WIB sampai awal bulan berikutnya', () => {
    expect(filterTransaksi(10, 2026, '')).toEqual({ mulai: '2026-10-01T00:00:00+07:00', akhir: '2026-11-01T00:00:00+07:00' });
  });
  it('semua bulan mencakup seluruh tahun terpilih', () => {
    expect(filterTransaksi(0, 2026, '')).toEqual({ mulai: '2026-01-01T00:00:00+07:00', akhir: '2027-01-01T00:00:00+07:00' });
  });
  it('pencarian nomorator menghapus batas periode', () => {
    const query = filterTransaksi(10, 2026, 'BTRDTRX-000019');
    expect(query).toEqual({ teks: '%BTRDTRX-000019%' });
    expect(filterTransaksi(1, 2025, '19')).toEqual(filterTransaksi(10, 2026, '19'));
  });
  it('pagination tetap 20 dengan rentang halaman tidak tumpang tindih', () => {
    expect(TRANSAKSI_PER_HALAMAN).toBe(20);
    expect(rentangTransaksi(1)).toEqual({ awal: 0, akhir: 19 });
    expect(rentangTransaksi(2)).toEqual({ awal: 20, akhir: 39 });
    expect(rentangTransaksi(51)).toEqual({ awal: 1000, akhir: 1019 });
  });
});