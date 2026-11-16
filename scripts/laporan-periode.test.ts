import { describe, expect, test } from 'bun:test';
import { dalamPeriode, rentangLaporan, tanggalLaporan } from '../src/lib/laporan-periode';

describe('Periode laporan WIB', () => {
  test('mengikuti pergantian tanggal Jakarta, bukan UTC', () => {
    expect(tanggalLaporan('2026-11-15T17:00:00Z')).toBe('2026-11-16');
    expect(dalamPeriode('2026-11-15T16:59:59Z', { awal: '2026-11-16', akhir: '2026-11-16' })).toBe(false);
    expect(dalamPeriode('2026-11-16T16:59:59Z', { awal: '2026-11-16', akhir: '2026-11-16' })).toBe(true);
  });
  test('rentang tujuh hari inklusif melewati bulan', () => {
    expect(rentangLaporan(7, '2026-11-02T05:00:00Z')).toEqual({ awal: '2026-10-27', akhir: '2026-11-02' });
  });
});