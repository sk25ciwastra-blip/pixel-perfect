import { describe, expect, it } from 'bun:test';
import { durasiWib, waktuWib, jejakWib, tanggalHariWib, jamWib } from '../src/lib/waktu-transaksi';

describe('waktu aktual Detail Transaksi', () => {
  it('menampilkan Check-in dan Check-out aktual transaksi selesai', () => {
    expect(waktuWib('2026-11-04T19:54:00.000Z')).toContain('02.54');
    expect(waktuWib('2026-11-04T19:55:00.000Z')).toContain('02.55');
  });

  it('menampilkan Check-in tanpa Check-out aktual', () => {
    expect(waktuWib('2026-11-04T19:54:00.000Z')).toContain('02.54');
    expect(waktuWib(null)).toBe('—');
  });

  it('booking belum check-in dan timestamp null tetap berupa tanda em dash', () => {
    expect(waktuWib(null)).toBe('—');
    expect(waktuWib(null)).toBe('—');
  });

  it('mengonversi timestamp UTC ke WIB', () => {
    expect(waktuWib('2026-11-04T19:54:00.000Z')).toContain('05 Nov 2026');
    expect(waktuWib('2026-11-04T19:54:00.000Z')).toContain('02.54');
  });

  it('mempertahankan durasi dari jadwal paket', () => {
    expect(durasiWib('2026-11-04T19:00:00.000Z', '2026-11-04T23:00:00.000Z')).toBe('4 jam 0 menit');
    expect(durasiWib(null, '2026-11-04T23:00:00.000Z')).toBe('—');
  });

  it('jejak waktu header/footer memakai nama bulan penuh dan pemisah garis tegak', () => {
    expect(jejakWib('2026-11-04T19:54:00.000Z')).toBe('Kamis, 05 November 2026 | 02.54 WIB');
    expect(jejakWib('2026-11-12T23:48:00.000Z')).toBe('Jumat, 13 November 2026 | 06.48 WIB');
    expect(jejakWib(null)).toBe('—');
  });

  it('baris riwayat memisahkan tanggal bernama hari dari jam WIB', () => {
    expect(tanggalHariWib('2026-11-12T23:48:00.000Z')).toBe('Jumat, 13 Nov 2026');
    expect(tanggalHariWib(null)).toBe('—');
    expect(jamWib('2026-11-12T23:48:00.000Z')).toBe('06.48');
    expect(jamWib(null)).toBe('—');
  });
});
