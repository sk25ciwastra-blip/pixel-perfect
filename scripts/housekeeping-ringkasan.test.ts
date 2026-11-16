import { describe, expect, test } from 'bun:test';
import { formatDurasi, grafikTahun, riwayatPekerjaan, ringkasanHousekeeping, tahunTersedia } from '../src/lib/housekeeping-ringkasan';

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
describe('riwayat pekerjaan dari catatan mulai dan selesai', () => {
  const baris = (id: string, action: string, created_at: string, room_id: string, job_id: string | null = null) => ({ id, action, created_at, room_id, job_id, job_number: null, performed_by_name: 'Rina' });
  test('memasangkan mulai dan selesai per pekerjaan lalu menghitung durasi menit', () => {
    const hasil = riwayatPekerjaan([
      baris('a', 'start_cleaning', '2026-11-12T01:05:00Z', 'S-02', 'J1'),
      baris('b', 'finish_cleaning', '2026-11-12T01:45:00Z', 'S-02', 'J1'),
      baris('c', 'start_cleaning', '2026-10-11T20:45:00Z', '03'),
      baris('d', 'finish_cleaning', '2026-10-12T02:25:00Z', '03'),
      baris('e', 'start_cleaning', '2026-11-13T02:00:00Z', 'S-04'),
    ]);
    expect(hasil.map(item => [item.roomId, item.hasil, item.durasiMenit])).toEqual([['S-04', 'Proses', null], ['S-02', 'Selesai', 40], ['03', 'Selesai', 340]]);
    expect(formatDurasi(40)).toBe('40 menit');
    expect(formatDurasi(340)).toBe('5 jam 40 menit');
  });
  test('grafik tahun hanya menghitung selesai pada tahun yang dipilih', () => {
    const rows = [{ action: 'finish_cleaning', created_at: '2025-03-10T03:00:00Z' }, { action: 'finish_cleaning', created_at: '2026-03-10T03:00:00Z' }];
    expect(grafikTahun(rows, '2025', new Date('2026-11-16T07:00:00Z'))[2]?.jumlah).toBe(1);
    expect(tahunTersedia(rows, new Date('2026-11-16T07:00:00Z'))).toEqual(['2026', '2025']);
  });
});
