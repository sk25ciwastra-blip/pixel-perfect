import { expect, test } from 'bun:test';
import { aksiKartuKamar, statusPopupKamar } from '../src/lib/aksi-kartu-kamar';

test('Tersedia membuka Check-in hanya dengan izin existing', () => {
  expect(aksiKartuKamar({ active: true, status: 'ready' }, true)).toBe('check_in');
  expect(aksiKartuKamar({ active: true, status: 'ready' }, false)).toBe('informasi');
});
test('Terisi membuka popup kamar terisi, bukan form atau Detail Transaksi', () => {
  expect(aksiKartuKamar({ active: true, status: 'occupied' }, true)).toBe('status');
  expect(aksiKartuKamar({ active: true, status: 'occupied' }, false)).toBe('status');
  expect(statusPopupKamar({ active: true, status: 'occupied' })).toBe('terisi');
});
test('Perlu dibersihkan membuka popup amber, bukan Check-in', () => {
  expect(aksiKartuKamar({ active: true, status: 'dirty' }, true)).toBe('status');
  expect(statusPopupKamar({ active: true, status: 'dirty' })).toBe('perlu');
});
test('Sedang dibersihkan membuka popup biru, bukan Check-in', () => {
  expect(aksiKartuKamar({ active: true, status: 'cleaning' }, true)).toBe('status');
  expect(statusPopupKamar({ active: true, status: 'cleaning' })).toBe('sedang');
});
test('Tidak aktif tidak pernah membuka Check-in atau hunian', () => {
  for (const status of ['ready', 'occupied', 'dirty', 'cleaning']) {
    expect(aksiKartuKamar({ active: false, status }, true)).toBe('status');
    expect(statusPopupKamar({ active: false, status })).toBe('nonaktif');
  }
});
test('Status tidak dikenali tidak boleh membuka Check-in', () => {
  expect(aksiKartuKamar({ active: true, status: 'unknown' }, true)).toBe('status');
});