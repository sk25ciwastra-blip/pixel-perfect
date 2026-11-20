import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { canAccessSupervisorOperationalPage } from '../src/lib/supervisor-routes';

describe('Baturaden 25 Homestay Supervisor route authorization', () => {
  test('permits normal supervisor operational routes', () => {
    for(const path of [
      '/', '/kamar', '/booking', '/check-in', '/transaksi',
      '/tamu', '/housekeeping', '/keuangan', '/laporan',
    ]) {
      expect(canAccessSupervisorOperationalPage(path)).toBe(true);
    }
  });
  test('denies Owner-only pages and unknown URLs', () => {
    for (const path of [
      '/karyawan','/pengaturan-keuangan','/daftar-pengeluaran',
      '/paket','/tipe-kamar','/admin','/missing',
    ]) {
      expect(canAccessSupervisorOperationalPage(path)).toBe(false);
    }
  });
  test('denies near-match and unauthorized subroutes', () => {
    for (const path of [
      '/karyawan/', '/karyawan/new', '/paket?foo=bar',
      '/keuangan/admin', '/housekeeping/super-admin',
      '/tipe-kamar/edit',
    ]) {
      expect(canAccessSupervisorOperationalPage(path)).toBe(false);
    }
  });
  test('root route uses the same allowlist as navigation', () => {
    const root=readFileSync('src/routes/__root.tsx','utf8');
    const nav=readFileSync('src/components/kerangka.tsx','utf8');
    expect(root).toContain('return canAccessSupervisorOperationalPage(pathname)');
    expect(nav).toContain('return canAccessSupervisorOperationalPage(ke)');
    expect(root).toContain("pathname === '/pengaturan' || pathname === '/pengaturan-keamanan'");
    expect(nav).toContain('if (ke === "/pengaturan") return Boolean(posisiKode);');
    expect(root).not.toContain("return !['/karyawan', '/pengaturan'].includes(pathname)");
    expect(nav).not.toContain('return !["/karyawan", "/pengaturan"].includes(ke)');
  });
});
