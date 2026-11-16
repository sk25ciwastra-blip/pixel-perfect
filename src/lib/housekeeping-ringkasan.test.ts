import { describe, expect, test } from 'bun:test';
import { ringkasanHousekeeping } from './housekeeping-ringkasan';

describe('ringkasan dari pembersihan tercatat', () => {
  test('menghitung selesai saja dalam hari WIB, minggu Senin dan bulan berjalan', () => {
    const result = ringkasanHousekeeping([
      { action: 'finish_cleaning', created_at: '2026-11-15T17:30:00Z' },
      { action: 'start_cleaning', created_at: '2026-11-16T01:00:00Z' },
      { action: 'finish_cleaning', created_at: '2026-11-15T16:30:00Z' },
      { action: 'finish_cleaning', created_at: '2026-10-31T17:30:00Z' },
      { action: 'finish_cleaning', created_at: '2026-10-30T01:00:00Z' },
    ], new Date('2026-11-16T07:09:00Z'));
    expect([result.hari, result.minggu, result.bulan]).toEqual([1, 1, 3]);
    expect(result.grafik[9]?.jumlah).toBe(1);
    expect(result.grafik[10]?.jumlah).toBe(3);
  });
});