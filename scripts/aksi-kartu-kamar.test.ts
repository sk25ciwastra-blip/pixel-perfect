import { expect, test } from 'bun:test';
import { aksiKartuKamar } from '../src/lib/aksi-kartu-kamar';

test('Tersedia membuka Check-in hanya dengan izin existing', () => {
  expect(aksiKartuKamar({ active: true, status: 'ready' }, true)).toBe('check_in');
  expect(aksiKartuKamar({ active: true, status: 'ready' }, false)).toBe('informasi');
});
test('Terisi membuka popup kamar terisi, bukan form atau Detail Transaksi', () => {
  expect(aksiKartuKamar({ active: true, status: 'occupied' }, true)).toBe('terisi');
  expect(aksiKartuKamar({ active: true, status: 'occupied' }, false)).toBe('terisi');
});
test('Perlu dibersihkan membuka form existing tanpa melewati validasi', () => {
  expect(aksiKartuKamar({ active: true, status: 'dirty' }, true)).toBe('check_in');
});
test('Sedang dibersihkan membuka form existing tanpa melewati validasi', () => {
  expect(aksiKartuKamar({ active: true, status: 'cleaning' }, true)).toBe('check_in');
});
test('Tidak aktif tidak pernah membuka Check-in atau hunian', () => {
  for (const status of ['ready', 'occupied', 'dirty', 'cleaning']) {
    expect(aksiKartuKamar({ active: false, status }, true)).toBe('informasi');
  }
});