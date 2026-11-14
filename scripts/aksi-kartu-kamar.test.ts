import { expect, test } from 'bun:test';
import { aksiKartuKamar } from '../src/lib/aksi-kartu-kamar';

test('Tersedia membuka Check-in hanya dengan izin existing', () => {
  expect(aksiKartuKamar({ active: true, status: 'ready' }, true)).toBe('check_in');
  expect(aksiKartuKamar({ active: true, status: 'ready' }, false)).toBe('informasi');
});
test('Terisi membuka hunian aktif', () => {
  expect(aksiKartuKamar({ active: true, status: 'occupied' }, true)).toBe('hunian');
});
test('Perlu dibersihkan membuka Housekeeping', () => {
  expect(aksiKartuKamar({ active: true, status: 'dirty' }, true)).toBe('housekeeping');
});
test('Sedang dibersihkan membuka Housekeeping', () => {
  expect(aksiKartuKamar({ active: true, status: 'cleaning' }, true)).toBe('housekeeping');
});
test('Tidak aktif tidak pernah membuka Check-in atau hunian', () => {
  for (const status of ['ready', 'occupied', 'dirty', 'cleaning']) {
    expect(aksiKartuKamar({ active: false, status }, true)).toBe('informasi');
  }
});