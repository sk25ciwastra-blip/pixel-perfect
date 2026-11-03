import { describe, it, expect } from 'vitest';
import { bolehCheckIn, bolehHubungiTamu } from '../src/lib/aksi-operasional';

describe('Aksi resmi yang dipindah tanpa izin baru', () => {
  it('Check-in tetap Owner, SPV, RCP saja', () => {
    for (const role of ['owner', 'supervisor', 'receptionist'] as const) expect(bolehCheckIn(role)).toBe(true);
    for (const role of ['housekeeping', 'inspector', 'investor', null] as const) expect(bolehCheckIn(role)).toBe(false);
  });
  it('inspector hanya-baca tidak dapat menghubungi tamu', () => {
    expect(bolehHubungiTamu('inspector', '081234567890')).toBe(false);
  });
  it('nomor invalid dinonaktifkan, nomor penuh lokal dan internasional valid', () => {
    for (const phone of ['', null, 'abc', '0812', '123456789012']) expect(bolehHubungiTamu('owner', phone)).toBe(false);
    expect(bolehHubungiTamu('owner', '081234567890')).toBe(true);
    expect(bolehHubungiTamu('receptionist', '+62 812-3456-7890')).toBe(true);
  });
});