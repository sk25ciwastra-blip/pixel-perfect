import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const settings = readFileSync('src/routes/pengaturan.tsx', 'utf8');
const manage = readFileSync('src/routes/pengaturan-manajemen-kamar.tsx', 'utf8');
const types = readFileSync('src/routes/tipe-kamar.tsx', 'utf8');
test('Owner menus navigate to distinct settings routes', () => {
  expect(settings).toContain('label: "Manajemen Kamar", ket: "Tambah, ubah, dan aktif/nonaktif kamar.", ke: "/pengaturan-manajemen-kamar"');
  expect(settings).toContain('label: "Tipe Kamar", ket: "Jenis kamar yang tersedia.", ke: "/tipe-kamar"');
  expect(manage).toContain("createFileRoute('/pengaturan-manajemen-kamar')");
  expect(types).toContain("createFileRoute('/tipe-kamar')");
});
test('Room management is standalone and Owner-only', () => {
  expect(manage).toContain("posisiKode === 'owner'");
  expect(manage).toContain('Daftar Seluruh Kamar');
  expect(manage).toContain('Tambah Kamar');
  expect(manage).toContain('Nonaktifkan');
  expect(manage).toContain('transactions.loading || transactions.error');
  expect(manage).toContain('digunakan(room)');
});
